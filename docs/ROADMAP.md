# Alabama Ballot Guide: after Election Day

A phased plan for keeping alabamaballotguide.org useful from the night of Nov. 3, 2026 through the Nov. 7, 2028 general election. Written Nov. 3, 2026, after a fact-checking pass on every date and a four-lens review (editor, engineer, reader, Alabama political reporter) of an earlier draft. Each phase names what ships, when, and who may change what under the site's governance rules (docs/MAINTAINING.md, scripts/validate-data.js).

The Phase 0 build is specified in full in docs/phase0-post-election-mode.md. Build from that spec, not from the summary here.

## Principles that do not change

- The site stays what it promised: no server, no ads, no tracking, no accounts, and it never asks for personal information. Anything that needs a mailing list, a form or an API is out unless the editor changes that promise on purpose and rewrites the About section first.
- Every fact has a source on the allowlist. Voter-service facts (dates, deadlines, how counting works) come from the Code of Alabama or the Secretary of State, and only a human-made pull request changes them. Results come only from the Secretary of State, never from a news outlet's race call.
- The guide never calls a race. Before certification it shows the Secretary of State's unofficial numbers with an as-of stamp, or only a link to them. "Elected", "Ratified" and "Failed" appear only after the State Canvassing Board certifies.
- Nothing is deleted. The 2026 candidates, positions, sources and amendments stay readable as a frozen pre-election record for as long as the site exists. No card ever describes the other candidate, before or after the vote.
- Labels are computed, not typed. "Unofficial" and "certified" come from a status field, so a label can never go stale. Milestones (counties certified, state certified) are never marked done by the clock; a human sets them done with an official source.
- No inference. A "promise ledger" with kept or broken verdicts is out. The site may record what an officeholder did (a bill number, a roll call, a proclamation) next to what they said, with a source, and let the reader judge.

## Verified date spine

Rule-based dates are computed from the Code of Alabama and the Secretary of State's 2026 administrative calendar. "Confirm" means the Secretary of State has not yet published the specific date; such dates stay in this roadmap and do not go into the locked site data until published.

