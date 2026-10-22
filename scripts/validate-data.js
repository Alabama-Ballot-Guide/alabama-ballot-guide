#!/usr/bin/env node
// validate-data.js: gate for every change to data.js (agent PRs and human PRs alike).
// Zero dependencies. It NEVER executes data.js: the file is read as text and parsed as JSON.
//
// Usage (CI, on a pull request):
//   git show origin/main:data.js > /tmp/base-data.js
//   git diff --name-only origin/main...HEAD > /tmp/changed.txt
//   node scripts/validate-data.js --base /tmp/base-data.js --new data.js \
//        --allowlist security/source-domains.json --lock security/facts.lock.json \
//        --changed-files /tmp/changed.txt [--agent] [--max-changes 60]
//   node scripts/validate-data.js --dist dist --lock security/facts.lock.json --allowlist security/source-domains.json
//
// Human-only helper (run locally, review the output, commit it with CODEOWNER approval):
//   node scripts/validate-data.js --write-lock --new data.js --lock security/facts.lock.json
"use strict";
const fs = require("fs");
const path = require("path");

// ---------- args ----------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2), v = process.argv[i + 1];
  if (v === undefined || v.startsWith("--")) args[k] = true; else { args[k] = v; i++; }
}
const errors = [], warnings = [], notes = [];
const err = (p, m) => errors.push((p ? p + ": " : "") + m);
const warn = (p, m) => warnings.push((p ? p + ": " : "") + m);

