#!/usr/bin/env python3
"""Flip a scheduled article live: strip noindex, set status live, rebuild grid.

Usage: python3 scripts/publish-article.py <slug>
"""
import sys, os, re, json, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
slug = sys.argv[1]
f = "blog/%s/index.html" % slug
if not os.path.exists(f):
    raise SystemExit("no such article: " + f)

h = open(f, encoding="utf-8").read()
new = re.sub(r'\s*<meta name="robots" content="noindex, nofollow">', '', h, count=1)
if new == h:
    print("note: no noindex tag found (already public?)")
else:
    open(f, "w", encoding="utf-8").write(new)
    print("noindex removed:", slug)

d = json.load(open("blog/articles.json"))
hit = False
for a in d:
    if a["slug"] == slug:
        a["status"] = "live"; hit = True
if not hit:
    raise SystemExit("slug not in articles.json: " + slug)
json.dump(d, open("blog/articles.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("status -> live:", slug)

subprocess.run(["node", "scripts/build-blog-grid.mjs"], check=True)
