#!/usr/bin/env python3
"""Place rendered infographics into their articles.

For every spec in scripts/infographic-specs.json:
  * inline cards go directly after the <h2 id="..."> named by "anchor",
    using the house markup (.blog-img + .img-caption)
  * hero cards go after the byline, and also become og:image / twitter:image
  * the Article JSON-LD "image" array is rebuilt to list every image on the page

Idempotent: an image already referenced in the page is skipped, so this can be
re-run after adding new specs.

  python3 scripts/insert-article-images.py [--dry-run]
"""

import json
import re
import sys
from collections import defaultdict
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "scripts" / "infographic-specs.json"
BASE = "https://nexusmortgage.sg/blog/blog-images"

IMG_CSS = (
    "    .blog-img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; "
    "object-position: center; border-radius: 10px; margin: 1.8rem 0; display: block; "
    "box-shadow: 0 4px 24px rgba(0,0,0,.45); }\n"
    "    .img-caption { text-align: center; font-size: .75rem; letter-spacing: .04em; "
    "color: rgba(232,227,218,.35); margin-top: -.9rem; margin-bottom: 1.8rem; }\n"
)


def ensure_css(html):
    """Articles written after June never got the image CSS. Add it once."""
    if ".blog-img" in html:
        return html, False
    m = re.search(r"\n(\s*\.faq-q\s*\{|\s*\.cta-box\s*\{|\s*\.stat-row\s*\{)", html)
    if not m:
        m = re.search(r"\n(\s*hr\s*\{)", html)
    if not m:
        return html, False
    return html[: m.start() + 1] + IMG_CSS + html[m.start() + 1 :], True


def inline_markup(spec):
    return (
        f'\n  <img src="../blog-images/{spec["out"]}.webp" width="1344" height="768"'
        f' alt="{escape(spec["alt"], quote=True)}" class="blog-img" loading="lazy">\n'
        f'  <p class="img-caption">{escape(spec["caption"], quote=False)}</p>\n'
    )


def hero_markup(spec):
    return (
        f'\n\n  <img src="../blog-images/{spec["out"]}.webp" width="1344" height="768"'
        f' alt="{escape(spec["title"], quote=True)}" class="hero-img" fetchpriority="high">'
    )


def insert_inline(html, spec):
    if f'blog-images/{spec["out"]}.webp' in html:
        return html, False
    pat = re.compile(r'(<h2[^>]*id="%s"[^>]*>.*?</h2>)' % re.escape(spec["anchor"]), re.S)
    m = pat.search(html)
    if not m:
        print(f'    MISS anchor #{spec["anchor"]} for {spec["out"]}')
        return html, False
    return html[: m.end()] + inline_markup(spec) + html[m.end() :], True


def insert_hero(html, spec):
    if f'blog-images/{spec["out"]}.webp' in html:
        return html, False
    m = re.search(r'<p class="article-byline".*?</p>', html, re.S)
    if not m:
        print(f'    MISS byline for hero {spec["out"]}')
        return html, False
    html = html[: m.end()] + hero_markup(spec) + html[m.end() :]
    url = f'{BASE}/{spec["out"]}.png'
    # promote the hero into the social cards, replacing the generic site image
    html = re.sub(r'(<meta property="og:image" content=")[^"]*(")', r"\1" + url + r"\2", html, count=1)
    html = re.sub(r'(<meta name="twitter:image" content=")[^"]*(")', r"\1" + url + r"\2", html, count=1)
    html = re.sub(r'(<meta property="og:image:width" content=")[^"]*(")', r"\g<1>1344\2", html, count=1)
    html = re.sub(r'(<meta property="og:image:height" content=")[^"]*(")', r"\g<1>768\2", html, count=1)
    html = re.sub(r'\s*<meta property="og:image:type" content="[^"]*">', "", html, count=1)
    return html, True


def sync_jsonld_images(html, names):
    """Rebuild the Article node's image array so schema matches the page."""
    blocks = list(re.finditer(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.S))
    for b in blocks:
        raw = b.group(1)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get("@type") != "Article":
            continue
        data["image"] = [
            {"@type": "ImageObject", "url": f"{BASE}/{n}.png", "width": 1344, "height": 768}
            for n in names
        ]
        new = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        return html[: b.start(1)] + new + html[b.end(1):], True
    return html, False


def main():
    dry = "--dry-run" in sys.argv
    specs = json.loads(SPECS.read_text(encoding="utf-8"))
    by_slug = defaultdict(list)
    for s in specs:
        by_slug[s["slug"]].append(s)

    total = 0
    for slug, group in sorted(by_slug.items()):
        p = ROOT / "blog" / slug / "index.html"
        html = original = p.read_text(encoding="utf-8")
        print(slug)

        html, added_css = ensure_css(html)
        if added_css:
            print("    + image CSS")

        # hero first so it sits above the inline cards in the schema array
        heroes = [s for s in group if s["type"] == "hero"]
        inlines = [s for s in group if s["type"] != "hero"]
        for s in heroes:
            html, ok = insert_hero(html, s)
            if ok:
                print(f'    + hero  {s["out"]}')
                total += 1
        for s in inlines:
            html, ok = insert_inline(html, s)
            if ok:
                print(f'    + card  {s["out"]}  after #{s["anchor"]}')
                total += 1

        # existing hero (articles that already had one) stays first in the array
        existing = re.findall(r'src="\.\./blog-images/([^"]+)\.webp"', html)
        seen, names = set(), []
        for n in existing:
            if n not in seen:
                seen.add(n)
                names.append(n)
        if names:
            html, ok = sync_jsonld_images(html, names)
            if ok and html != original:
                print(f"    ~ schema image[] -> {len(names)}")

        if html != original and not dry:
            p.write_text(html, encoding="utf-8")

    print(f"\n{total} image(s) placed{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
