#!/usr/bin/env python3
"""Create a new blog article from the existing site template.

Clones blog/how-to-apply-home-loan-singapore/index.html (head, analytics, nav,
footer, styling all inherited), then swaps the head metadata, the JSON-LD
blocks and the <article> body for the new piece.

Usage:  python3 scripts/new-article.py <module_under_scripts/articles/>
The module must define: SLUG, TITLE, DESC, OG_TITLE, OG_DESC, KEYWORDS,
SECTION, DATE_HUMAN, DATE_ISO, READ_TIME, WORDS, H1, BODY, FAQ (list of
(question, answer) pairs), BREADCRUMB_NAME.
"""
import re, sys, os, json, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TEMPLATE = "blog/how-to-apply-home-loan-singapore/index.html"

spec = importlib.util.spec_from_file_location("art", sys.argv[1])
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

# drop og:image block (new articles ship without a hero image)
h = re.sub(r'\s*<meta property="og:image(?::[a-z]+)?" content=".*?">', '', h)

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
h = h[:m.end()] + head_html + A.BODY + "\n\n" + h[end:]

out = "blog/%s/index.html" % A.SLUG
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w", encoding="utf-8").write(h)
print("wrote", out, "(%d bytes)" % len(h))
