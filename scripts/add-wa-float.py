#!/usr/bin/env python3
"""Add the floating WhatsApp button to blog articles.

Every site page carries #wa-float, but the article template never did, so all
46 posts shipped without it. This adds the same button with the same markup,
and lifts the back-to-top button above it so the two do not overlap.

  python3 scripts/add-wa-float.py [--dry-run]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WA_HREF = "https://wa.me/6587520859?text=Hi%2C+I%27d+like+a+free+mortgage+consultation."

WA_CSS = (
    "    #wa-float{position:fixed;bottom:1.5rem;right:1.5rem;width:52px;height:52px;border-radius:50%;"
    "background:#25D366;display:flex;align-items:center;justify-content:center;"
    "box-shadow:0 12px 28px rgba(37,211,102,.36);z-index:998;transition:transform .25s}\n"
    "    #wa-float:hover{transform:scale(1.07)}\n"
    "    #wa-float:focus-visible{outline:3px solid #c4973b;outline-offset:3px}\n"
    "    @media(prefers-reduced-motion:reduce){#wa-float{transition:none}}\n"
)

WA_SVG = (
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">'
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 '
    "1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458."
    "13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-"
    ".242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 "
    "1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 "
    "1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 "
    "01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 "
    "2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 "
    "11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 "
    '005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'
)

WA_HTML = (
    f'<a id="wa-float" href="{WA_HREF}" target="_blank" rel="noopener" '
    f'aria-label="WhatsApp Nexus Mortgage">\n  {WA_SVG}\n</a>\n\n'
)


def main():
    dry = "--dry-run" in sys.argv
    arts = sorted(p for p in ROOT.glob("blog/*/index.html"))
    done = skipped = 0

    for p in arts:
        html = original = p.read_text(encoding="utf-8")
        slug = p.parent.name
        if 'id="wa-float"' in html:
            skipped += 1
            continue

        # 1. CSS, next to the back-to-top rules where possible
        if "#btt{" in html:
            html = html.replace("    #btt{", WA_CSS + "    #btt{", 1)
        else:
            m = re.search(r"\n(\s*)</style>", html)
            if not m:
                print(f"  SKIP {slug}: no <style> block")
                continue
            html = html[: m.start()] + "\n" + WA_CSS + html[m.start() + 1 :]

        # 2. lift back-to-top above the new button so they do not overlap
        html = re.sub(r"(#btt\s*\{[^}]*?bottom:)\s*2rem", r"\g<1>5.5rem", html, count=1)

        # 3. markup, immediately before the back-to-top anchor
        m = re.search(r'\n<a id="btt"', html)
        if m:
            html = html[: m.start() + 1] + WA_HTML + html[m.start() + 1 :]
        else:
            m = re.search(r"\n</body>", html)
            if not m:
                print(f"  SKIP {slug}: no </body>")
                continue
            html = html[: m.start() + 1] + WA_HTML + html[m.start() + 1 :]

        if html != original:
            if not dry:
                p.write_text(html, encoding="utf-8")
            done += 1
            print(f"  + {slug}")

    print(f"\n{done} article(s) updated, {skipped} already had it{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
