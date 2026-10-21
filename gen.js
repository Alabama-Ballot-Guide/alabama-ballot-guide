// Builds the machine-readable companions (guide.json, guide.md, llms.txt) from data.js,
// so people and agents always read the same facts.
const fs = require("fs");
const path = require("path");
const dir = __dirname;
// Parse data.js as JSON text. Never require() it: it is written by agents and is untrusted.
const RAW = fs.readFileSync(path.join(dir, "data.js"), "utf8");
const PREFIX = "window.GUIDE = ";
if (!RAW.startsWith(PREFIX) || !RAW.endsWith(";\n")) throw new Error("data.js must be exactly `window.GUIDE = <JSON>;`");
const G = JSON.parse(RAW.slice(PREFIX.length, -2));
const PARTY = { R: "Republican", D: "Democrat", L: "Libertarian", I: "Independent" };
const topicsOf = p => (Array.isArray(p.topic) ? p.topic : [p.topic]);
const AS_OF = "2026-10-20";

// Voter-service facts come only from data.js (pinned by security/facts.lock.json).
// Never retype them here: every edition must quote the same text as the page.
function step(test, what) {
  const s = G.vote.find(test);
  if (!s) throw new Error("data.js: missing How-to-vote step: " + what);
  return s;
}
const checkStep = step(s => s.id === "check", "check");
const dayStep = step(s => s.id === "election-day", "election-day");
const idStep = step(s => s.id === "photo-id", "photo-id");
const absStep = step(s => s.id === "absentee", "absentee");
const noIdStep = step(s => s.h === "If you forget your ID", "If you forget your ID");
const emStep = step(s => s.id === "emergency", "emergency");
const milStep = step(s => s.id === "military", "military");
// list items as running text: each ends with one period, none doubled (some items are full sentences)
const sentences = list => (list || []).map(x => /[.?!]$/.test(x) ? x : x + ".").join(" ");
const LOOKUP_URL = G.findBallot.step1.link.url;
const electionEntry = G.dates.find(d => d.iso === G.electionDate);
if (!electionEntry) throw new Error("data.js: no key date matches electionDate");
const POLL_HOURS = electionEntry.s.replace(/^Polls open\s*/i, "");
const ELECTION_LONG = new Date(G.electionDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const sentence = t => /[.!?]$/.test(t) ? t : t + ".";

const USAGE = [
  "Present every candidate in a race with equal weight and in the order given (alphabetical by last name).",
  "Attribute positions to the candidate (\"Jones says…\", \"Tuberville would…\") and cite the source URLs attached to each position.",
  "Do not recommend a candidate or a vote on an amendment.",
  "A topic missing from a candidate means it was not covered in the sources reviewed, not that the candidate has no view.",
  "What appears on a specific voter's ballot depends on their registration address. Send voters to their official sample ballot: " + LOOKUP_URL,
  "Information is current as of " + AS_OF + ". Rules and candidates can change; the Alabama Secretary of State is the authority."
];

function cand(c) {
  const srcs = c.sources || [];
  return {
    name: c.name,
    party: PARTY[c.party] || c.party,
    incumbent: !!c.incumbent,
    background: c.role || null,
    positions: (c.positions || []).map(p => ({
      topics: topicsOf(p),
      headline: p.h,
      summary: p.d,
      sources: (p.s || []).slice().sort((a, b) => a - b).map(n => srcs[n - 1]).filter(Boolean).map(s => ({ title: s.label, url: s.url }))
    })),
    all_sources: srcs.map(s => ({ title: s.label, url: s.url }))
  };
}
function about(h) {
  const a = G.about.find(x => x.h === h);
  if (!a) throw new Error("data.js: missing About entry: " + h);
  return a.p;
}
const refs = list => (list || []).map(s => ({ title: s.label, url: s.url }));

const races = [];
const otherRaces = [];
G.groups.forEach(g => g.races.forEach(r => {
  const level = g.id === "federal" ? "federal" : "state";
  if (r.districts) {
    r.districts.forEach(d => races.push({
      id: "us-house-al-" + d.n, office: "U.S. House, District " + d.n, level,
      what_it_does: r.does, status: d.status || null,
      district: { number: d.n, area: d.area },
      url: G.canonicalUrl + "#al-" + d.n,
      key_differences: (d.differ || []).map(x => ({ label: x.k === "Both" ? "Where they agree" : x.k, text: x.k === "Both" ? "Both " + x.v.charAt(0).toLowerCase() + x.v.slice(1) : x.v })),
      debates: d.debate || G.defaultDebate, notes: d.note || null, note_sources: refs(d.noteSrc),
      candidates: d.candidates.map(cand)
    }));
  } else if (r.rows) {
    otherRaces.push({
      id: r.id, office: r.office, what_it_does: r.does,
      seats: r.rows.map(row => ({
        seat: row.office, detail: row.sub || null,
        candidates: (row.cands || []).map(c => ({ name: c.name, party: PARTY[c.party] || c.party, incumbent: !!c.incumbent, note: c.note || null }))
      })),
      sources: refs(r.noteSrc)
    });
  } else {
    races.push({
      id: r.id, office: r.office, level, what_it_does: r.does, status: r.status || null,
      url: G.canonicalUrl + "#" + r.id,
      key_differences: (r.differ || []).map(x => ({ label: x.k === "Both" ? "Where they agree" : x.k, text: x.k === "Both" ? "Both " + x.v.charAt(0).toLowerCase() + x.v.slice(1) : x.v })),
      debates: r.debate || G.defaultDebate, notes: r.note || null, note_sources: refs(r.noteSrc),
      candidates: r.candidates.map(cand),
      campaigned_but_not_on_ballot: (r.notOnBallot || []).map(u => ({ name: u.name, party: PARTY[u.party] || u.party, on_ballot: false, note: u.note }))
    });
  }
}));

// Laws and bills: one neutral description each (G.laws), and which races mention them (same matching as app.js)
const lawRes = (G.laws || []).map(l => ({ l, res: (l.match || []).map(m =>
  new RegExp("(^|[^A-Za-z0-9])" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])", "i")) }));
races.forEach(r => {
  const t = [r.notes || "", ...r.key_differences.map(k => k.text), ...r.candidates.flatMap(c => c.positions.flatMap(p => [p.headline, p.summary]))].join("\n");
  r.laws_mentioned = lawRes.filter(x => x.res.some(re => re.test(t))).map(x => x.l.term);
});
const laws = lawRes.map(({ l }) => ({
  id: l.id, name: l.term, kind: l.kind, summary: l.short, description: l.d, sources: refs(l.src),
  mentioned_in: races.filter(r => r.laws_mentioned.indexOf(l.term) > -1).map(r => r.office)
}));

// Topic index: for each topic, which candidates in which races have a stated position, and who doesn't
const topicIndex = {};
Object.keys(G.topics).forEach(t => {
  const rows = [];
  races.forEach(r => {
    const covered = [], missing = [];
    r.candidates.forEach(c => {
      const hits = c.positions.filter(p => p.topics.indexOf(t) > -1);
      if (hits.length) covered.push({ candidate: c.name, party: c.party, headlines: hits.map(h => h.headline) });
      else missing.push(c.name);
    });
    if (covered.length) rows.push({ race_id: r.id, office: r.office, positions: covered, not_covered_in_sources: missing });
  });
  if (rows.length) topicIndex[t] = { label: G.topics[t], races: rows };
});

const json = {
  name: "Alabama Ballot Guide 2026",
  description: "Nonpartisan, sourced summaries of candidates' stated positions in Alabama's " + ELECTION_LONG + " general election, plus the " + G.amendments.length + " statewide amendments and how to vote.",
  as_of: AS_OF,
  language: "en",
  canonical_url: G.canonicalUrl,
  files: { json: "guide.json", markdown: "guide.md", index: "llms.txt" },
  publisher: about("Who made this guide") + " " + about("Official address"),
  methodology: about("How it was made").replace("The number after each point links to the source behind it.", "Each position carries its own source URLs.") + " " + about("What it includes"),
  election: { state: "Alabama", type: "General election", date: G.electionDate, polling_hours: POLL_HOURS + " local time" },
  usage_guidance: USAGE,
  topics: G.topics,
  key_dates: G.dates.map(d => ({ label: d.k, date: d.iso, display: d.v + ", 2026", detail: d.s })),
  congress_map_note: { text: G.groups.find(g => g.id === "federal").intro, sources: refs(G.groups.find(g => g.id === "federal").src) },
  topic_index: topicIndex,
  races,
  judicial_and_board_races: otherRaces,
  laws,
  updates: (G.updates || []).map(u => ({ date: u.date, text: u.text })),
  amendments: G.amendments.map(a => ({
    number: a.n, title: a.title, summary: a.summary, legislative_vote: a.vote,
    supporters_say: a.support, opponents_say: a.oppose, yes_means: a.yes, no_means: a.no, sources: refs(a.src)
  })),
  how_to_vote: G.vote.map(s => ({
    topic: s.h, text: [s.p, sentences(s.list),
      s.deadlines ? s.deadlines.caption + ": " + s.deadlines.rows.map(r => r.h + ", " + s.deadlines.cols[0].toLowerCase() + ": " + r.c[0] + "; " + s.deadlines.cols[1].toLowerCase() + ": " + r.c[1]).join(". ") + ". " + (s.deadlines.note || "") : "",
      (s.ol || []).map((x, i) => "Step " + (i + 1) + ": " + x).join(" "), s.after].filter(Boolean).join(" "),
    deadlines: s.deadlines ? { columns: s.deadlines.cols, rows: s.deadlines.rows.map(r => ({ method: r.h, application: r.c[0], ballot: r.c[1] })) } : undefined,
    links: (s.links || []).map(l => ({ title: l.label, url: l.url }))
  })),
  spanish_essentials: G.spanishGuide ? { title: G.spanishGuide.title, intro: G.spanishGuide.intro, items: G.spanishGuide.items.map(x => ({ topic: x.h, text: x.p })), links: G.spanishGuide.links.map(l => ({ title: l.label, url: l.url })) } : undefined,
  official_resources: [
    { title: "Check registration, district, polling place and sample ballot", url: LOOKUP_URL },
    ...[dayStep, absStep, emStep, milStep, idStep, noIdStep].flatMap(s => (s.links || []).map(l => ({ title: l.label, url: l.url }))),
    ...G.spanish.links.map(l => ({ title: "Spanish: " + l.label, url: l.url }))
  ]
};
fs.writeFileSync(path.join(dir, "guide.json"), JSON.stringify(json, null, 2));

// Markdown edition
const md = [];
md.push("# Alabama Ballot Guide 2026", "");
md.push("> " + json.description, "");
md.push("Updated " + AS_OF + ". Independent and nonpartisan. Candidates are listed alphabetically by last name.", "");
md.push(G.spanish.text + " " + G.spanish.links.map(l => "[" + l.label + "](" + l.url + ")").join(" · "), "");
md.push("## Key dates", "");
json.key_dates.forEach(d => md.push("- **" + d.label + ":** " + d.display + " (" + d.date + "). " + d.detail));
md.push("", "## Guidance for AI assistants", "");
USAGE.forEach(u => md.push("- " + u));
md.push("");
function mdRace(r) {
  md.push("### " + r.office, "");
  if (r.district) md.push("Area: " + r.district.area + ".", "");
  md.push(r.what_it_does + (r.status ? " Status: " + r.status + "." : ""), "");
  if (r.key_differences && r.key_differences.length) { md.push("Where they differ:"); r.key_differences.forEach(k => md.push("- " + k.label + ": " + k.text)); md.push(""); }
  r.candidates.forEach(c => {
    md.push("#### " + c.name + " (" + c.party + (c.incumbent ? ", incumbent" : "") + ")", "");
    if (c.background) md.push(c.background + ".", "");
    c.positions.forEach(p => md.push("- **" + p.headline + "** (" + p.topics.map(t => G.topics[t] || t).join(", ") + "): " + p.summary +
      (p.sources.length ? " Sources: " + p.sources.map(s => "[" + s.title + "](" + s.url + ")").join("; ") : "")));
    md.push("");
  });
  if (r.debates) md.push("Debates: " + r.debates, "");
  if (r.notes) md.push(r.notes, "");
  if (r.note_sources.length) md.push("Sources for these notes: " + r.note_sources.map(s => "[" + s.title + "](" + s.url + ")").join("; "), "");
  if (r.laws_mentioned.length) md.push("Laws and bills mentioned: " + r.laws_mentioned.join("; ") + ". Each is described under \"Laws and bills mentioned\" below.", "");
}
md.push("## Positions by topic", "", "Who has a stated position on each issue. Candidates listed as not covered had no statement on it in the sources reviewed.", "");
Object.keys(topicIndex).forEach(t => {
  md.push("### " + topicIndex[t].label, "");
  topicIndex[t].races.forEach(r => md.push("- " + r.office + ": " + r.positions.map(p => p.candidate + " (" + p.headlines.join("; ") + ")").join(", ") +
    (r.not_covered_in_sources.length ? ". Not covered: " + r.not_covered_in_sources.join(", ") : "")));
  md.push("");
});
md.push("## State races", "");
races.filter(r => r.level === "state").forEach(mdRace);
otherRaces.forEach(o => {
  md.push("### " + o.office, "", o.what_it_does, "");
  o.seats.forEach(s => md.push("- **" + s.seat + "**" + (s.detail ? " (" + s.detail + ")" : "") + ": " +
    s.candidates.map(c => c.name + " (" + c.party + (c.incumbent ? ", incumbent" : "") + ")" + (c.note ? ", " + c.note : "")).join("; ")));
  md.push("");
  if (o.sources.length) md.push("Sources: " + o.sources.map(s => "[" + s.title + "](" + s.url + ")").join("; "), "");
});
const fedGroup = G.groups.find(g => g.id === "federal");
md.push("## Congress", "", fedGroup.intro, "");
if (fedGroup.src) md.push("Sources: " + fedGroup.src.map(s => "[" + s.label + "](" + s.url + ")").join("; "), "");
races.filter(r => r.level === "federal").forEach(mdRace);
md.push("## Statewide amendments", "");
json.amendments.forEach(a => {
  md.push("### " + a.number + ": " + a.title, "", a.summary, "",
    "- Legislature's vote: " + a.legislative_vote, "- Supporters say: " + a.supporters_say, "- Opponents say: " + a.opponents_say,
    "- A yes vote: " + a.yes_means, "- A no vote: " + a.no_means,
    "- Sources: " + a.sources.map(s => "[" + s.title + "](" + s.url + ")").join("; "), "");
});
if (laws.length) {
  md.push("## Laws and bills mentioned", "", "Neutral descriptions of the laws and bills that candidates' entries mention.", "");
  laws.forEach(l => md.push("- **" + l.name + "** (" + l.kind + "): " + l.description +
    (l.sources.length ? " Sources: " + l.sources.map(s => "[" + s.title + "](" + s.url + ")").join("; ") + "." : "") +
    (l.mentioned_in.length ? " Mentioned in: " + l.mentioned_in.join("; ") + "." : "")));
  md.push("");
}
md.push("## How to vote", "");
// same order as the page: text, list as bullets, deadline table, numbered steps, follow-up, links
G.vote.forEach(s => {
  md.push("### " + s.h, "");
  if (s.p) md.push(s.p, "");
  if (s.list) md.push(...s.list.map(x => "- " + x), "");
  if (s.deadlines) md.push(s.deadlines.caption + ":", "", "| | " + s.deadlines.cols.join(" | ") + " |", "| --- | --- | --- |",
    ...s.deadlines.rows.map(r => "| " + r.h + " | " + r.c.join(" | ") + " |"), "", ...(s.deadlines.note ? [s.deadlines.note, ""] : []));
  if (s.ol) md.push(...s.ol.map((x, i) => (i + 1) + ". " + x), "");
  if (s.after) md.push(s.after, "");
  if (s.links) md.push(...s.links.map(l => "- [" + l.label + "](" + l.url + ")"), "");
});
if (G.spanishGuide) {
  md.push("## " + G.spanishGuide.title, "", G.spanishGuide.intro, "");
  G.spanishGuide.items.forEach(x => md.push("- **" + x.h + ":** " + x.p));
  md.push("", ...G.spanishGuide.links.map(l => "- [" + l.label + "](" + l.url + ")"), "");
}
md.push("## Updates", "", "Newest first. Corrections start with \"Correction:\".", "", ...(G.updates || []).map(u => "- **" + u.date + ":** " + u.text), "");
md.push("## About", "");
G.about.forEach(a => md.push("**" + a.h + ".** " + a.p.replace("The number after each point links to the source behind it.", "Each point lists the sources behind it.") + (a.links ? " " + a.links.map(l => "[" + l.label + "](" + l.url + ")").join(", ") + "." : ""), ""));
fs.writeFileSync(path.join(dir, "guide.md"), md.join("\n"));

// llms.txt index
const nCands = races.reduce((n, r) => n + r.candidates.length, 0);
const llms = [
  "# Alabama Ballot Guide 2026",
  "",
  "> Nonpartisan summaries of what candidates in Alabama's " + ELECTION_LONG + " general election say they will do, with a source link for every point. Covers " +
    races.length + " contested statewide and congressional races (" + nCands + " candidates), appeals courts, the State Board of Education, four statewide amendments, and voting rules. Updated " + AS_OF + ".",
  "",
  "Election Day: " + dayStep.p + " " + sentences(dayStep.list),
  "",
  "Canonical page: " + G.canonicalUrl,
  "",
  "## Quick facts",
  "",
  "These lines quote the guide's How to vote section, which is checked against the Alabama Secretary of State.",
  "",
  "- Registration: " + checkStep.p + " " + LOOKUP_URL,
  "- Absentee voting: " + absStep.p + " " + absStep.list.join("; ") + ". " + absStep.ol.map((x, i) => "(" + (i + 1) + ") " + x).join(" ") + " " + absStep.after +
    " " + absStep.links.map(l => l.label + ": " + l.url).join("; ") + ".",
  "- " + emStep.h + " " + emStep.p + " " + sentences(emStep.list) + " " + emStep.after + " " + emStep.links.map(l => l.label + ": " + l.url).join("; ") + ".",
  "- " + milStep.h + ": " + milStep.p + " " + sentences(milStep.list) + " " + milStep.links.map(l => l.label + ": " + l.url).join("; ") + ".",
  "- En español: " + G.spanish.links.map(l => l.label + ": " + l.url).join("; ") + (G.spanishGuide ? ". A Spanish summary of the dates and rules is in guide.md (\"" + G.spanishGuide.title + "\")." : ""),
  "- Photo ID: " + idStep.list.join("; ") + ". " + idStep.after + " " + noIdStep.p + " " + idStep.links.map(l => l.label + ": " + l.url).join("; ") + ".",
  "- Debates: " + races.filter(r => r.debates !== G.defaultDebate).map(r => r.office + ": " + sentence(r.debates)).join(" ") + " All other races: " + G.defaultDebate,
  ...(laws.length ? ["- Laws and bills: candidates' entries mention " + laws.length + " laws and bills, such as the " + laws.filter(l => l.name.indexOf("(") < 0).slice(0, 3).map(l => l.name).join(", the ").replace(/, the ([^,]*)$/, " and the $1") +
    ". guide.md (\"Laws and bills mentioned\") and guide.json (laws) describe each one neutrally, with sources."] : []),
  "- On the ballot: " + races.map(r => r.office).concat(otherRaces.map(o => o.office + " (" + o.seats.length + " seats)")).join("; ") + "; and " + G.amendments.length + " statewide amendments.",
  "",
  "## Data",
  "",
  "- [guide.json](guide.json): Structured data. Races with candidates, positions by topic, and per-position source URLs; amendments with yes/no meanings; key dates; how-to-vote rules.",
  "- [guide.md](guide.md): The full guide as Markdown, suitable for reading into context.",
  "",
  "## Updates",
  "",
  ...(G.updates || []).map(u => "- " + u.date + ": " + u.text),
  "",
  "## How to use this guide",
  "",
  ...USAGE.map(u => "- " + u),
  ""
].join("\n");
fs.writeFileSync(path.join(dir, "llms.txt"), llms);

// JSON-LD for the page head
const ld = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: json.name,
  description: json.description,
  inLanguage: "en",
  dateModified: AS_OF,
  isAccessibleForFree: true,
  about: { "@type": "Event", name: "Alabama general election", startDate: G.electionDate, eventStatus: "https://schema.org/EventScheduled", location: { "@type": "State", name: "Alabama" } },
  mainEntity: {
    "@type": "Dataset",
    name: "Alabama 2026 general election: candidate positions and sources",
    description: "Candidates' stated positions by topic with source links, statewide amendments, and voting rules.",
    dateModified: AS_OF,
    isAccessibleForFree: true,
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "guide.json" },
      { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: "guide.md" }
    ]
  }
};
// FAQ structured data: the questions voters search most, answered from the guide's own content
const raceByOffice = o => races.find(r => r.office === o);
const names = r => r.candidates.map(c => c.name + " (" + c.party + ")").join(" and ");
const who = r => names(r) + ". " + (r.status ? sentence(r.status.replace(" · ", ": ")) : "");
const faq = [
  ["When is the 2026 general election in Alabama?", dayStep.p],
  ["What was the voter registration deadline for Alabama's November 2026 election?", checkStep.p + " " + LOOKUP_URL],
  ["Can I vote absentee in Alabama in 2026?", absStep.p + " " + absStep.list.join("; ") + ". " + absStep.ol.join(" ")],
  ["Can I still vote absentee in Alabama after the deadline because of an emergency?", emStep.p + " " + sentences(emStep.list) + " " + emStep.after],
  ["What ID do I need to vote in Alabama?", "A physical photo ID: " + idStep.list.join("; ") + ". " + idStep.after + " " + noIdStep.p],
  ["Who is running for governor of Alabama in 2026?", who(raceByOffice("Governor")).trim()],
  ["Who is running for U.S. Senate in Alabama in 2026?", who(raceByOffice("U.S. Senate")).trim()],
  ["What amendments are on Alabama's November 2026 ballot?", G.amendments.map(a => a.n + ": " + a.title).join("; ") + ". A yes vote changes the Alabama Constitution; a no vote leaves it as is."]
];
const graph = {
  "@context": "https://schema.org",
  "@graph": [
    Object.assign({}, ld, { "@context": undefined }),
    { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ]
};
fs.writeFileSync(path.join(dir, "ld.json"), JSON.stringify(graph));
console.log("guide.json", fs.statSync(path.join(dir, "guide.json")).size, "guide.md", md.length, "lines;", races.length, "races,", nCands, "candidates");
