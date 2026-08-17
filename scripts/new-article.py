#!/usr/bin/env python3
"""Create a new blog article from the existing site template.

Clones blog/how-to-apply-home-loan-singapore/index.html (head, analytics, nav,
footer, styling all inherited), then swaps the head metadata, the JSON-LD
blocks and the <article> body for the new piece.

Usage:  python3 scripts/new-article.py <module_under_scripts/articles/> [--no-images]
The module must define: SLUG, TITLE, DESC, OG_TITLE, OG_DESC, KEYWORDS,
SECTION, DATE_HUMAN, DATE_ISO, READ_TIME, WORDS, H1, BODY, FAQ (list of
(question, answer) pairs), BREADCRUMB_NAME.

It should also define IMAGES: a list of infographic specs (see
scripts/README.md). They are merged into scripts/infographic-specs.json,
rendered, and placed into the article automatically. House standard is a hero
plus two in-article cards; anything less prints a warning. Pass --no-images to
defer, then run the two image scripts by hand later.
"""
import re, sys, os, json, subprocess, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TEMPLATE = "blog/how-to-apply-home-loan-singapore/index.html"

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
if not ARGS:
    raise SystemExit("Usage: python3 scripts/new-article.py <module> [--no-images]")
MODULE = ARGS[0]

spec = importlib.util.spec_from_file_location("art", MODULE)
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

h = open(TEMPLATE, encoding="utf-8").read()
URL = "https://nexusmortgage.sg/blog/%s/" % A.SLUG

def sub1(pattern, repl, s, what):
    """Replace exactly once, using a function repl so $-sequences in the
    replacement are never interpreted (see js_replace_dollar_pattern_bug)."""
    new, n = re.subn(pattern, lambda m: repl, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("FAILED to replace %s (matched %d times)" % (what, n))
    return new

# ---- head metadata -------------------------------------------------------
h = sub1(r'<title>.*?</title>', '<title>%s</title>' % A.TITLE, h, "title")
h = sub1(r'<meta name="description" content=".*?">',
         '<meta name="description" content="%s">' % A.DESC, h, "description")
h = sub1(r'<meta property="og:title" content=".*?">',
         '<meta property="og:title" content="%s">' % A.OG_TITLE, h, "og:title")
h = sub1(r'<meta property="og:description" content=".*?">',
         '<meta property="og:description" content="%s">' % A.OG_DESC, h, "og:description")
h = sub1(r'<meta property="og:url" content=".*?">',
         '<meta property="og:url" content="%s">' % URL, h, "og:url")
h = sub1(r'<link rel="canonical" href=".*?">',
         '<link rel="canonical" href="%s">' % URL, h, "canonical")
h = re.sub(r'<link rel="alternate" hreflang="(en-sg|x-default)" href=".*?">',
           lambda m: '<link rel="alternate" hreflang="%s" href="%s">' % (m.group(1), URL), h)

# ---- og:image ------------------------------------------------------------
# Articles with their own hero set OG_IMAGE (+ optional alt/dims/type) in their
# module. Everything else falls back to the site card so the page still previews
# on social and in AI surfaces. This block used to strip og:image outright, which
# shipped new articles with no preview image at all.
OG_IMAGE = getattr(A, "OG_IMAGE", "https://nexusmortgage.sg/og-image.png")
OG_IMAGE_ALT = getattr(A, "OG_IMAGE_ALT", A.OG_TITLE)
OG_IMAGE_W = getattr(A, "OG_IMAGE_W", 1024)
OG_IMAGE_H = getattr(A, "OG_IMAGE_H", 1024)
# NOTE: /og-image.png is really a 1024x1024 JPEG despite the .png name.
OG_IMAGE_TYPE = getattr(A, "OG_IMAGE_TYPE", "image/jpeg")

h = re.sub(r'\s*<meta property="og:image(?::[a-z]+)?" content=".*?">', '', h)
h = re.sub(r'\s*<meta name="twitter:image" content=".*?">', '', h)
og_block = (
    '\n  <meta property="og:image" content="%s">'
    '\n  <meta property="og:image:alt" content="%s">'
    '\n  <meta property="og:image:width" content="%d">'
    '\n  <meta property="og:image:height" content="%d">'
    '\n  <meta property="og:image:type" content="%s">'
    '\n  <meta name="twitter:image" content="%s">'
) % (OG_IMAGE, OG_IMAGE_ALT, OG_IMAGE_W, OG_IMAGE_H, OG_IMAGE_TYPE, OG_IMAGE)
h = sub1(r'(<meta property="og:url" content=".*?">)',
         '<meta property="og:url" content="%s">%s' % (URL, og_block), h, "og:image block")

# ---- Article schema ------------------------------------------------------
art = {
    "@context": "https://schema.org", "@type": "Article",
    "headline": A.H1, "datePublished": A.DATE_ISO, "dateModified": A.DATE_ISO,
    "inLanguage": "en-SG", "articleSection": A.SECTION, "wordCount": A.WORDS,
    "description": A.DESC,
    "mainEntityOfPage": {"@type": "WebPage", "@id": URL},
    "author": {"@id": "https://nexusmortgage.sg/#dan-ler", "@type": "Person",
               "name": "Dan Ler", "url": "https://nexusmortgage.sg/about/",
               "image": "https://nexusmortgage.sg/dan-ler.webp",
               "jobTitle": "Mortgage Advisor",
               "worksFor": {"@type": "Organization", "name": "Nexus Mortgage",
                            "url": "https://nexusmortgage.sg"}},
    "publisher": {"@id": "https://nexusmortgage.sg/#organization"},
    "keywords": A.KEYWORDS,
}
h = sub1(r'<script type="application/ld\+json">\{"@context":"https://schema\.org","@type":"Article".*?</script>',
         '<script type="application/ld+json">%s</script>' % json.dumps(art, ensure_ascii=False),
         h, "Article schema")

# ---- FAQ schema ----------------------------------------------------------
faq = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en-SG",
       "mainEntity": [{"@type": "Question", "name": q,
                       "acceptedAnswer": {"@type": "Answer", "text": a}}
                      for q, a in A.FAQ]}
