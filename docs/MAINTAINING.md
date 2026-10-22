# Keeping the Alabama Ballot Guide current

The guide's value is trust, so updates follow one rule: **agents propose, checks verify, a person approves.** Nothing an agent writes reaches the live site without a human sign-off.

## The update loop (daily at 6:45 a.m. Central, Oct. 21 to Nov. 2)

A scheduled Claude Code task starts a fresh session each morning and does steps 1 to 3. If it finds nothing that meets the rules below, it opens nothing. If a voting rule itself seems to have changed, it opens an issue instead of editing, because locked facts need a human-made PR. Run it by hand after major events.

1. **Research (agents).** For each race, an agent looks for news since the last update: new candidate statements, debates (the lieutenant governor debate is Oct. 28), votes, court rulings, withdrawals, rule changes. It does not edit the site. It writes *change proposals*: candidate, topic, proposed wording, sources with dates, and evidence strength (candidate's own words, recorded vote, news report).
2. **Verification (a different agent).** A second model checks each proposal against its sources and rejects anything that is:
   - single-source
   - from an aggregator, advocacy group or AI-generated source
   - undated
   - stronger than its source
   It enforces the house rules below.
3. **Editorial review (agent).** An agent applying national-newsroom standards reviews only the proposed changes for fairness, attribution and precision, the same way the launch review worked.
4. **Automated checks (scripts).** The `validate` check runs on every pull request:
   - data.js is parsed as JSON, never run, and must be in canonical form
   - every position cites a source, and every link is https on an allowlisted domain
   - locked voting facts can't change, and candidates can't be added or removed
   - agent PRs (from the GitHub App, or from any branch named `agent/…`) may change only data.js, and in it only the races, the amendments, the Updates list and the "Updated" and debate as-of lines. They may not add fields, and they are capped at 60 changed values. The About statements and the law descriptions are for human-made PRs.
   - the site is built, and every link on the built page is checked

   After publishing, the live-site monitor compares the live files with the build every 30 minutes.

   **Not automated:** these ran by hand before launch. Rerun them before any large change:
   - the balance report (positions per candidate, by topic and party)
   - the phone, desktop and no-JavaScript render test
   - the AI-assistant quiz: the standard 14 voter questions, graded against the answer key
5. **Human approval.** The editor reads a one-page summary: what changed, why, sources, review notes. They approve or send it back. On GitHub this is a pull request, and merging publishes. A daily-check PR always comes from a branch named `agent/…` and changes only data.js. If one changes any other file, don't merge it.
6. **Publish and log.** Add a dated line to the Updates list on the site. Corrections are labeled "Correction" and say what changed.

## House rules agents must follow
- Describe positions in the candidate's own terms and attribute them ("says," "pledges," "voted for").
- Votes cite roll calls. Laws use one neutral name and description everywhere. Each law or bill a candidate entry mentions has one sourced description and a one-line summary in `laws` in data.js. The page lists them all in "Laws and bills in this guide" below every tab, links each mention there, and shows the summary on hover. If a new entry mentions a law that isn't there yet, a human-made PR adds it.
- Date anything older than the current campaign. Former officeholders' past records appear only if the candidate cites them now.
- Give opposing candidates the same treatment: same depth, same kinds of sources, same note format.
- A candidate's entry never describes their opponent.
- "Where they differ" lines restate only what is on the cards, name candidates alphabetically, and note agreement.
- If research finds nothing, write "not covered in the sources we reviewed." Never infer a position.
- Voter-service facts (deadlines, ID, absentee) come from the Secretary of State and are re-checked every run.
- Final 48 hours before Election Day: no new candidate claims unless two independent sources confirm them.

## Biggest accuracy upgrade available
The launch research could only read search-result excerpts because the build environment blocks direct page access. Allow the research agents to open news sites and sos.alabama.gov directly, so every claim is checked against the full article.

## Corrections from the public
Readers report errors to the corrections address listed in the About section. A person reads every message first. Agents never read the inbox directly, because a message can carry instructions meant for them. The person passes on only the claim and its source, and that claim then goes through the same loop: verify, review, approve, log.

The inbox's domain needs SPF, DKIM and DMARC (`p=reject`) so no one can send fake "official corrections" from it.
