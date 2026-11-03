# Phase 0 build spec: post-election mode

This is a complete specification for one human-made pull request to alabamaballotguide.org. It was written on Nov. 3, 2026 (Election Day) from a line-by-line read of the codebase, a sourced fact-check of every date, a four-lens review of the draft, and a three-lens adversarial review of this document against the code. Build from this document. Where it conflicts with docs/ROADMAP.md or an older draft, this document wins.

Deliverable: a pull request from branch `post-election-mode` into `main`, mergeable before 7 p.m. Central on Nov. 3, 2026, that makes the site switch itself to post-election mode at 7 p.m. and gives it a sourced results slot that a human fills later. The site must look and behave exactly as today until 7 p.m.

## 0. Read this first

- Repo layout and rules: README.md, docs/MAINTAINING.md, scripts/validate-data.js (the gate), security/facts.lock.json (locked voter-service facts), security/source-domains.json (URL allowlist). One static page; all content is JSON in data.js (`window.GUIDE = <JSON>;`, canonical form `JSON.stringify(G, null, 2)`); app.js renders; gen.js writes guide.json, guide.md, llms.txt and ld.json; build.py pre-renders in headless Chromium and writes dist/ with a strict CSP (`default-src 'none'`, `connect-src 'none'`, `form-action 'none'`).
- Build and check locally (Node 22, Python 3, the preinstalled Chromium):
  ```
  npm ci --ignore-scripts
  git show main:data.js > /tmp/base-data.js
  node scripts/validate-data.js --base /tmp/base-data.js --new data.js --allowlist security/source-domains.json --lock security/facts.lock.json --max-changes 600
  CHROMIUM_PATH=/opt/pw-browsers/chromium python3 -I build.py
  node scripts/validate-data.js --dist dist --allowlist security/source-domains.json --lock security/facts.lock.json --site-host alabamaballotguide.org
  ```
  Both validator modes and the build pass on the untouched branch; they must pass at the end.
- CI note: pr-check.yml runs main's copy of validate-data.js against this PR (so a PR cannot loosen its own checks). The new validator rules in section 3 therefore run only locally until this PR merges; main's validator will accept the new fields with notes. Run section 3's rules locally and show the output in the PR description.
- Time: all stamps are "YYYY-MM-DDTHH:MM" in America/Chicago, compared as strings (see `nowStamp()` in app.js and `NOW` in gen.js). DST ended Nov. 1, so 7 p.m. Central on Nov. 3 is 01:00 UTC Nov. 4. The daily deploy (`7 6 * * *`) runs at 00:07 Central.
- Human PR limits: at most 600 changed leaves in data.js (pr-check.yml). New fields are allowed in a human PR (the validator notes them). Changing a locked value requires regenerating security/facts.lock.json with `--write-lock` in the same PR; section 4 states the exact expected diff.
- Text rules (validate-data.js `checkText`): no URLs in text fields (links go in `links`/`src`), no `<` or `>`, no Markdown links, at most 1500 characters, and only the allowed non-ASCII characters (`·’‘¿¡ñÑáéíóúüÁÉÍÓÚÜ–—“”§‑…`). A check mark is not allowed in text; use CSS.
- The network in the build and PR environments cannot reach sos.alabama.gov. Nothing in this PR depends on fetching it. Do not enter any result: polls are open.
- Do not change: `vote[]`, `dates[]` (its locked fields are k, v, s, iso, target, pastNote), `callout`, `idCard`, `spanish`, `findBallot.step1.link.url`, `electionDate`, `canonicalUrl`, candidate data, the laws glossary. `absenteeStages` and `spanishGuide` change only as stated in 2.3 and 2.4. The About section changes only as stated in section 11.

## 1. Decisions already made (do not reopen)

1. No new tab or view. Post-election content is a section on the Overview view, deep-linkable as `#results`. A nav link is emitted only in post-election mode, by app.js, and baked into the shell by build.py.
2. The guide never calls a race. Before certification the renderer shows only "unofficial", the as-of time, and the Secretary of State's numbers if the editor entered them, in ballot order with no emphasis. "Elected", "Ratified" and "Failed" appear only when `result.status` is `certified` and no `flags` are set.
3. Results are human-only. In agent mode the validator rejects any change under a `result` key. Result sources may only be sos.alabama.gov or alabamavotes.gov (subdomains included), plus governor.alabama.gov for the amendment proclamation.
4. Milestones never complete by the clock. Only `kind: "deadline"` items get the passed style by time. A milestone is marked done by a human PR that sets `doneOn` and a Secretary of State `src`.
5. The header pill is derived from result statuses and `after.certified`, never from the clock alone: all results pending → `pillPending`; any unofficial → `pill`; all certified → `pillCertified` plus the date.
6. Email or text signup: not in this PR or any phase of the guide itself (see ROADMAP). No form, no external list link.
7. No /2026/ archive URL in this PR.
8. From 7 p.m. to midnight the hero title is "The polls have closed. Here’s what happens next." and the lede begins "If you were in line by 7 p.m., stay in line: you can still vote." (the wording of the locked Election Day step). At midnight `after.switch` changes the title to "Alabama has voted. Here’s what happens next." and drops the sentence. The Spanish note does the same through its own `switch`.
9. The candidate record is frozen from 7 p.m.: once `after` exists, agent PRs may change only `updates` and `heroMeta`.

## 2. data.js changes

Serialize with `JSON.stringify(G, null, 2)` and the exact `window.GUIDE = ` prefix and `;\n` suffix, or the canonical-form check fails.

### 2.1 New top-level key `after`

Copy the object in docs/phase0-after-content.json (without its `_comment`) as `G.after`. Shape summary:

