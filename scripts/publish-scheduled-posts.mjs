// Auto-publish scheduled blog posts on their publish date.
// Runs daily via .github/workflows/publish-scheduled-posts.yml (09:05 SGT).
//
// For every articles.json entry with status "scheduled" whose date has arrived
// (Singapore time), this script:
//   1. flips status -> "live"
//   2. inserts a sitemap.xml <url> block after the "Blog posts" marker
//   3. inserts an llms.txt line after the "## Blog Articles" heading
//   4. rebakes the /blog/ grid (build-blog-grid.mjs)
// Idempotent: entries already live or already present in sitemap are skipped.
//
// Env for local testing:
//   ASOF=2026-08-14   pretend today is this date (SGT)
//   DRY_RUN=1         report what would change, write nothing
//
// Output: prints one "PUBLISHED <slug>" line per flipped post (consumed by the
// workflow for the commit message and the IndexNow ping list).

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DRY = !!process.env.DRY_RUN;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const p = (f) => ROOT + f;

// "today" at 00:00 Singapore time
function todaySGT() {
  if (process.env.ASOF) return new Date(process.env.ASOF + "T00:00:00+08:00");
  const now = new Date();
  const sgt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  return new Date(sgt.getFullYear(), sgt.getMonth(), sgt.getDate());
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// articles.json dates look like "14 August 2026"
function parseArticleDate(str) {
  const m = String(str).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mon === -1) return null;
  return new Date(+m[3], mon, +m[1]);
}
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const today = todaySGT();
const articles = JSON.parse(readFileSync(p("blog/articles.json"), "utf8"));
let sitemap = readFileSync(p("sitemap.xml"), "utf8");
let llms = readFileSync(p("llms.txt"), "utf8");

const SITEMAP_MARKER = "<!-- Blog posts (live, sorted by recency) -->";
const LLMS_MARKER = "## Blog Articles\n";
if (!sitemap.includes(SITEMAP_MARKER)) throw new Error("sitemap marker missing");
if (!llms.includes(LLMS_MARKER)) throw new Error("llms.txt marker missing");

const published = [];
for (const a of articles) {
  if (a.status !== "scheduled") continue;
  const d = parseArticleDate(a.date);
  if (!d) { console.error(`SKIP ${a.slug}: unparseable date "${a.date}"`); continue; }
  if (d > today) continue;

  a.status = "live";
  published.push(a);

  const url = "https://nexusmortgage.sg" + a.url;
  if (!sitemap.includes(url + "</loc>")) {
    const block = `${SITEMAP_MARKER}
  <url>
    <loc>${url}</loc>
    <lastmod>${iso(d)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    sitemap = sitemap.replace(SITEMAP_MARKER, block);
  }

  if (!llms.includes(url)) {
    const excerpt = String(a.excerpt || "").replace(/\s+/g, " ").slice(0, 300).trim();
    llms = llms.replace(LLMS_MARKER, LLMS_MARKER + `- ${a.title} — ${excerpt}: ${url}\n`);
  }
}

if (!published.length) {
  console.log("Nothing due today (" + iso(today) + ").");
  process.exit(0);
}

if (DRY) {
  published.forEach((a) => console.log("WOULD PUBLISH", a.slug));
  process.exit(0);
}

writeFileSync(p("blog/articles.json"), JSON.stringify(articles, null, 1) + "\n");
writeFileSync(p("sitemap.xml"), sitemap);
writeFileSync(p("llms.txt"), llms);
execFileSync("node", [p("scripts/build-blog-grid.mjs")], { stdio: "inherit" });
published.forEach((a) => console.log("PUBLISHED " + a.slug));