h = sub1(r'<script type="application/ld\+json">\{\s*"@context": "https://schema\.org",\s*"@type": "FAQPage".*?</script>',
         '<script type="application/ld+json">%s</script>' % json.dumps(faq, ensure_ascii=False, indent=2),
         h, "FAQ schema")

# ---- Breadcrumb ----------------------------------------------------------
bc = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://nexusmortgage.sg/"},
      {"@type": "ListItem", "position": 2, "name": "Insights", "item": "https://nexusmortgage.sg/blog/"},
      {"@type": "ListItem", "position": 3, "name": A.BREADCRUMB_NAME, "item": URL}]}
h = sub1(r'<script type="application/ld\+json">\{"@context":"https://schema\.org","@type":"BreadcrumbList".*?</script>',
         '<script type="application/ld+json">%s</script>' % json.dumps(bc, ensure_ascii=False),
         h, "Breadcrumb schema")

# ---- body ----------------------------------------------------------------
head_html = ('\n\n  <a href="/blog/" class="back-link">&#8592; Back to Insights</a>\n\n'
    '  <p class="meta">Nexus Mortgage SG &nbsp;&middot;&nbsp; %s &nbsp;&middot;&nbsp; %s</p>\n\n'
    '  <h1>%s</h1>\n'
    '  <p class="article-byline" style="margin:.5rem 0 1.4rem;font-size:.8rem;'
    'color:rgba(232,227,218,.55);font-family:\'DM Sans\',system-ui,sans-serif;letter-spacing:.01em;">'
    'By <a href="/about/" style="color:#c4973b;font-weight:600;text-decoration:none;">Dan Ler</a>, '
    'Mortgage Advisor</p>\n\n') % (A.DATE_HUMAN, A.READ_TIME, A.H1)

m = re.search(r'<article[^>]*>', h)
end = h.rfind("</article>")

# The E-E-A-T author-bio box lives near the end of the template's <article>, so
# replacing the body wholesale used to delete it. Carry it across explicitly:
# without it the article keeps only the byline and loses the author credentials
# block that Google and AI surfaces read for authorship.
bio = re.search(r'<div class="author-bio".*?</div>', h[m.end():end], re.S)
if not bio:
    raise SystemExit("FAILED to find author-bio block in template")

h = h[:m.end()] + head_html + A.BODY + "\n\n  " + bio.group(0) + "\n\n" + h[end:]

# ---- template guarantees -------------------------------------------------
# Both of these were silently lost once before: the in-article images stopped
# when the workflow changed in June 2026, and the floating WhatsApp button
# never made it into the article template at all while every other page had
# one. Fail loudly here rather than discover it months later.
for needle, what in (
    ('id="wa-float"', "floating WhatsApp button"),
    (".blog-img", "in-article image CSS"),
):
    if needle not in h:
        raise SystemExit(
            "FAILED: template %s is missing the %s. Fix the template before "
            "publishing, or every new article inherits the gap." % (TEMPLATE, what)
        )

out = "blog/%s/index.html" % A.SLUG
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w", encoding="utf-8").write(h)
print("wrote", out, "(%d bytes)" % len(h))

# ---- images --------------------------------------------------------------
IMAGES = getattr(A, "IMAGES", [])
if "--no-images" in sys.argv:
    print("skipped images (--no-images); run the image scripts before publishing")
elif not IMAGES:
    print("\n  WARNING: %s defines no IMAGES, so it ships with no hero and no\n"
          "  in-article cards. Add an IMAGES list (see scripts/README.md) and\n"
          "  re-run, or run the two image scripts by hand." % os.path.basename(MODULE))
else:
    specs_path = "scripts/infographic-specs.json"
    specs = json.load(open(specs_path, encoding="utf-8"))
    by_out = {s["out"]: i for i, s in enumerate(specs)}
    for img in IMAGES:
        img = dict(img, slug=A.SLUG)
        if img["out"] in by_out:
            specs[by_out[img["out"]]] = img      # re-running an article updates in place
        else:
            specs.append(img)
    json.dump(specs, open(specs_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("merged %d image spec(s) into %s" % (len(IMAGES), specs_path))

    for cmd in (["scripts/build-article-infographics.py", A.SLUG],
                ["scripts/insert-article-images.py"]):
        r = subprocess.run([sys.executable] + cmd, cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit("FAILED: %s exited %d" % (cmd[0], r.returncode))

    placed = open(out, encoding="utf-8").read().count('class="blog-img"')
    hero = any(i.get("type") == "hero" for i in IMAGES)
    if placed < 2 or not hero:
        print("\n  WARNING: %s ended up with %d in-article card(s) and %s hero.\n"
              "  House standard is a hero plus two cards."
              % (A.SLUG, placed, "a" if hero else "no"))
