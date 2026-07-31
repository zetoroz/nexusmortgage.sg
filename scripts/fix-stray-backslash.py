#!/usr/bin/env python3
"""Remove stray literal backslashes left by the 'Part of:' cluster-box injection.

The injector emitted a literal backslash before each real newline, so a visible
"\" renders at the start of the box and again after it. Scoped to that block only:
a backslash is removed only when it sits immediately before a newline inside the
injected cluster div (or on the line that closes it), never inside script/style.
"""
import re, sys, glob, os

DRY = "--apply" not in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# opening tag of the injected cluster box
OPEN = re.compile(r'<div style="background:rgba\(196,151,59,\.07\);[^"]*">')

total = files = 0
for p in sorted(glob.glob("blog/*/index.html")) + sorted(glob.glob("*/index.html")):
    h = open(p, encoding="utf-8").read()
    m = OPEN.search(h)
    if not m:
        continue
    start = m.start()
    # region = the box plus the few lines after it that the injector also touched
    end = h.find("</div>", start)
    if end == -1:
        continue
    end = h.find("\n", end + 6)
    if end == -1:
        continue
    end += 1  # include the newline so a trailing backslash still matches the lookahead
    region = h[start:end]
    if "\\" not in region:
        continue
    fixed = re.sub(r'\\(?=\r?\n)', '', region)
    n = region.count("\\") - fixed.count("\\")
    if not n:
        continue
    total += n; files += 1
    print("  %-60s -%d" % (p, n))
    if not DRY:
        open(p, "w", encoding="utf-8").write(h[:start] + fixed + h[end:])

print("\n%s: %d backslashes across %d files" % ("DRY RUN" if DRY else "APPLIED", total, files))
if DRY:
    print("re-run with --apply to write")
