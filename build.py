"""Build the Alabama Ballot Guide.

1. gen.js writes guide.json, guide.md, llms.txt and the JSON-LD block from data.js.
2. The page is assembled from shell.html + data.js + app.js.
3. The page is rendered once in headless Chromium and the result is written into
   <main> and <footer>, so readers and agents that don't run scripts still get
   every race, candidate and source. The script re-renders on load for people.
"""
import base64, hashlib, json, os, pathlib, re, subprocess, sys

d = pathlib.Path(__file__).parent
env = dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"], text=True).strip())
print(subprocess.check_output(["node", str(d / "gen.js")], text=True, env=env).strip())

shell = (d / "shell.html").read_text()
app = (d / "app.js").read_text()

def js_safe(obj):
    """JSON that is safe inside <script>: no '<', '>' or '&' can open/close tags or comments."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    for ch in ("<", ">", "&", chr(0x2028), chr(0x2029)):
        s = s.replace(ch, "\\u%04x" % ord(ch))
    return s

# data.js is untrusted input: parse it as JSON (fails closed on any code) and re-serialize safely
raw = (d / "data.js").read_text()
PREFIX = "window.GUIDE = "
if not (raw.startswith(PREFIX) and raw.endswith(";\n")):
    sys.exit("data.js must be exactly `window.GUIDE = <JSON>;`")
data = PREFIX + js_safe(json.loads(raw[len(PREFIX):-2])) + ";"
ld = js_safe(json.loads((d / "ld.json").read_text()))

DESC = "Nonpartisan, sourced summaries of every candidate in Alabama's Nov. 3, 2026 statewide and congressional races, the four statewide amendments, and how to vote."
ARTIFACT_URL = "https://claude.ai/artifact/WGJ2K8m2p9jgRbfpoCWCHV"
SITE_URL = os.environ.get("SITE_URL", "https://alabamaballotguide.org").rstrip("/")
if not re.fullmatch(r"https://[a-z0-9.-]+(/[a-z0-9._-]+)*", SITE_URL):
    sys.exit("SITE_URL must be a plain https address")

def seo(url, image=None):
    tags = [
        '<link rel="canonical" href="%s">' % url,
        '<meta name="robots" content="index, follow, max-snippet:-1">',
        '<meta property="og:type" content="website">',
        '<meta property="og:title" content="Alabama Ballot Guide 2026">',
        '<meta property="og:description" content="%s">' % DESC.replace('"', "&quot;"),
        '<meta property="og:url" content="%s">' % url,
        '<meta name="twitter:card" content="%s">' % ("summary_large_image" if image else "summary"),
        '<meta name="twitter:title" content="Alabama Ballot Guide 2026">',
        '<meta name="twitter:description" content="%s">' % DESC.replace('"', "&quot;"),
    ]
    if image:
        tags += ['<meta property="og:image" content="%s">' % image, '<meta property="og:image:width" content="1200">',
                 '<meta property="og:image:height" content="630">', '<meta name="twitter:image" content="%s">' % image]
    return "\n".join(tags) + "\n"

head = (
    "<!--SEO-->"
    '<link rel="alternate" type="application/json" href="guide.json" title="Guide data (JSON)">\n'
    '<link rel="alternate" type="text/markdown" href="guide.md" title="Guide text (Markdown)">\n'
    '<link rel="help" type="text/plain" href="llms.txt" title="Guide index for AI agents">\n'
    '<meta name="description" content="' + DESC.replace('"', "&quot;") + '">\n'
    '<script type="application/ld+json">' + ld + "</script>\n"
)
marker = '<meta name="claude:viewport-fit-sides" content="cover">\n'
assert marker in shell
# trusted app code first, then data, one replacement each, so data can never inject a marker
page = shell.replace(marker, marker + head, 1).replace("/*APP*/", app, 1).replace("/*DATA*/", data, 1)

# Render once, then bake the markup into the page
tmp = d / "_prerender.html"
tmp.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + page + "</body></html>")
js = d / "_prerender.js"
js.write_text("""
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  // offline render: nothing in the page may reach the network during the build
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
  await p.addInitScript(() => { window.__PRERENDER = true; });
  await p.goto('file://' + process.argv[2]);
  const out = await p.evaluate(() => ({ main: document.getElementById('content').innerHTML, about: document.getElementById('about').innerHTML }));
  out.errs = errs;
  process.stdout.write(JSON.stringify(out));
  await b.close();
})();
""")
res = json.loads(subprocess.check_output(["node", str(js), str(tmp)], text=True, env=env))
assert not res["errs"], res["errs"]
page = page.replace('<main id="content"></main>', '<main id="content">' + res["main"] + "</main>", 1)
page = page.replace('<footer class="about" id="about"></footer>', '<footer class="about" id="about">' + res["about"] + "</footer>", 1)
for f in (tmp, js):
    f.unlink()

# Artifact page: canonical points at the artifact link
(d / "alabama-ballot-guide.html").write_text(page.replace("<!--SEO-->", seo(ARTIFACT_URL), 1))
print("wrote page", len(page), "bytes")

# Standalone website (dist/): a complete HTML document plus search and AI-crawler files
dist = d / "dist"
dist.mkdir(exist_ok=True)
split = page.index('<a class="skip"')
headpart, bodypart = page[:split], page[split:]
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<meta name="theme-color" content="#0a6b5b">\n'
       '<link rel="icon" href="' + SITE_URL + '/favicon-32.png" sizes="32x32" type="image/png">\n'
       '<link rel="icon" href="' + SITE_URL + '/favicon.svg" type="image/svg+xml">\n'
       '<link rel="apple-touch-icon" href="' + SITE_URL + '/apple-touch-icon.png">\n'
       + headpart.replace("<!--SEO-->", seo(SITE_URL + "/", SITE_URL + "/og-image.png"), 1)
       + "</head>\n<body>\n" + bodypart + "\n</body>\n</html>\n")
doc = doc.replace(ARTIFACT_URL, SITE_URL + "/")
# Content-Security-Policy as a meta tag (GitHub Pages cannot send headers). Hashes cover the exact
# inline script and style text, so they are computed here, after every replacement above.
def sha(s): return "'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode() + "'"
csp = "; ".join([
    "default-src 'none'",
    "script-src " + " ".join(sha(s) for s in re.findall(r"<script>(.*?)</script>", doc, re.S)),
    "style-src " + " ".join(sha(s) for s in re.findall(r"<style>(.*?)</style>", doc, re.S)) + " https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self'", "connect-src 'none'", "base-uri 'none'",
    "form-action 'none'", "object-src 'none'", "upgrade-insecure-requests"])
doc = doc.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n'
                  '<meta name="referrer" content="strict-origin-when-cross-origin">\n', 1)
(dist / "index.html").write_text(doc)
for name in ("guide.json", "guide.md", "llms.txt"):
    (dist / name).write_text((d / name).read_text().replace(ARTIFACT_URL, SITE_URL + "/"))
(dist / "robots.txt").write_text(
    "# Everyone, including AI assistants and answer engines, is welcome to read and cite this guide.\n"
    "User-agent: *\nAllow: /\n\n"
    + "".join("User-agent: %s\nAllow: /\n\n" % bot for bot in
              ("Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User",
               "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"))
    + "Sitemap: %s/sitemap.xml\n" % SITE_URL)
(dist / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join("  <url><loc>%s/%s</loc><lastmod>2026-10-20</lastmod><changefreq>daily</changefreq></url>\n" % (SITE_URL, p)
              for p in ("", "guide.md", "guide.json", "llms.txt"))
    + "</urlset>\n")
# Link-preview image (1200x630) for social shares and search cards
og = d / "_og.js"
og.write_text("""
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('file://' + process.argv[2]);
  await p.waitForTimeout(600);
  await p.screenshot({ path: process.argv[3] });
  await b.close();
})();
""")
subprocess.check_call(["node", str(og), str(d / "og-card.html"), str(dist / "og-image.png")], env=env)
og.unlink()
# Tab icon: Alabama's shape in the guide's green (lighter on dark tab bars), plus PNGs for
# browsers without SVG icons and for phone home screens
AL_PATH = ("M7.1 2.4L50.7 2.6L58 45L61.7 54L60 62.4L58.6 70.4L60.2 80.4L61 82.4L17.2 82.4L20.2 92.8L18.5 96.8"
           "L11.3 97.8L11.8 91.4L10.4 88.8L9.4 92L8.8 95L3.7 95L2.5 64.4L7.1 10.4L8.8 4.6Z")
(dist / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16.5 1.5 97 97"><style>path{fill:#0a6b5b}'
    '@media (prefers-color-scheme: dark){path{fill:#5fcfb4}}</style>'
    '<path d="' + AL_PATH + '" stroke-linejoin="round"/></svg>\n')
icons = d / "_icons.js"
icons.write_text("""
const { chromium } = require('playwright');
(async () => {
  const [, , pathD, outDir] = process.argv;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  for (const [name, size, bg, pad] of [['favicon-32.png', 32, 'transparent', 1], ['apple-touch-icon.png', 180, '#ffffff', 26]]) {
    const p = await (await b.newContext({ viewport: { width: size, height: size } })).newPage();
    await p.setContent('<body style="margin:0;background:' + bg + '"><svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="-16.5 1.5 97 97" style="display:block;padding:' + pad + 'px;box-sizing:border-box"><path fill="#0a6b5b" d="' + pathD + '"/></svg></body>');
    await p.screenshot({ path: outDir + '/' + name, omitBackground: bg === 'transparent' });
  }
  await b.close();
})();
""")
subprocess.check_call(["node", str(icons), AL_PATH, str(dist)], env=env)
icons.unlink()
# Not-found page that leads back to the guide instead of GitHub's stock 404
(dist / "404.html").write_text("""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found · Alabama Ballot Guide 2026</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root { --bg: #ffffff; --fg: #111715; --muted: #56625d; --accent: #0a6b5b; }
@media (prefers-color-scheme: dark) { :root { --bg: #0d1110; --fg: #e8eeeb; --muted: #a3afaa; --accent: #5fcfb4; color-scheme: dark; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 1.06rem/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 18vh 20px 40px; }
main { max-width: 32rem; margin: 0 auto; }
h1 { font: 600 2rem/1.15 Georgia, serif; margin: 0 0 12px; }
p { color: var(--muted); margin: 0 0 20px; }
a { color: var(--accent); font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>Page not found</h1>
<p>That page isn’t part of the Alabama Ballot Guide. The guide covers every race and amendment on Alabama’s Nov. 3, 2026 ballot.</p>
<p><a href="/">Go to the Alabama Ballot Guide</a></p>
</main>
</body>
</html>
""")
# GitHub Pages custom domain
(dist / "CNAME").write_text(SITE_URL.split("://", 1)[1] + "\n")
print("wrote dist/ for", SITE_URL)