// ---------- constants ----------
const PREFIX = "window.GUIDE = ";
const AGENT_WRITABLE_FILES = new Set(["data.js"]);          // the only file an agent PR may touch
// the only parts of data.js an agent PR may change: race and amendment content, the change log, and the
// "Updated" and debate as-of lines. The About statements (official address, privacy) and the shared
// law descriptions stay as a human wrote them.
const AGENT_WRITABLE_KEYS = new Set(["groups", "amendments", "updates", "heroMeta", "defaultDebate"]);
const PROTECTED_FILES = [/^\.github\//, /^build\.py$/, /^gen\.js$/, /^app\.js$/, /^shell\.html$/, /^og-card\.html$/,
  /^robots\.txt$/, /^CODEOWNERS$/, /^security\//, /^scripts\//, /^dist\//, /^package(-lock)?\.json$/, /^CNAME$/];
const RELATIVE_URL_OK = { "about[].links[].url": new Set(["guide.json", "guide.md", "llms.txt"]) };
const GROUP_IDS = new Set(["state", "federal"]);
const PARTY_CODES = new Set(["R", "D", "L", "I"]);
// ids the app itself uses for getElementById / views; data ids must not collide with these
const RESERVED_IDS = new Set(["top", "about", "live", "sheet", "scrim", "countdown", "picksSlot", "picksBtn", "picksN", "picksList",
  "filter", "filterLabel", "filterStatus", "find", "findH", "myHouse", "myBoe", "fbStatus", "houseNote", "boeNote", "races",
  "content", "showAll", "clearPicks", "closeSheet", "sheetTitle", "overview", "congress", "amendments", "vote", "laws", "lawsH", "lawTip"]);
const RESERVED_ID_PREFIX = /^(view-|h-|tab-|panel-|law-|amend-|al-?\d)/;
const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;
const TOPIC_RE = /^[a-z]{2,20}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 1500;
// Printable ASCII plus the typographic and Spanish characters the guide already uses.
const ALLOWED_NON_ASCII = "·’‘¿¡ñÑáéíóúüÁÉÍÓÚÜ–—“”§‑…";
// Built from code points so this file stays pure ASCII.
const cls = ranges => new RegExp("[" + ranges.map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]");
const INVISIBLE = cls([[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff], [0x2028, 0x2029]]);
const CONTROL = cls([[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f]]);
const BAD_TEXT = [
  [/[<>]/, "contains < or > (no HTML in text fields)"],
  [/\]\(|\[[^\]]*\]\s*\(/, "contains Markdown link syntax"],
  [/\{\{|\{%|%\}|\}\}/, "contains template syntax"],
  [/\b(javascript|vbscript|data|file):/i, "contains a script/data URL scheme"],
  [/https?:\/\//i, "contains a URL in a text field (URLs belong in url fields only)"],
  [CONTROL, "contains control characters"],
  [INVISIBLE, "contains invisible or bidirectional-override characters"],
  [/\b(ignore (all |any )?(previous|prior) instructions|system prompt|as an ai (model|assistant)|assistant:|you are (chatgpt|claude|an ai))/i,
    "looks like an instruction to an AI system (possible prompt injection)"]
];

// ---------- helpers ----------
function readGuide(file, label) {
  const s = fs.readFileSync(file, "utf8");
  if (!s.startsWith(PREFIX) || !s.endsWith(";\n")) { err(label, "must be exactly `window.GUIDE = <JSON>;` with nothing else"); return null; }
  let G;
  try { G = JSON.parse(s.slice(PREFIX.length, -2)); } catch (e) { err(label, "body is not valid JSON: " + e.message); return null; }
  // Exact canonical form: rules out comments, extra statements, or anything hidden after the object.
  if (s !== PREFIX + JSON.stringify(G, null, 2) + ";\n") err(label, "not in canonical form (re-serialize with JSON.stringify(G, null, 2)); refusing anything that is not pure data");
  return G;
}
function walk(o, p, fn) {
  if (Array.isArray(o)) o.forEach((v, i) => walk(v, p + "[" + i + "]", fn));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], p ? p + "." + k : k, fn);
  else fn(p, o);
}
const norm = p => p.replace(/\[\d+\]/g, "[]");
const typeOf = v => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
function shape(G) {
  const m = new Map();
  (function s(o, p) {
    const t = typeOf(o); const k = norm(p) || "(root)";
    if (!m.has(k)) m.set(k, new Set()); m.get(k).add(t);
    if (t === "array") o.forEach((v, i) => s(v, p + "[" + i + "]"));
    else if (t === "object") for (const key of Object.keys(o)) {
      // topics and topicNotes are maps keyed by topic id: normalize their keys
      const kk = /^(topics|topicNotes)$/.test(p) ? "{topic}" : key;
      s(o[key], p ? p + "." + kk : kk);
    }
  })(G, "");
  return m;
}
function loadAllowlist(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const allowed = [];
  for (const cat of Object.keys(j.allow)) for (const d of j.allow[cat].domains) allowed.push({ d: d.toLowerCase(), sub: !!j.allow[cat].includeSubdomains, cat });
  const exact = new Set(((j.allowExactUrls || {}).urls) || []);
  return { allowed, exact, protectedNames: (j.protectedLookalikeTerms || []).map(s => s.toLowerCase()) };
}
function hostAllowed(host, AL) {
  return AL.allowed.find(a => host === a.d || (a.sub && host.endsWith("." + a.d)));
}
function checkUrl(p, u, AL) {
  const np = norm(p);
  if (typeof u !== "string") return err(p, "url must be a string");
  if (RELATIVE_URL_OK[np]) { if (!RELATIVE_URL_OK[np].has(u)) err(p, "relative link must be one of " + [...RELATIVE_URL_OK[np]].join(", ")); return; }
  if (/\s|[\u0000-\u001f\u007f-\u009f]/.test(u)) return err(p, "url contains whitespace or control characters");
  if (/["'<>]/.test(u)) return err(p, "url contains a quote or angle bracket, which the page refuses to link; percent-encode it (' is %27): " + u);
  let x; try { x = new URL(u); } catch (e) { return err(p, "url does not parse: " + u); }
  if (x.protocol !== "https:") return err(p, "url must use https: (got " + x.protocol + ") " + u);
  if (x.username || x.password) return err(p, "url must not contain credentials: " + u);
  if (x.port) return err(p, "url must not set a port: " + u);
  const host = x.hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return err(p, "url must not use an IP address: " + u);
  if (host.split(".").some(l => l.startsWith("xn--"))) return err(p, "punycode (internationalized) hostname not allowed: " + host);
  const hit = hostAllowed(host, AL);
  if (!hit && AL.exact.has(u)) { warn(p, "grandfathered URL on a non-allowlisted domain (replace with the original publisher): " + host); return "grandfathered"; }
  if (!hit) {
    const look = AL.protectedNames.find(t => host.replace(/[^a-z0-9]/g, "").includes(t.replace(/[^a-z0-9]/g, "")));
    return err(p, "domain not on the source allowlist: " + host + (look ? " (LOOKALIKE of a protected name: " + look + ")" : ""));
  }
  return hit.cat;
}
function checkText(p, t) {
  if (t.length > MAX_TEXT) err(p, "text longer than " + MAX_TEXT + " characters");
  if (t !== t.trim()) warn(p, "leading/trailing whitespace");
  for (const [re, m] of BAD_TEXT) if (re.test(t)) err(p, m + ": " + JSON.stringify(t.slice(0, 80)));
  for (const c of t) {
    const code = c.codePointAt(0);
    if (code > 126 && !ALLOWED_NON_ASCII.includes(c)) { err(p, "character U+" + code.toString(16).toUpperCase().padStart(4, "0") + " (" + c + ") is not on the character allowlist (homoglyph/spoofing guard)"); break; }
  }
}
function racesOf(G) { return (G.groups || []).flatMap(g => g.races || []); }
function candidatesOf(G) {
  const out = [];
  racesOf(G).forEach(r => {
    (r.candidates || []).forEach(c => out.push([r.id, c]));
    (r.districts || []).forEach(d => (d.candidates || []).forEach(c => out.push(["house-" + d.n, c])));
    (r.rows || []).forEach(row => (row.cands || []).forEach(c => out.push([r.id + ":" + row.office, c])));
  });
  return out;
}

// ---------- critical facts lock ----------
// JSON-pointer-like paths whose values only a human may change (via a CODEOWNER-reviewed edit to the lock file).
const LOCK_PATHS = G => {
  const p = ["electionDate", "canonicalUrl", "findBallot.step1.link.url"];
  (G.dates || []).forEach((d, i) => ["k", "v", "s", "iso", "target", "pastNote"].forEach(k => d[k] !== undefined && p.push("dates[" + i + "]." + k)));
  (G.absenteeStages || []).forEach((s, i) => ["until", "title", "text"].forEach(k => p.push("absenteeStages[" + i + "]." + k)));
  (G.vote || []).forEach((s, i) => { p.push("vote[" + i + "]"); });          // every How-to-vote step, whole object
  ["callout", "idCard", "spanish", "spanishGuide"].forEach(k => G[k] !== undefined && p.push(k));
  return p;
};
function get(G, p) { return p.split(/\.|(?=\[)/).reduce((o, k) => (o == null ? undefined : k.startsWith("[") ? o[+k.slice(1, -1)] : o[k]), G); }

// ---------- dist mode: check the built site, not the data ----------
function checkDist(dir) {
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const scripts = html.match(/<script\b[^>]*>/gi) || [];
  if (scripts.length !== 3) err("dist/index.html", "expected exactly 3 <script> tags (JSON-LD, data, app), found " + scripts.length + ": possible script breakout");
  // scan markup only: drop the bodies of the inline scripts (they contain the app's own HTML templates)
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>");
  const handlers = markup.match(/<[a-z][^>]*\son[a-z]+\s*=/gi) || [];
  if (handlers.length) err("dist/index.html", "inline event handler attribute in markup: " + handlers[0].slice(0, 100));
  const hrefs = [...markup.matchAll(/\s(?:href|src|action|formaction)\s*=\s*"([^"]*)"/gi)].map(m => m[1].replace(/&amp;/g, "&"));
  const AL = args.allowlist ? loadAllowlist(args.allowlist) : null;
  for (const h of hrefs) {
    if (h.startsWith("#") || ["guide.json", "guide.md", "llms.txt"].includes(h)) continue;
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(h)) continue; // remove once fonts are self-hosted
    let x; try { x = new URL(h); } catch (e) { err("dist href", "unparseable: " + h.slice(0, 80)); continue; }
    if (x.protocol !== "https:") { err("dist href", "non-https link in built page: " + h.slice(0, 80)); continue; }
    if (AL && !hostAllowed(x.hostname, AL) && !AL.exact.has(h) && !(args["site-host"] && x.hostname === args["site-host"])) err("dist href", "link to non-allowlisted domain: " + x.hostname);
  }
  if (/YOUR-SITE\.example/.test(html)) err("dist/index.html", "placeholder SITE_URL (YOUR-SITE.example) still present: rebuild with SITE_URL set");
  for (const f of ["index.html", "guide.json", "guide.md", "llms.txt", "robots.txt", "sitemap.xml"]) {
    const t = fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "";
    if (/\/tmp\/|\/home\/|\/root\/|scratchpad|session_[A-Za-z0-9]{8,}/.test(t)) err("dist/" + f, "contains a local path or session identifier");
  }
  if (args.lock && fs.existsSync(args.lock)) {
    const lock = JSON.parse(fs.readFileSync(args.lock, "utf8"));
    for (const s of lock.mustAppearInEveryEdition || []) for (const f of ["index.html", "guide.json", "guide.md", "llms.txt"]) {
      const t = fs.readFileSync(path.join(dir, f), "utf8");
      if (!t.includes(s)) err("dist/" + f, "critical fact missing: " + JSON.stringify(s));
    }
  }
}

// ---------- main ----------
if (args.dist) { checkDist(args.dist); finish(); }

const G = args.new ? readGuide(args.new, "data.js") : null;
if (args["write-lock"]) {
  if (!G) finish();
  const lock = { _comment: "Critical voter-service facts. Only a human editor changes this file, with CODEOWNER review. CI fails if data.js differs from these values.",
    generatedFrom: path.basename(args.new), values: {}, mustAppearInEveryEdition: ["7 a.m.", "7 p.m.", "myinfo.alabamavotes.gov/voterview"] };
  for (const p of LOCK_PATHS(G)) lock.values[p] = get(G, p);
  fs.writeFileSync(args.lock, JSON.stringify(lock, null, 2) + "\n");
  console.log("wrote", args.lock, Object.keys(lock.values).length, "locked values. Review every value against sos.alabama.gov before committing.");
  process.exit(0);
}
const B = args.base ? readGuide(args.base, "base data.js") : null;
if (!G) finish();
const AL = args.allowlist ? loadAllowlist(args.allowlist) : (err("", "--allowlist is required"), null);

// 1. file scope
if (args["changed-files"]) {
  const changed = fs.readFileSync(args["changed-files"], "utf8").split("\n").map(s => s.trim()).filter(Boolean);
  for (const f of changed) {
    if (args.agent && !AGENT_WRITABLE_FILES.has(f)) err(f, "agent pull requests may change only data.js");
    else if (PROTECTED_FILES.some(re => re.test(f))) notes.push(f + ": protected file changed; requires CODEOWNER (human) approval");
  }
}

// 2. schema: no new keys or type changes compared with the approved base
if (B) {
  const sb = shape(B), sn = shape(G);
  for (const [k, types] of sn) {
    if (!sb.has(k)) {
      // Agents can't add fields; an editor's own PR may, and the editor reviews how the page shows it
      if (args.agent) err(k, "new field not in the approved schema (structural changes need a human-made PR)");
      else notes.push(k + ": new field added by a human-made PR");
    }
    else for (const t of types) if (!sb.get(k).has(t)) err(k, "type changed to " + t + " (approved: " + [...sb.get(k)].join("/") + ")");
  }
}

// 3. every leaf: URLs and text
const newDomains = new Set();
walk(G, "", (p, v) => {
  const key = p.split(".").pop().replace(/\[\d+\]$/, "");
  if (key === "url") { const cat = checkUrl(p, v, AL); if (cat && typeof v === "string" && /^https:/.test(v)) newDomains.add(new URL(v).hostname); return; }
  if (p === "canonicalUrl") { if (!/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9\/_-]*$/.test(v)) err(p, "canonical URL must be a plain https URL"); return; } // value is pinned by the lock file
  if (typeof v === "string") checkText(p, v);
});
// Object keys of the topic maps are rendered into attributes: constrain them
Object.keys(G.topics || {}).forEach(k => { if (!TOPIC_RE.test(k)) err("topics." + k, "topic key must match " + TOPIC_RE); });
Object.keys(G.topicNotes || {}).forEach(k => { if (!(k in (G.topics || {}))) err("topicNotes." + k, "unknown topic"); });

// 4. structural invariants the renderer relies on (some fields reach HTML without esc())
const ids = new Map();
const addId = (p, id) => {
  if (typeof id !== "string" || !ID_RE.test(id)) return err(p, "id must match " + ID_RE + " (got " + JSON.stringify(id) + ")");
  if (RESERVED_IDS.has(id) || RESERVED_ID_PREFIX.test(id)) return err(p, "id collides with an id the page itself uses: " + id);
  if (ids.has(id)) return err(p, "duplicate id " + id + " (also at " + ids.get(id) + ")");
  ids.set(id, p);
};
(G.groups || []).forEach((g, gi) => {
  if (!GROUP_IDS.has(g.id)) err("groups[" + gi + "].id", "group id must be one of " + [...GROUP_IDS].join(", "));
  (g.races || []).forEach((r, ri) => {
    const rp = "groups[" + gi + "].races[" + ri + "]";
    addId(rp + ".id", r.id);
    (r.districts || []).forEach((d, di) => {
      if (!Number.isInteger(d.n) || d.n < 1 || d.n > 7) err(rp + ".districts[" + di + "].n", "district number must be an integer 1-7");
    });
    const ns = (r.districts || []).map(d => d.n); if (new Set(ns).size !== ns.length) err(rp, "duplicate district numbers");
  });
});
(G.vote || []).forEach((s, i) => { if (s.id !== undefined) addId("vote[" + i + "].id", s.id); });
// law ids become in-page anchors (#law-<id>); each law needs a phrase to find in candidate text and a hover summary
(G.laws || []).forEach((l, i) => {
  addId("laws[" + i + "].id", l.id);
  if (!Array.isArray(l.match) || !l.match.length || l.match.some(m => typeof m !== "string" || m.length < 3)) err("laws[" + i + "].match", "needs one or more phrases of 3+ characters");
  if (!(l.src || []).length) err("laws[" + i + "]", "law description has no source");
  if (typeof l.short !== "string" || l.short.length < 20 || l.short.length > 160) err("laws[" + i + "].short", "needs a one-line summary (20-160 characters) for the hover tip");
});
const known = new Set([...ids.keys(), "overview", "state", "congress", "amendments", "vote", "find"]);
(G.dates || []).forEach((d, i) => {
  if (!known.has(d.target)) err("dates[" + i + "].target", "points to a missing section: " + d.target);
  if (d.iso && (!ISO_RE.test(d.iso) || isNaN(Date.parse(d.iso)))) err("dates[" + i + "].iso", "invalid ISO date");
});
["callout", "idCard"].forEach(k => { if (G[k] && !known.has(G[k].target)) err(k + ".target", "points to a missing section: " + G[k].target); });
(G.updates || []).forEach((u, i) => { if (!ISO_RE.test(u.date) || isNaN(Date.parse(u.date))) err("updates[" + i + "].date", "invalid ISO date"); });
(G.absenteeStages || []).forEach((s, i) => { if (!ISO_RE.test(s.until)) err("absenteeStages[" + i + "].until", "invalid ISO date"); });
candidatesOf(G).forEach(([race, c]) => {
  const cp = race + " / " + c.name;
  if (!PARTY_CODES.has(c.party) && !c.partyName) err(cp, "party must be one of " + [...PARTY_CODES].join(", ") + " or carry partyName");
  if (c.party && !/^[A-Za-z]{1,12}$/.test(c.party)) err(cp, "party code is rendered into a class attribute; letters only");
  const n = (c.sources || []).length;
  (c.positions || []).forEach((pos, pi) => {
    const ts = Array.isArray(pos.topic) ? pos.topic : [pos.topic];
    ts.forEach(t => { if (!(t in (G.topics || {}))) err(cp + " positions[" + pi + "]", "unknown topic " + JSON.stringify(t)); });
    (pos.s || []).forEach(k => { if (!Number.isInteger(k) || k < 1 || k > n) err(cp + " positions[" + pi + "]", "source reference " + k + " out of range 1-" + n); });
    if (!(pos.s || []).length) err(cp + " positions[" + pi + "]", "position has no source");
  });
});

// 5. critical facts lock
if (args.lock) {
  if (!fs.existsSync(args.lock)) err(args.lock, "lock file missing");
  else {
    const lock = JSON.parse(fs.readFileSync(args.lock, "utf8"));
    for (const [p, v] of Object.entries(lock.values)) if (JSON.stringify(get(G, p)) !== JSON.stringify(v)) err(p, "LOCKED voter-service fact changed. Only a human editor may change it, by editing the lock file in a separate CODEOWNER-reviewed PR.");
  }
}

// 6. diff budget and high-stakes structural changes
if (B) {
  const leaves = o => { const m = new Map(); walk(o, "", (p, v) => m.set(p, v)); return m; };
  const lb = leaves(B), ln = leaves(G);
  let changed = 0; const changedPaths = [];
  for (const [p, v] of ln) if (!lb.has(p) || lb.get(p) !== v) { changed++; changedPaths.push(p); }
  for (const p of lb.keys()) if (!ln.has(p)) { changed++; changedPaths.push(p + " (removed)"); }
  const max = +(args["max-changes"] || 60);
  if (changed > max) err("", changed + " changed values exceeds the per-PR limit of " + max + " (split the PR, or a human raises --max-changes)");
  const names = G2 => new Set(candidatesOf(G2).map(([r, c]) => r + " / " + c.name));
  const nb = names(B), nn = names(G);
  for (const n of nn) if (!nb.has(n)) err(n, "candidate ADDED. Ballot changes need a human-made PR with the Secretary of State's certified list as the source.");
  for (const n of nb) if (!nn.has(n)) err(n, "candidate REMOVED. Ballot changes need a human-made PR with the Secretary of State's certified list as the source.");
  if (args.agent) for (const k of new Set([...Object.keys(B), ...Object.keys(G)]))
    if (!AGENT_WRITABLE_KEYS.has(k) && JSON.stringify(B[k]) !== JSON.stringify(G[k])) err(k, "agent pull requests may not change this section (a human-made PR does)");
  const baseDomains = new Set(); walk(B, "", (p, v) => { if (/\.url$/.test(p) && /^https:/.test(v)) baseDomains.add(new URL(v).hostname); });
  const fresh = [...newDomains].filter(d => !baseDomains.has(d));
  notes.push(changed + " values changed" + (changedPaths.length ? ": " + changedPaths.slice(0, 25).join(", ") + (changedPaths.length > 25 ? ", ..." : "") : ""));
  if (fresh.length) notes.push("domains appearing for the first time (check each by hand): " + fresh.join(", "));
}
finish();

function finish() {
  for (const n of notes) console.log("NOTE  " + n);
  for (const w of warnings) console.log("WARN  " + w);
  for (const e of errors) console.log("ERROR " + e);
  console.log(errors.length ? "FAILED: " + errors.length + " error(s)" : "OK");
  process.exit(errors.length ? 1 : 0);
}