| Field | Type | Locked | Purpose |
|---|---|---|---|
| startsAt | stamp | yes | Mode switch time, "2026-11-03T19:00" |
| eyebrow, title, lede | text | no | Hero copy in post-election mode |
| switch | {at, title, lede} | no | At "2026-11-04T00:00" the title and lede change (same `atNow` rule as vote steps) |
| certifiedLede | text | no | Appended to a renderer-built sentence once `after.certified` exists |
| spanishText | text | no | Replaces `G.spanish.text` on the hero's Spanish line in post-election mode |
| pillPending, pill, pillCertified | text | no | Header pill text (decision 5); the renderer appends the certification date to pillCertified |
| navLabel | text | no | Nav link text, "Results" |
| indexHeading, indexNote | text | no | "What was on your ballot" and the scope line |
| indexCard | {title, sub} | no | The util card that links to `#results` (the link target is fixed in app.js, not data) |
| callouts[2] | {title, text, cta, url or target} | no | Replace the absentee stage and the ID card once no stage is active |
| timeline[5] | see 2.1.1 | fact fields yes | The key-dates grid in post-election mode |
| status | {h, p, links} | no | Heading, paragraph and official links at the top of the Results section |
| steps[6] | vote-step shape with ids `next-…` | yes (whole objects) | Explainer cards |
| voteNotes[3] | [{until?, p}] | no | Note above the How to vote steps; first entry whose `until` is later than now, else the last |
| picksHint, picksEmpty | text | no | My picks sheet hint and empty-list text |
| spanish | {h, p, switch{at, p}} | no | First item rendered inside the Spanish essentials block; its switch drops the stay-in-line sentence at midnight |

2.1.1 Timeline item fields: `kind` ("deadline" or "milestone"), `k`, `v`, `s`, `iso` (YYYY-MM-DD), `target` (optional: a known id), and for deadlines `pastAt` (stamp) and `pastNote`. Milestones may later gain `doneOn` (YYYY-MM-DD) and `src` ([{label, url}] on sos.alabama.gov) by human PR; those two fields are not locked. The five items are: Nov 6 provisional ID (deadline), Nov 10 provisional count and military ballot arrival (milestone), Nov 13 counties certify (milestone), by Nov 25 state certifies (milestone), Jan 18 new officeholders take office (milestone). January 3 and 12 and February 2 are in the "when new officeholders take office" card, not the grid, so the existing five-column `.dates` CSS applies unchanged.