| Date | What | Basis | Status |
|---|---|---|---|
| Tue Nov 3, 2026, 7 p.m. | Polls close (Eastern-time precincts closed at 6 p.m. Central); unofficial results begin | | Confirmed |
| Wed Nov 4 | Legislators' terms legally begin (ceremonial oath Jan 12) | Ala. Const. § 46 | Confirmed rule |
| Fri Nov 6, 5 p.m. | Provisional voters without photo ID show ID to the Board of Registrars | Ala. Code § 17-10-2(c) | Confirmed, on the SoS calendar |
| Tue Nov 10, noon | County canvassing boards count eligible provisional ballots; military and overseas ballots must arrive | § 17-10-2(e),(f); vote[] military step | Confirmed, on the SoS calendar |
| Fri Nov 13, noon | County canvassing boards declare results and send them to the state | § 17-12-15, -16, -9 | Confirmed (statute); verify the calendar PDF row when the SoS site is reachable |
| Fri Nov 13 to Sun Nov 15 | Window to request a non-automatic recount (48 hours after the county canvass) | § 17-16-21 | Confirmed rule |
| By Wed Nov 25 | State Canvassing Board certifies (within 22 days). 2024: Nov 26; 2022: Nov 28. Nov 25 is the day before Thanksgiving, so an earlier meeting is likely | § 17-12-17 | Confirmed deadline; meeting date not announced |
| Within 72 hours of certification | Automatic recount if a race or amendment is within 0.5% of votes cast; loser may waive within 24 hours | § 17-16-20 | Confirmed rule |
| Late Nov | Governor's proclamation of amendment results (2022: same day as certification) | Ala. Const. § 284 | Rule confirmed, timing by precedent |
| Sun Jan 3, 2027, noon | Terms of the new Congress begin; first meeting day set by law | U.S. Const. Amend. XX | Confirmed |
| Tue Jan 12, 2027 | Legislature's organizational session (up to 10 days): oath, leaders, rules; no bills | Ala. Code § 29-1-4 | Confirmed |
| Mon Jan 18, 2027 | Governor and the six other statewide officers take office (also the state's King/Lee holiday) | Ala. Const. § 116; Ala. Code § 36-3-1 | Confirmed rule; date derived |
| Tue Feb 2, 2027 | 2027 Regular Session convenes (30 meeting days within 105 calendar days) | § 29-1-4 as amended by Act 2023-224 | Confirmed by the Legislature's site |
| Mon May 17, 2027 | Last possible day of the regular session | 105-day limit | Derived |
| Mon Aug 9, 2027 | Registration deadline for the Aug 24 municipal elections | § 17-3-50 (15 days) | Derived, confirm |
| Tue Aug 24, 2027 | City elections: Montgomery, Mountain Brook, Scottsboro, Talladega | SoS upcoming elections page | Confirmed |
| Tue Sep 21, 2027 | Municipal runoffs (fourth Tuesday after, under SB42 of 2026) | § 11-46-55(d) | Derived, confirm the act is in force |
| Fri Nov 12, 2027, 5 p.m. | Candidate qualifying closes for the 2028 primary (116 days before) | § 17-13-5(a) | Derived, confirm (2024 cycle: Nov 10, 2023) |
| Thu Dec 16, 2027 | Parties certify primary candidates to the SoS (82 days before) | § 17-13-5(b) | Derived, confirm |
| Mon Feb 21, 2028 | Registration deadline for the primary | § 17-3-50 | Derived, confirm |
| Tue Mar 7, 2028 | Primary (first Tuesday in March in presidential years) | § 17-13-3(b) | Confirmed rule |
| Tue Apr 4, 2028 | Primary runoff (fourth Tuesday after; 2024's six-week gap was a one-time law) | § 17-13-3, -18 | Derived, confirm |
| Mon Oct 23, 2028 | Registration deadline for the general | § 17-3-50 | Derived, confirm |
| Tue Nov 7, 2028 | General election | | Confirmed |
| Any time before Oct 1, 2029 | Legislative vacancies: the governor must call a special election; recent ones ran about six months from proclamation to the final vote | Ala. Const. § 46; § 17-15-3 | Confirmed rule |

Sources for every row, with the allowlisted URL to cite, are in docs/phase0-post-election-mode.md, appendix A.

## Phase 0: Post-election mode (Nov 3 to Nov 30, 2026)

Three drops.

Drop A, Nov 3 before 7 p.m. Central (one human PR, built from the spec):
- A date-driven mode (`after.startsAt`) computed the same way in app.js, gen.js and build.py, previewable with a GUIDE_NOW override, and a one-off deploy at 7:12 p.m. Central so the no-JS page, guide.json, guide.md and llms.txt flip the same evening.
- Hero, header pill, key-dates grid (five post-election dates), callouts and index wording for the post-election period; a "Polls closed at 7 p.m., stay in line" callout from 7 p.m. to midnight; the provisional-ID callout ends at 5 p.m. Nov 6 instead of running forever.
- A Results section on the Overview (no new tab): where the official results are, the timeline, and six explainer cards (provisional and absentee ballots, how the count becomes official, recounts, when amendments take effect, when winners take office, the next elections). A "what this guide did not cover" line.
- A `result` slot on the 25 contested items (9 state races, U.S. Senate, 7 House districts, Supreme Court Place 8, State Board of Education Districts 2, 6 and 8, 4 amendments), status pending until a human PR fills it from the Secretary of State. The renderer adds every status word.
- Validator: results are human-only and may cite only sos.alabama.gov or alabamavotes.gov; tally names must match the ballot; milestones can be marked done only with an official source; agent PRs may change only the Updates list and the "Updated" line (the candidate record is frozen); new ids reserved. Lock regenerated (additions, plus the absentee-stage and Spanish edits the spec states). Allowlist gains governor.alabama.gov.
- Spanish parity: the Spanish essentials get post-election text through the existing switch mechanism.
- guide.json, guide.md, llms.txt and the FAQ structured data learn the mode: past-tense questions, "when will Alabama certify", "what happens next", and a results-source block that says the guide publishes no counts of its own.
- Share card, meta description and 404 text for the post-election period.
- docs/MAINTAINING.md: the Oct 21 to Nov 2 daily loop is retired; new sections on results, the frozen record, and who may change what.

Drop B, Nov 4, 7 to 9 a.m. Central (human PR): status `unofficial` on all 25 items in one PR with one as-of stamp, citing the Secretary of State's election-night page for Nov 3 (its URL is published on election night; do not reuse the May primary's). Tally numbers are optional before certification; if entered, they carry the as-of time and the counties-reporting text from the SoS and are refreshed on Nov 10 and Nov 13 with dated Updates entries.

Drop C, the day the State Canvassing Board meets (by Nov 25): status `certified` with the certified-results PDF as the source, tally numbers from the certified results, `after.certified` set, and the governor's proclamation linked for the amendments when it exists. Any race or amendment within 0.5% gets a `recount` flag and a dated note. Each step adds an Updates entry.

Explicitly not in Phase 0 (editor decisions, see the end of this file): email or text signup, a separate /2026/ archive URL, a results table of pending rows, county-level datasets.

## Phase 1: Outcomes (Dec 1, 2026 to Jan 31, 2027)

- Amendment outcomes: for each of the four, a sourced `outcome` entry: certified yes and no counts (SoS), the date and link of the governor's proclamation (governor.alabama.gov), and one sentence quoting what the act itself says happens next (alison.legislature.state.al.us). No site-computed "effective date" and no implementing agency unless an agency has said so in a sourced statement. Local amendments stay out of scope (no official statewide list).
- Office blocks, not officeholder pages: one block per office below the race (not per candidate): who holds it from the sourced take-office date, and the official site once it exists. Losing candidates' cards gain nothing and lose nothing. The Pick ovals hide in post-election mode; My picks stays read-only with the result status beside each pick.
- Redistricting status line on the Congress group intro (moved up from Phase 3): Alabama's appeal of the May 2026 injunction is pending at the Supreme Court; a ruling before autumn 2027 could change the 2028 districts, which would force a rewrite of the district data and a versioned localStorage key for saved districts. Qualifying for 2028 closes Nov 12, 2027, so this has a hard downstream date.
- Public Service Commission status entry: the expanded seven-member commission, the 2026 law both PSC races were run on, and the pending federal case, with official and allowlisted sources only.
- Allowlist extension PR (human, CODEOWNER): the official sites of the seven statewide offices (exact hosts), and a decision on the campaign domains, which the allowlist's own comment says to remove after Nov. 3. Freeze them: no new campaign citations after Election Day; re-source a citation only if the campaign page disappears.
- Partners: send the certification-tracker link to libraries, the League of Women Voters of Alabama and local newsrooms in the week of Nov 9, while traffic is high.
- Build-time `dates.ics` (the post-election dates plus the 2027 and 2028 spine) and an Atom feed of Updates, generated by gen.js, same origin, no data leaves the browser. These are the honest substitutes for reminders and a newsletter. They need safeUrl, RELATIVE_URL_OK and the dist checks extended.
- Decide the funding or volunteer model by Dec 15.

## Phase 2: Build for the session (Feb 1 to Feb 28, 2027, with Jan 12 and Jan 18 updates inside Phase 1)

- Jan 12: organizational-session entry: Speaker, President Pro Tem, majority and minority leaders, committee chairs, with the Legislature's pages as sources, and the note that the guide did not cover legislative races.
- Jan 18: office blocks gain official contact links; a "who holds the office until then" line covers the transition (three of the four State Canvassing Board members leave office that day).
- Evergreen voting how-tos, written as steps with no election-specific dates: registering and updating an address, voter ID, the standard absentee deadlines as rules (application by mail 7 days before, in person 5 days before, ballot back by noon on Election Day by mail), provisional ballots, restoring voting rights after a conviction, poll worker signup, military and overseas voting, and a "find your legislator" pointer to alison.legislature.state.al.us. Every step sourced to the Secretary of State. These replace the 2026-specific steps when the next election's `dates` are loaded.
- Archive design: a `SITE_PATH` in build.py (CNAME from the host only; canonical and sitemap from host plus path) and a `mode` key generalizing `after` (vote, results, next, session), so the frozen 2026 page can live at /2026/ with its own canonical and banner when the first 2027 content changes `dates` or `vote`. Hash deep links (#governor) survive unchanged.
- "How Alabama works" explainers in the `laws`-style glossary: why the constitution is so long and why amendments are local, how a bill becomes law, how the two budgets work.

## Phase 3: Session coverage (Feb 2 to May 17, 2027)

- Action log, not scorecard: under each officeholder's pre-election positions, dated entries that are only observable, sourced events: a bill filed (number and alison link), a roll-call vote, an executive order or proclamation, an agency rule, a public statement. The only status vocabulary is the event types above and "no action recorded in the sources we reviewed". No percentages, no kept-versus-broken counts, same depth across officeholders, and a monthly balance line under Updates (entries per officeholder per topic). Agent PRs may propose entries under the existing verification rules.
- Scope the tracker to the guide's own "where they differ" topics: grocery tax, the CHOOSE Act, Medicaid, data centers, power rates, the lottery, early voting, straight-ticket voting.
- Weekly cadence during legislative weeks: one dated Updates entry per week.
- Amendment implementation: for passed amendments, note enabling legislation and effective dates as the acts state them.
- Special elections: when the governor's writ issues, add the special primary, runoff and general dates with the proclamation as the source; a small race entry only if it is a legislative seat the editor chooses to cover.

## Phase 4: Session scorecard and municipals (May 17 to Sept 30, 2027)

- Freeze the action log for 2027 and publish a summary Updates entry; add recorded votes on logged bills to office blocks with roll-call sources.
- Aug 24 municipal guide: Montgomery is the only city with a mayoral race large enough to justify candidate coverage; Mountain Brook, Scottsboro and Talladega get dates and official links. Registration deadline (Aug 9) promoted from July 12. Runoffs Sept 21 if the 2026 law is in force.
- Schema PR for party-ballot primaries (R and D ballots with races under each, "where they differ" within a party) before the Dec 16, 2027 party certifications, plus versioned localStorage keys (picks and districts) so 2026 choices do not bleed into 2028.
- Local meeting calendars: deferred unless a partner supplies them; the site has no server to aggregate them.

## Phase 5: The 2028 cycle (Oct 1, 2027 to Nov 7, 2028)

- Oct 2027: lock the 2028 `dates` when the Secretary of State publishes the 2028 administrative calendar.
- Dec 16, 2027: candidate entries begin from the party certifications to the Secretary of State (qualifying closing at the parties is not a ballot).
- Feb 1, 2028: primary guide live (registration deadline Feb 21; primary Mar 7; runoff Apr 4). Reuse the mode switch at 7 p.m. on Mar 7 and Apr 4 with the county canvass and certification dates recomputed from the same rules.
- Sept 1, 2028: general election guide live; the 2026 and 2028-primary guides archived under /2026/ and /2028-primary/.
- Nov 7, 2028, 7 p.m.: post-election mode again (county canvass Nov 17; state certification by Nov 29).

## Cadence

- Updates entries: daily while counts move (Nov 4 to certification), weekly during the session, monthly otherwise. Every results refresh is a dated entry; a count that changes after publication gets a "Correction" line saying what moved and why, with the SoS source.
- The 30-minute live-site monitor stays on through at least Dec 1, 2026 (the window when a defacement of results would matter most), not Nov 10 as its comment says.

## Decisions for the editor

- By Nov 3 (Drop A review): confirm the Nov 13 county canvass row against the Secretary of State's calendar PDF before the lock is regenerated; confirm the hero and callout wording.
- By Dec 15: funding or volunteer model. Whether to run a newsletter at all: it cannot live on this site (no server, no personal information, CSP forbids forms); if wanted, it runs with a partner under the partner's privacy policy, is linked only after the About section is rewritten to say who holds the list, and that one domain is added to the allowlist. On-site, the Atom feed and dates.ics are the equivalents.
- By Dec 15: whether canonicalUrl (a locked value, currently the claude.ai artifact link) moves to alabamaballotguide.org.
- By Jan 31: the archive URL scheme (/2026/) before any 2027 content changes `dates` or `vote`.
- Before Nov 12, 2027: whether a Supreme Court ruling has changed the congressional map for 2028.
