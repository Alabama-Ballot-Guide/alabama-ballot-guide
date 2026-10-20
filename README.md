# Alabama Ballot Guide 2026

A free, nonpartisan guide to Alabama's November 3, 2026 general election. It summarizes what each candidate says they will do, with a source for every point, and covers the four statewide amendments and how to vote.

Live site: https://alabamaballotguide.org

It is a static site with no server, no ads, no tracking and no accounts.

## How it is built

| File | What it is |
| --- | --- |
| `data.js` | All content, as JSON (`window.GUIDE = {...};`). Parsed as JSON, never run as code. |
| `app.js` | The page's tabs, filters and "My picks". |
| `shell.html` | Page styles and header. |
| `gen.js` | Builds `guide.json`, `guide.md`, `llms.txt` and the search structured data from `data.js`. |
| `build.py` | Runs `gen.js`, pre-renders the page in Chromium so its content is in the HTML, and writes `dist/`. |
| `og-card.html` | The preview image shown when the link is shared. |
| `scripts/validate-data.js` | Checks content before every build. |
| `security/facts.lock.json` | Locked voting facts: dates, poll hours, ID and absentee rules. |
| `security/source-domains.json` | Approved source sites. |

To build locally (Node 22 and Python 3):

```sh
npm ci --ignore-scripts
node scripts/validate-data.js --new data.js --allowlist security/source-domains.json --lock security/facts.lock.json
CHROMIUM_PATH=/path/to/chromium python3 -I build.py
```

The output is in `dist/`. To build for a different address, set `SITE_URL=https://...` first.

## Publishing

GitHub Actions publishes the site. Nobody uploads files by hand.

- `.github/workflows/deploy.yml` runs on every merge to `main` and once a day, so date labels such as "deadline passed" stay current. It validates, builds, checks the built pages, writes `SHA256SUMS`, and deploys to GitHub Pages.
- `.github/workflows/pr-check.yml` checks every pull request.
- `.github/workflows/monitor.yml` checks that the live site matches the last deploy.

One-time setup: Settings → Pages → Source: **GitHub Actions**, custom domain `alabamaballotguide.org`, **Enforce HTTPS** on.

## How changes are made

Every change is a pull request that a person approves. AI agents can propose changes but cannot publish them. The voting facts are locked, and changing them takes a human-reviewed edit to the lock file. See [docs/MAINTAINING.md](docs/MAINTAINING.md) for the update process and house style.

## Getting found

1. Google Search Console: verify the site and submit `https://alabamaballotguide.org/sitemap.xml`.
2. Bing Webmaster Tools: import from Search Console. Bing also feeds ChatGPT search and Copilot.
3. Ask libraries, campus groups, civic groups and local newsrooms to link to the guide. Trusted links matter most for search and AI answers.

## Reporting an error

Use the contact in the guide's About section. Corrections are dated and listed under Updates.