2.1.2 `after.certified` is not seeded (seeding `null` would fail the validator's type check later). When the State Canvassing Board certifies, a human PR adds `"certified": {"at": "YYYY-MM-DD", "src": [{label, url}]}`. Its presence flips the pill, the hero lede, the FAQ wording and the "State certifies" tile.

### 2.2 `result` seeds on the 25 contested items

Add `"result": {"status": "pending"}` to exactly these objects and nothing else:
- `groups[0].races[]` with ids governor, lt-governor, attorney-general, secretary-of-state, treasurer, auditor, agriculture, psc-1, psc-2 (9).
- `groups[1].races[]` id senate (1), and each of `groups[1].races[].districts[]` 1 to 7 (7).
- `groups[0].races[]` id courts, `rows[]` whose office is "Supreme Court, Place 8" (1); id school-board, `rows[]` for Districts 2, 6 and 8 (3). Unopposed rows get no `result`.
- `amendments[]` 1 to 4 (4).

Filled shape (documented here, entered later by human PR):
```
"result": {
  "status": "unofficial" | "certified",      // "pending" until the Nov 4 PR
  "asOf": "YYYY-MM-DDTHH:MM",                // America/Chicago; required when not pending
  "reporting": "67 of 67 counties",           // the Secretary of State's own wording; optional
  "tally": [{"name": "<exact candidate name>", "votes": 123456}],   // races: optional subset before certification, one row per candidate at certification
  "tally": [{"name": "Yes", "votes": n}, {"name": "No", "votes": n}],  // amendments: both rows at certification
  "flags": ["recount", "contest"],            // optional; while non-empty, no Elected/Ratified/Failed words render
  "note": "short text, checked by checkText", // optional, no status words
  "src": [{"label": "...", "url": "https://www.sos.alabama.gov/..."}]  // required when not pending
}
```
The renderer computes percentages. The data never stores "winner", "leading" or "passed".

### 2.3 absenteeStages

- Set `absenteeStages[3].closesAt` to "19:00" (the "Voting on Tuesday, Nov. 3" stage ends when polls close).
- Insert a new stage after it (it becomes index 4), `until` "2026-11-03", no closesAt: title "Polls closed at 7 p.m.", text "If you were in line by 7 p.m., stay in line: you can still vote. Voted a provisional ballot without photo ID? Show a valid ID to your county Board of Registrars by 5 p.m. Friday, Nov. 6.", cta "Election Day details" (absenteeBox maps that cta to #election-day).
- The provisional stage (now index 5) gets `closesAt` "17:00" so the callout ends at 5 p.m. Nov 6, not midnight. Today `absenteeBox` falls back to the last stage forever; section 6 fixes the fallback.
- These changes move locked indices; section 4 states the resulting lock diff.

### 2.4 spanishGuide (locked; regenerated in the same PR)

Keep every existing item; add no new item (the post-election note is `after.spanish`, rendered by app.js in post-election mode only). Where an item already has a `switch` that took effect Nov. 2 at 5 p.m., move that switch's text into the base `p` and replace the `switch` with the post-election one, so each item still has exactly one `switch`.
- "Día de las elecciones": add `switch` {at "2026-11-03T19:00", p "Las elecciones fueron el martes 3 de noviembre. Si estaba en la fila a las 7 p.m., quédese en la fila: todavía puede votar. Los resultados no oficiales los publica el Secretario de Estado (en inglés). No son oficiales hasta que la junta estatal de escrutinio los certifique, a más tardar el miércoles 25 de noviembre."}.
- "Voto en ausencia": base `p` becomes the current switch text; new `switch` {at "2026-11-03T19:00", p "El plazo para votar en ausencia en las elecciones del 3 de noviembre ya pasó. Las boletas de votantes militares y en el extranjero cuentan si tienen matasellos a más tardar del 3 de noviembre y llegan antes del mediodía del martes 10 de noviembre."}.
- "Emergencias después del plazo": base `p` becomes the current switch text; new `switch` {at "2026-11-03T19:00", p "Las solicitudes de emergencia para las elecciones del 3 de noviembre cerraron. Si votó con una boleta provisional, después del 10 de noviembre puede consultar en el sitio del Secretario de Estado (en inglés) si su boleta se contó."}.
- Only characters from the validator's allowlist; no curly quotes other than the listed ones.

### 2.5 Updates and heroMeta

- Prepend to `updates`: {date "2026-11-03", text "From 7 p.m. on Election Day the guide switches to its post-election mode: the overview shows where the Secretary of State posts unofficial results, the dates for counting provisional ballots (Nov. 10), county certification (Nov. 13) and state certification (by Nov. 25), and how recounts, amendments and taking office work. Every candidate’s stated positions and sources stay as a record of what was said before the vote. The guide publishes no counts of its own; results will be added from the Secretary of State and labeled unofficial until the State Canvassing Board certifies them."}. Check it against checkText (no URLs, under 1500 characters).
- `heroMeta[0]` stays "Updated Nov. 3, 2026" (main already carries a Nov. 3 entry from the morning's fact-check PR; the validator ties heroMeta[0] to updates[0].date, and sitemap lastmod and guide.md's "Updated" line follow).

## 3. scripts/validate-data.js changes

Keep the file zero-dependency and keep every existing check. Add:

1. `RESERVED_IDS`: add "results", "resultsH", "after", "whats-next".
2. Register `after.steps[].id` through `addId` before the `known` set is built. Then `known` = the existing set, plus every `after.steps[].id`, plus the literal "results" (a page-owned section id that app.js emits, like "overview"; it stays in RESERVED_IDS so no data id can take it). `after.timeline[].target` (optional) and `after.callouts[].target` must be in `known` when present.
3. `after` checks: `startsAt`, `switch.at` and `spanish.switch.at` match `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/`; `timeline[].kind` in {deadline, milestone}; `timeline[].iso` matches ISO_RE; `pastAt`/`pastNote` only on deadlines; `doneOn` (when present) matches ISO_RE and requires `src` whose hosts match RESULTS_HOSTS; `voteNotes[].until` is a stamp when present; `callouts[]` have exactly one of `url` or `target`. Assert `after.startsAt` is not later than the last absentee stage's cutoff (`until` + "T" + `closesAt`), so the fallback callout can never be a stale deadline.
4. Result schema: `RESULT_STATUS = new Set(["pending","unofficial","certified"])`; `RESULT_FLAGS = new Set(["recount","contest"])`; `RESULTS_HOSTS = /(^|\.)(sos\.alabama\.gov|alabamavotes\.gov|governor\.alabama\.gov)$/`. A function `checkResult(path, result, candidateNames, kind)` enforces: status in the enum; when status is not pending, `asOf` is a stamp and `src` is non-empty with every hostname matching RESULTS_HOSTS; `tally[].name` is one of `candidateNames` (for amendments only "Yes" and "No") with no duplicates; when status is unofficial, `tally` is optional and may hold a subset; when status is certified, `tally` is present with exactly one row per candidate (both "Yes" and "No" for amendments) and `src` includes at least one sos.alabama.gov URL; `tally[].votes` are non-negative integers; `flags` ⊆ RESULT_FLAGS. Call it for the 25 objects listed in 2.2 (full races, districts, rows with more than one candidate, amendments). A `result` on an unopposed row or anywhere else is an error.
5. Exempt every path containing `.result.` or ending in `.result` from the base-shape comparison in step 2 (otherwise the first filled result is "a new field"); `checkResult` is the schema for that subtree.
6. All non-pending `result.asOf` values in the file must be equal (one results pass covers every race, so no race is updated ahead of another).
7. Agent mode (`--agent`): any changed leaf whose path matches `/\.result(\.|\[|$)/` is an error ("results are entered by the editor from the Secretary of State"). And when `G.after` exists in the base, the agent-writable key set becomes exactly {updates, heroMeta}: any other top-level key whose JSON differs from the base is an error ("the pre-election record is frozen; corrections are human PRs labeled Correction").
8. `LOCK_PATHS`: push "after.startsAt"; for each timeline item, "after.timeline[i].{kind,k,v,s,iso,pastAt,pastNote,target}" when defined; for each step, "after.steps[i]" (whole object, like vote steps). Do not lock `doneOn`, `src`, hero copy, callouts, status, voteNotes, picksHint, picksEmpty or spanish.
9. `PROTECTED_FILES`: widen `/^og-card\.html$/` to `/^og-card(-after)?\.html$/`.
10. Dist check (detection only, no new flag): if the built index.html matches `/<main[^>]*data-mode="after"/`, require `id="results"` between `<main` and `</main>`. The three `<script>` tags rule still holds (nothing new is added).

## 4. security/facts.lock.json

After data.js and the validator changes: `node scripts/validate-data.js --write-lock --new data.js --lock security/facts.lock.json` (note: `--write-lock` exits before printing validation errors, so run the normal validator against main's data.js first and again after). Expected `git diff security/facts.lock.json`: every `after.*` line added; `absenteeStages[4].until`, `.title`, `.text` modified (the old provisional-stage values move to index 5, whose three lines are added); `spanishGuide` is one whole-object value, so it appears as one modified line; nothing else changes. `closesAt` is not a lock path, so the 19:00 and 17:00 edits do not appear. Review each added or modified value against the Secretary of State's 2026 administrative calendar and the statutes in appendix A before committing. Confirm `mustAppearInEveryEdition` ("7 a.m.", "7 p.m.", "myinfo.alabamavotes.gov/voterview") is unchanged.

## 5. security/source-domains.json

Add `"governor.alabama.gov"` to the `official` domains (that category already has includeSubdomains true; the host is the governor's newsroom, where proclamations and special-election writs are published). Nothing else changes; the campaign-domain decision is Phase 1.

## 6. app.js changes

Keep every existing behavior in pre-election mode. Every new string goes through `esc()`, every external link through `ext()`, no inline handlers, no new external resources (CSP). The pre-render asserts zero page errors, so guard every `G.after` access.

6.1 Clock and mode
- `nowStamp()`: if `window.__NOW` is a string, return it (set only by the pre-render, section 9).
- After `G.vote = G.vote.map(atNow)`: `if (G.after) { G.after = atNow(G.after); G.after.spanish = atNow(G.after.spanish); }` (apply their `switch` fields), then `var AFTER = !!(G.after && nowStamp() >= G.after.startsAt);` and `var CERT = AFTER && !!G.after.certified;`.
- Date helpers: extract `updatesList`'s formatter as `fmtDate(iso)` ("Nov 25, 2026"). Add `fmtStamp(stamp)` = `fmtDate(date part) + ", " + h:mm a.m./p.m. + " Central"` (stamps are already Central).
- Result status counts: `resultsState()` returns {pending, unofficial, certified} counted over the 25 result objects (walk groups, districts, rows with cands.length > 1, amendments).
- Optional: if `G.after` exists and `startsAt` is within the next 24 hours, a one-shot `setTimeout` at `startsAt` that re-runs `render()`, then `applyTopic()`, `refreshPicks()` and `applyMine()`; document-level listeners are not re-added. If this is risky, skip it; a reload flips the page.

6.2 Shared helpers
- `stepCard(s)`: the body of today's `G.vote.map` callback (h, p, list, emergency pointer only when `s.id === "absentee"`, deadlines table, ol, after, links). Used by the How to vote steps and `after.steps`. Steps without `p` (the Election Day ID step, `next-office`) already render fine.
- `calloutHtml(c, icCls)`: today's callout anchor markup; when `c.url` exists render with `ext()`'s attributes (target _blank, rel noopener, the sr-only "(opens in new tab)"), else `href="#" + c.target`.
- `resultBox(res, names, kind)`: returns "" when `!res || res.status === "pending"`. Otherwise a `<div class="result">` with a caption built by the renderer: "Unofficial count from the Secretary of State, as of " + fmtStamp(asOf) + (reporting ? ", " + reporting : "") or, when `CERT`, "Certified by the State Canvassing Board, " + fmtDate(after.certified.at). If `res.tally` exists, a table in the `.deadlines` style (`<table>`, `<caption>`, `th scope="col"` Candidate/Votes/Percent, `th scope="row"` names in the race's existing order, `td data-label`), percentages computed from the tally total to one decimal (omit the Percent column when the total is 0), rows in ballot order with no emphasis before certification. When `CERT` and `flags` is empty and there is a unique highest row, that row gets class `lead` and a visually hidden "(elected)"; ties get no lead. If no tally, one line "See the Secretary of State’s unofficial results." Then `res.note` (if any), flags rendered as a `.status` pill ("Recount" / "Contest"), and `Sources: …` through `ext()`. Nothing is colored by party or by lead.

6.3 render(): hero
- In AFTER mode: eyebrow/title/lede from `G.after` (after `atNow`); when `CERT`, lede = "Certified by the State Canvassing Board on " + fmtDate(certified.at) + ". " + `G.after.certifiedLede`. `heroMeta` unchanged. The Spanish line uses `G.after.spanishText` instead of `G.spanish.text`, still followed by the `#espanol` link and the two external links.
- Key dates: in AFTER mode render `G.after.timeline` instead of `G.dates`. Deadlines: today's `.past` logic with `pastAt`/`pastNote`. Milestones: class `done` when `doneOn` is set (never by clock); `s` shows "Done " + fmtDate(doneOn) + ". " + the original `s`; the "State certifies" tile shows `v` as "Certified " + fmtDate(certified.at) when `CERT`. Items without `target` render as a `<div class="date">`, not an anchor. Keep the five-column grid.
- Callouts: `var last = G.absenteeStages[G.absenteeStages.length - 1]; var stageOn = nowStamp() < last.until + "T" + (last.closesAt || "24:00");` First callout: `stageOn || !AFTER ? absenteeBox(now) : calloutHtml(G.after.callouts[0], "")`. Second callout: `AFTER ? calloutHtml(G.after.callouts[1], "id") : calloutHtml(G.idCard, "id")`.

6.4 render(): index and Results section
- Heading: `AFTER ? G.after.indexHeading : "On your ballot"`; in AFTER mode add `<p class="index-note">` with `indexNote` under the heading, and a util card from `indexCard` with `href="#results"` before the existing Amendments and How to vote cards; the How to vote card's subtitle becomes "Rules for the Nov. 3 election" in AFTER mode.
- After the index (still inside `#view-overview`), when AFTER: `<section class="results" id="results" aria-labelledby="resultsH"><div class="wrap"><h2 id="resultsH">…status.h…</h2><p class="group-intro">…status.p…</p><p class="links">…status.links via ext()…</p><div class="steps">` + `G.after.steps.map(stepCard)` + `</div></div></section>`. Do not give it class `group`: `applyTopic()` hides any `.group` without a visible `.race` when an issue chip is active, and `topic` persists across tabs. Set `data-mode="after"` on `#content` in AFTER mode (the dist check reads it).

6.5 Races and amendments
- `card()` gains a `result` argument. Gate only the `<button class="pick">` on `STATIC || AFTER` (keep `.empty-topic`; `applyTopic` reads it unguarded). When `CERT`, `result.flags` is empty and the candidate's name equals the unique highest tally row, add `<span class="badge">Elected</span>` after the name (same style as Incumbent). Nothing before certification.
- `fullRace` and each district panel in `districtsRace` insert `resultBox(result, names, "race")` directly after the race head (before "Where they differ"). In `rowsRace`, contested rows append the box inside `.row .c` after the candidate `<div>`s, and when `CERT` (same conditions) the elected name's span gets the Elected badge. Amendments insert `resultBox(a.result, ["Yes","No"], "amendment")` after the summary; when `CERT` and `flags` is empty, the amendment eyebrow gains " · Ratified" or " · Failed" from the tally, never before.

6.6 How to vote, picks, Spanish
- Above the steps in AFTER mode: `<p class="vote-note">` with the first `voteNotes` entry whose `until` is later than `nowStamp()`, else the last.
- Picks sheet: hint `AFTER ? G.after.picksHint : today's text`; empty-list text `AFTER ? G.after.picksEmpty : today's text`.
- `spanishGuide()`: in AFTER mode prepend `<dt>after.spanish.h</dt><dd>after.spanish.p</dd>` inside the existing `<dl>` (the locked items follow, with their own switches applied by `atNow`).

6.7 Header
- Countdown pill: in AFTER mode, from `resultsState()`: all pending → `pillPending`; any unofficial (and not all certified) → `pill`; all certified → `pillCertified + " " + fmtDate(certified.at)` (if `after.certified` is missing while all are certified, use `pillCertified` alone). Otherwise today's logic.
- Nav link: in AFTER mode, if `document.querySelector('.nav a[href="#results"]')` is null, append `<a href="#results">` + navLabel + `</a>` to `.nav` after "How to vote". The pre-render captures the nav (section 9), so the live page must not add a second link; the null check is what prevents that.

6.8 Routing: nothing is added to `VIEWS` (results is a section, not a view). The router already handles `#results` and `#next-…` ids inside the overview view.

## 7. shell.html

CSS only; no markup change (the nav link and pill are baked by build.py).
- `.dates .date.done .v { color: var(--muted); }` and `.dates .date.done .k::before { content: "✓ "; color: var(--accent); }` (no strikethrough for milestones; `.past` keeps its strikethrough for deadlines).
- `.index-note { margin-top: 10px; color: var(--muted); max-width: 70ch; font-size: .9375rem; }`
- `.results { padding-top: 40px; } .results h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(1.9rem, 4vw, 2.5rem); letter-spacing: -.015em; line-height: 1.1; } .results .links { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 10px; } .results .links a { font-weight: 600; }`
- `.result { margin-top: 16px; }` plus `.result table` reusing the `.deadlines` rules (add `.result` to those selectors), `.result tr.lead th, .result tr.lead td { font-weight: 700; }`, `.result caption` as `.deadlines caption`, `.result .ref-inline` for sources; `.row .c > .result { display: block; flex-basis: 100%; }` so the row flex rule does not reflow the table.
- `.vote-note { margin-top: 12px; color: var(--muted); max-width: 70ch; }`
- Forced-colors block: nothing new is needed; `.badge` and `.status` are already covered.

## 8. gen.js changes

- `NOW`: honor `process.env.GUIDE_NOW` when it matches the stamp regex; otherwise today's IIFE. Apply `atNow` to `G.after` and `G.after.spanish`; `const AFTER = !!(G.after && NOW >= G.after.startsAt); const CERT = AFTER && !!G.after.certified;`
- `key_dates`: `display: d.v + ", " + d.iso.slice(0, 4)` (the current hard-coded ", 2026" would be wrong for 2027 items). Do not append the timeline to `key_dates` (guide.md prints key_dates, and the timeline is printed once in its own section).
- `election`: add `phase: AFTER ? "after" : "before"` and `results: {pending, unofficial, certified, all_certified}` counted over the 25 result objects, plus `results_source: {unofficial_url, certified_url, note: "This guide publishes no counts of its own; results come from the Alabama Secretary of State and are unofficial until the State Canvassing Board certifies them."}`.
- `after` block in guide.json when AFTER: `{status: {heading, text, links}, timeline: [{label, date, display, detail, kind, passed (deadlines), done_on}], what_happens_next: steps mapped like how_to_vote, spanish: {topic, text}}`. The `what_happens_next` mapper must tolerate a missing `p` (the existing how_to_vote mapper already does, via filter(Boolean)).
- Per race and amendment (including `judicial_and_board_races[].seats[]`): `result` (status, as_of, reporting, tally with computed percent, flags, note, sources) when present and not pending.
- Description tense in AFTER mode: "said they would do" instead of "say they will do"; USAGE gains "Results marked unofficial can change until the State Canvassing Board certifies them (statutory deadline Nov. 25, 2026); quote the as-of time when you cite one. This guide never calls a race."
- guide.md: in AFTER mode insert "## After the election" right after "## Key dates" with the status text, the official links, the five timeline items as a list and the six cards (same formatting as How to vote); add the Spanish note to the Spanish section. llms.txt: an "After the election" paragraph after the "Election Day:" line, and the results_source URLs in Quick facts.
- FAQ (ld.json): in AFTER mode rephrase the time-bound questions to the past tense with unchanged answers ("When was the 2026 general election in Alabama?", "What was the voter registration deadline…", "Could I vote absentee…", "Who ran for governor…", "Who ran for U.S. Senate…"); add "When will Alabama certify the 2026 election results?" (answer from the certification card: within 22 days, by Nov. 25, 2026; the Secretary of State posts the certified results), "What happens after Alabama’s Nov. 3, 2026 election?" (from the status text and timeline), and "What are Alabama’s recount rules?" (from the recounts card). When an amendment's result is unofficial: "What are the unofficial results for Alabama’s Statewide Amendment N?" answered "Unofficial results from the Alabama Secretary of State as of {as_of}: Yes {n} ({pct}%), No {n} ({pct}%). Results are unofficial until certified, by Nov. 25, 2026." When certified and unflagged: "Did Alabama’s Statewide Amendment N pass?" answered "Certified by the State Canvassing Board on {date}: …". Per race, "Who won …?" only when certified and unflagged, composed by code from the tally and the source URL, never from a free-text note.
- `AS_OF` and `UPDATED` logic unchanged.

## 9. build.py changes

9.1 Mode: at the very top, before the gen.js subprocess call, read `GUIDE_NOW` and exit if it is set but does not match `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$` (otherwise gen.js would write editions in the wrong mode before build.py stops). Then `from zoneinfo import ZoneInfo`; `NOW = GUIDE_NOW or datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%dT%H:%M")`; `AFTER = bool(G.get("after")) and NOW >= G["after"]["startsAt"]`; `CERT = AFTER and bool(G["after"].get("certified"))`.
9.2 Pass the clock to the pre-render: in `_prerender.js`, `p.addInitScript(n => { window.__PRERENDER = true; if (n) window.__NOW = n; }, process.env.GUIDE_NOW || '')`. Pass `GUIDE_NOW` through `env`.
9.3 Bake the header: the pre-render `evaluate` also returns `countdown: document.getElementById('countdown').textContent` and `nav: document.querySelector('.nav').innerHTML`. build.py replaces the exact shell strings `<span class="countdown" id="countdown">Election Day · Nov 3</span>` and the `<nav class="nav" …>…</nav>` inner HTML with the escaped/returned values (assert the markers exist). Do this before the CSP hashes are computed (they already are, at the end).
9.4 Description and share card: `DESC_AFTER = "Alabama’s Nov. 3, 2026 election: where the Secretary of State posts results, when they become official, what happens next, and nonpartisan, sourced summaries of what the statewide and congressional candidates said."`; `DESC = DESC_AFTER if AFTER else DESC`. Add `og-card-after.html` (copy of og-card.html with h1 "Alabama has voted.", p "Results, certification and what’s next after the Nov. 3, 2026 election.", foot "Statewide and congressional races", "4 amendments", "What’s next", ovals all filled) and render it instead of og-card.html when AFTER. Keep `<title>` and og:title.
9.5 Mark the mode: add `data-mode="after"` to `<main id="content">` in the built page when AFTER (app.js sets the same attribute at render, 6.4), so the dist check and the monitor can see it.
9.6 404 text: change the sentence to "The guide covers the statewide and congressional races and the four statewide amendments on Alabama’s Nov. 3, 2026 ballot." (the current "every race and amendment" overclaims).
9.7 README file table: add og-card-after.html.

## 10. Workflows

- .github/workflows/deploy.yml: under `schedule`, add one-off lines, each marked for removal after it fires: `- cron: "12 1 4 11 *"` (7:12 p.m. CST Nov 3: first post-election build), `- cron: "5 23 6 11 *"` (5:05 p.m. CST Nov 6: provisional-ID callout ends), `- cron: "5 18 10 11 *"` (12:05 p.m. CST Nov 10: vote note changes). Only JS clients flip at the minute; the no-JS page, guide.json, guide.md and llms.txt flip at the next build, which these crons provide. The editor also runs `workflow_dispatch` right after 7 p.m. on Nov 3 as a backstop. Merge the PR before 7 p.m.; the mode switch guarantees the pre-election page shows until then.
- .github/workflows/monitor.yml: change the comment "remove after Nov. 10, 2026" to "keep through Dec. 1, 2026 (results, certification, recount window)". No behavior change.

## 11. Docs

- docs/MAINTAINING.md: (a) replace the "update loop (daily at 6:45 a.m. Central, Oct. 21 to Nov. 2)" section with a note that the loop ran through Nov. 2 and is off until the editor restarts it for the 2027 session; (b) add "After Election Day": the candidate record is frozen; agent PRs may change only `updates` and `heroMeta`; only a human PR labeled "Correction" may change positions, sources, differ lines or amendment arguments; (c) add "Results": numbers only from the Secretary of State; the renderer adds every status word; the guide never calls a race; agents never edit `result` (they may open an issue when the Secretary of State posts certified results, and draft the Updates line); one PR fills every race and amendment with one as-of stamp; each refresh (Nov 4, Nov 10, Nov 13, certification) adds a dated Updates entry; a count that changes after publication gets a "Correction" line; status certified only with the certification page, newsroom release or certified PDF as source; a recount or contest is noted only from the Secretary of State, a court docket or the canvassing board's own notice, with a `flags` entry and status unchanged; milestones get `doneOn` only with a Secretary of State source; (d) add "Who may change what" (a table: `after` human, locked in part; `result` human; candidate and amendment text human only until Phase 3; `updates` and `heroMeta` agent or human); (e) the Nov 4 morning runbook: open the Secretary of State's election-night page for Nov 3 from the ENR list page, set status unofficial on all 25 items with the same `asOf`, optional tallies with the counties-reporting text, src = that page (www2.alabamavotes.gov is allowlisted through alabamavotes.gov), optionally point `after.callouts[0].url` at that page, Updates entry template "Results: unofficial statewide totals from the Secretary of State as of …", run both validator modes and the build, rerun the manual balance count (positions per candidate by topic) and the no-JS render check in 12.8; (f) how to preview either mode with `GUIDE_NOW`.
- docs/ROADMAP.md is the phased plan (already written). README's "How changes are made" paragraph gains one sentence pointing at it.
- About section (human-only, no lock change): add one entry {h "Where results come from", p "Results on this guide are the Alabama Secretary of State’s numbers, labeled unofficial until the State Canvassing Board certifies them. This guide never calls a race."} at the end of `about`, and in the "Your picks stay private" entry change "The ovals let you note choices as you read." to "The ovals let you note choices as you read before the election." (the ovals are hidden in post-election mode).

## 12. Verification (all must pass before the PR is opened)

1. `node --check app.js gen.js`.
2. Validator on data.js against main's data.js with `--max-changes 600`: OK, with notes only for new fields. Leaf count expected around 230.
3. Pre-election mode unchanged: `git worktree add /tmp/abg-main main`, `npm ci --ignore-scripts` there, build both trees with `GUIDE_NOW=2026-11-03T18:59 CHROMIUM_PATH=/opt/pw-browsers/chromium python3 -I build.py`, extract `<main …>…</main>` from each `dist/index.html` and diff: they must be identical (main already shows "Updated Nov. 3, 2026"). The footer (`#about`) differs by the new Updates line and the About edits; that is expected. Run the dist validator on the branch build.
4. `GUIDE_NOW=2026-11-03T19:30 … build.py` then the dist validator: `<main data-mode="after">` present; hero title "The polls have closed…" and the stay-in-line sentence; the "Polls closed at 7 p.m." callout is first and "What happens next" second; `id="results"` and the six `next-…` cards are inside `<main>` (no-JS path); the baked nav contains exactly one Results link; the pill reads "Polls closed · results pending"; guide.md has "## After the election"; ld.json has the past-tense and certification questions; the three locked strings ("7 a.m.", "7 p.m.", "myinfo.alabamavotes.gov/voterview") are present in all four files. Then load the built page in a browser with JS on and confirm the nav still has exactly one Results link.
5. `GUIDE_NOW=2026-11-04T08:00`: title "Alabama has voted…", no stay-in-line sentence in English or Spanish; callouts are [provisional-ID stage (href #forget-id), "What happens next" (href #results)]; no external callout. `GUIDE_NOW=2026-11-06T17:01`: callouts are ["Unofficial results" (target _blank to the sos.alabama.gov ENR list page), "What happens next"]; the Nov 6 tile is struck through.
6. `GUIDE_NOW=2026-11-10T12:01`: the vote note no longer mentions Nov 10; the Nov 10 tile is not marked done (no `doneOn`).
7. Results rendering, on a temporary copy of data.js (never committed): fill one full race (governor) and one row (Supreme Court, Place 8) and one amendment with `status: unofficial`, the same `asOf`, a tally and a src on www2.alabamavotes.gov. Expect: human validator OK; result tables with captions containing "Unofficial" and no `lead` row, no Elected badge; `node scripts/validate-data.js --base data.js --new /tmp/copy.js --agent --allowlist … --lock …` fails with the results error. Then set `status: certified`, full tallies, a sos.alabama.gov src and `after.certified`: expect "Elected" on the two winners (card and row), " · Ratified" or " · Failed" on the amendment, the certified pill with the date, and the "Did … pass?" and "Who won …?" FAQ entries. Add `flags: ["recount"]` to one: its Elected badge and eyebrow suffix disappear and a "Recount" pill shows.
8. Filter regression: on the AFTER build with JS, choose an issue chip on State races, then open Overview: `#results` is visible.
9. Phone (375px) and tablet (800px) renders of the AFTER build, with and without JavaScript, using the preinstalled browser, for example:
   ```
   node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});for(const [w,js] of [[375,true],[375,false],[800,true]]){const p=await (await b.newContext({viewport:{width:w,height:900},javaScriptEnabled:js})).newPage();await p.goto('file://'+process.cwd()+'/dist/index.html');await p.screenshot({path:'/tmp/abg-'+w+(js?'-js':'-nojs')+'.png',fullPage:true});}await b.close();})()"
   ```
   Check the five-tile grid, the result table stacked by `data-label`, and the nav strip with six links scrolling sideways.
10. Lock diff exactly as section 4 states.
11. Spanish text passes the character allowlist (the validator will say so).

## 13. Election-week runbook (after merge)

- Nov 3, before 7 p.m.: merge; confirm the pr-check preview artifact (real clock, pre-election) looks unchanged.
- Nov 3, 7:12 p.m. CST: the one-off deploy runs; confirm the live page flipped (`data-mode="after"`); run `workflow_dispatch` if it did not.
- Nov 4, 7 to 9 a.m.: Drop B results PR (section 11e). Two-person check of every number against the Secretary of State's page.
- Nov 6, 5 p.m.: the provisional-ID callout ends (JS clients at once; the baked page at the 5:05 p.m. one-off build).
- Nov 10 and Nov 13: refresh tallies if entered; set `doneOn` and a Secretary of State `src` on the Nov 10 and Nov 13 milestones once the Secretary of State confirms them; dated Updates entries.
- Nov 13 to 15: watch for recount petitions; add `flags: ["recount"]` with a source if one is filed.
- Certification day (by Nov 25): Drop C: status certified on all 25 items from the certified PDF, `after.certified`, `doneOn` on the state tile; within 72 hours watch for an automatic recount; link the governor's proclamation for the amendments when it appears on governor.alabama.gov.
- Remove the one-off crons in the next PR after each fires.

## Appendix A: sources for every date and rule

| Fact | Rule | Citable URL (allowlisted) |
|---|---|---|
| Provisional voters without ID: show ID by 5 p.m. Friday after the election (Nov 6); otherwise not counted | Ala. Code § 17-10-2(c) | https://law.justia.com/codes/alabama/title-17/chapter-10/section-17-10-2 ; https://www.sos.alabama.gov/sites/default/files/election-2026/PhotoVoterIDGuide.pdf |
| Board of Registrars certifies provisional voters; canvassing board counts provisional ballots from noon seven days after the election (Nov 10); results posted at the courthouse; free-access status check | § 17-10-2(e),(f),(g) | https://www.sos.alabama.gov/sites/default/files/election-2026/AdminCalendar%20-2026.pdf ; https://alison.legislature.state.al.us/files/pdf/lsa/ALI/election_handbook/Elect_Hndbk_20th_edition/chapters/law-institute-final-chapter-10.pdf ; https://myinfo.alabamavotes.gov/voterview |
| Military and overseas ballots: postmarked by Election Day, received by noon Nov 10 | locked vote[] military step (FVAP and SoS) | https://www.fvap.gov/uploads/FVAP/States/alabama.pdf |
| County canvassing board (probate judge, sheriff, circuit clerk) meets at noon on the second Friday after the election (Nov 13); certification signed by two members, posted, sent to the Secretary of State | § 17-12-15, § 17-12-16, § 17-12-9 | https://law.justia.com/codes/alabama/title-17/chapter-12/section-17-12-16/ ; https://law.justia.com/codes/alabama/title-17/chapter-12/section-17-12-9/ ; SoS 2026 admin calendar (above) |
| State canvass: Governor, Secretary of State, Attorney General certify within 22 days (by Nov 25); 2024 certified Nov 26; 2022 Nov 28 | § 17-12-17 | https://law.justia.com/codes/alabama/title-17/chapter-12/section-17-12-17/ ; https://www.sos.alabama.gov/newsroom/alabama-state-canvassing-board-certifies-2024-general-election-results ; https://www.sos.alabama.gov/newsroom/state-canvassing-board-certifies-november-8-election-results |
| Automatic recount at 0.5% or less of votes cast; begins within 72 hours after certification; waivable in writing (the 24-hour window is confirmed in the statute text only for county offices); certification amended | § 17-16-20 | https://law.justia.com/codes/alabama/title-17/chapter-16/article-2/section-17-16-20/ ; https://ballotpedia.org/Recount_laws_in_Alabama |
| Requested recount: petition within 48 hours after the county canvass; petitioner posts security; a changed outcome needs an election contest | § 17-16-21 | https://law.justia.com/codes/alabama/title-17/chapter-16/article-2/section-17-16-21/ |
| Amendment approved by a majority of those voting on it is part of the constitution; result made known by the governor's proclamation; 2022 proclamation on certification day | Ala. Const. § 284 | https://law.justia.com/constitution/alabama/CA-245838.html ; https://www.sos.alabama.gov/sites/default/files/sample-ballots/2026/gen/2026GeneralElectionStatewideBack.pdf |
| Four statewide amendments certified by the SoS Aug 26, 2026; acts 2026-341 (SB271), 2026-378 (HB380), 2026-379 (HB511), 2026-424 (SB5) | SoS 2026 election page | https://www.sos.alabama.gov/alabama-votes/voter/election-information/2026 ; https://www.sos.alabama.gov/sites/default/files/2026-08/FBCStatewideAmendment-1.pdf (…-2, -3, -4) |
| Unofficial results on election night; certified results on the 2026 election page | SoS practice | https://www.sos.alabama.gov/alabama-votes/voter/enr-current-list ; https://www.sos.alabama.gov/alabama-votes/voter/election-information/2026 |
| Legislators' terms begin the day after the general election; oath at the organizational session by practice (2023) | Ala. Const. § 46 | https://ballotpedia.org/Alabama_State_Senate (rule stated); practice: https://yellowhammernews.com/legislature-organizes-for-quadrennium |
| Terms of Congress begin at noon Jan 3 | U.S. Const. Amend. XX | https://constitution.congress.gov/constitution/amendment-20/ |
| Organizational session on the second Tuesday in January (Jan 12, 2027), up to 10 days, no bills; 2027 Regular Session Feb 2; 30 meeting days within 105 calendar days | Ala. Code § 29-1-4; Ala. Const. Amend. 339 | https://alison.legislature.state.al.us/legislature-sublanding-page ; https://law.justia.com/codes/alabama/2019/title-29/chapter-1/article-1/section-29-1-4 ; https://www.alreporter.com/2026/04/21/alabama-2026-legislative-report-sine-die/ |
| Seven statewide officers take office the first Monday after the second Tuesday in January (Jan 18, 2027) | Ala. Const. § 116; Ala. Code § 36-3-1 | https://law.justia.com/codes/alabama/title-36/chapter-3/section-36-3-1/ ; https://ballotpedia.org/Alabama_Governor ; https://1819news.com/news/item/ag-marshall-confirms-decision-to-forgo-2026-gubernatorial-bid |
| Aug 24, 2027 municipal elections: Montgomery, Mountain Brook, Scottsboro, Talladega | SoS upcoming elections | https://www.sos.alabama.gov/alabama-votes/voter/upcoming-elections |
| Municipal runoff on the fourth Tuesday after the election | § 11-46-55(d) as amended 2026 | https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2026RS/SB42-enr.pdf |
| Registration closes 14 days before an election (deadline the 15th day before) | § 17-3-50 | law.justia.com, Title 17, Chapter 3, Section 17-3-50 (the exact path was not retrievable from the build network; confirm before citing) |
| Primary on the first Tuesday in March in presidential years (Mar 7, 2028); runoff the fourth Tuesday after; 2024's April 16 runoff was a one-time law | § 17-13-3; § 17-13-18 | https://law.justia.com/codes/alabama/2019/title-17/chapter-13/article-1/section-17-13-3/ ; https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2025RS/HB258-enr.pdf |
| Candidate qualifying closes 116 days before the primary; parties certify 82 days before | § 17-13-5 | https://www.alreporter.com/2023/09/12/algop-announces-candidate-qualifying-dates-for-2024-election |
| Legislative vacancies: governor must call a special election; no fixed timeline; vacancies on or after Oct 1 of the third year stay open to the next general | Ala. Const. § 46; § 17-15-3 | https://law.justia.com/codes/alabama/title-17/chapter-15/section-17-15-3/ ; https://ballotpedia.org/Alabama_Legislative_Vacancies_Amendment_(2018) |

Not allowlisted, do not cite in data.js: law.counselstack.com, verifiedvoting.org, syfert.com, codes.findlaw.com, nass.org, ncsl.org, almonline.org, parcalabama.org, law.cornell.edu, vote411 (its "official results around Nov 13" line conflicts with the statute).

Open verification items for the editor: read the general-election page of the SoS 2026 administrative calendar PDF to confirm the Nov 13 county row (one search summary read it as Nov 11; the statute's arithmetic gives Nov 13); confirm Feb 2, 2027 against Act 2023-224's text; confirm the municipal runoff interval against the enrolled act.
