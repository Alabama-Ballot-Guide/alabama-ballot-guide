# Keeping the Alabama Ballot Guide current

The guide's value is trust, so updates follow one rule: **agents propose, checks verify, a person approves.** Nothing an agent writes reaches the live site without a human sign-off.

## The update loop (run daily until Nov. 3, plus after major events)

1. **Research (agents).** For each race, an agent looks for news since the last update: new candidate statements, debates (the lieutenant governor debate is Oct. 28), votes, court rulings, withdrawals, rule changes. It does not edit the site. It writes *change proposals*: candidate, topic, proposed wording, sources with dates, and evidence strength (candidate's own words, recorded vote, news report).
2. **Verification (a different agent).** A second model checks each proposal against its sources and rejects anything that is:
   - single-source
   - from an aggregator, advocacy group or AI-generated source
   - undated
   - stronger than its source
   It enforces the house rules below.
3. **Editorial review (agent).** An agent applying national-newsroom standards reviews only the proposed changes for fairness, attribution and precision, the same way the launch review worked.
4. **Automated checks (scripts).** These run on every build:
   - every position cites a source, and every source is cited
   - a balance report: positions per candidate, by topic and party
   - the page renders on phone and desktop with no errors or sideways scrolling
   - the content is present without JavaScript
   - the structured data parses
   - **regression test:** AI agents (Haiku, Sonnet, Opus) answer the standard 14 voter questions from the updated guide and are graded against the answer key. A score drop blocks the release.
5. **Human approval.** The editor reads a one-page summary: what changed, why, sources, review notes. They approve or send it back. On GitHub this is a pull request, and merging publishes.
6. **Publish and log.** Add a dated line to the Updates list on the site. Corrections are labeled "Correction" and say what changed.

## House rules agents must follow
- Describe positions in the candidate's own terms and attribute them ("says," "pledges," "voted for").
- Votes cite roll calls. Laws use one neutral name and description everywhere.
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
