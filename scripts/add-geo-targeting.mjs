#!/usr/bin/env node
/**
 * add-geo-targeting.mjs — one-shot geo + hreflang injection.
 *
 * Inserts the following block immediately after <link rel="canonical">
 * on every non-stub HTML page, using each page's own canonical URL for
 * hreflang. Idempotent — running twice is a no-op.
 *
 *   <meta name="geo.region" content="SG">
 *   <meta name="geo.placename" content="Singapore">
 *   <meta name="geo.position" content="1.3527;103.8429">
 *   <meta name="ICBM" content="1.3527, 103.8429">
 *   <link rel="alternate" hreflang="en-sg" href="{canonical}">
 *   <link rel="alternate" hreflang="x-default" href="{canonical}">
 *
 * Also injects <meta property="og:locale" content="en_SG"> when missing.
 *
 * Skips:
 *   - 404.html
 *   - redirect-stub HTMLs (any file with <meta http-equiv="refresh">)
 *   - any file without a <link rel="canonical">
 *
 * Run:  node scripts/add-geo-targeting.mjs
 * Flags: DRY_RUN=1
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DRY = process.env.DRY_RUN === "1";

const SKIP_DIRS = [
  "node_modules",
  ".git",
  "login",
  "blog/blog-images-png-backup",
];
const SKIP_FILES = new Set(["404.html"]);

const GEO_BLOCK_MARKER = "geo.region";

const SENTINEL = "<!-- GEO-TARGETING:auto -->";

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(ROOT, abs);
    if (SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep))) continue;
    if (e.isDirectory()) {
      await walk(abs, out);
    } else if (e.isFile() && e.name.endsWith(".html") && !SKIP_FILES.has(e.name)) {
      out.push(abs);
    }
  }
  return out;
}

function isRedirectStub(html) {
  return /<meta\s+http-equiv=["']refresh["']/i.test(html);
}

function getCanonical(html) {
  const m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function alreadyHasGeo(html) {
  return html.includes(GEO_BLOCK_MARKER) || html.includes(SENTINEL);
}

function hasOgLocale(html) {
  return /<meta\s+property=["']og:locale["']/i.test(html);
}

function buildGeoBlock(canonical) {
  return [
    SENTINEL,
    `  <meta name="geo.region" content="SG">`,
    `  <meta name="geo.placename" content="Singapore">`,
    `  <meta name="geo.position" content="1.3527;103.8429">`,
    `  <meta name="ICBM" content="1.3527, 103.8429">`,
    `  <link rel="alternate" hreflang="en-sg" href="${canonical}">`,
    `  <link rel="alternate" hreflang="x-default" href="${canonical}">`,
  ].join("\n  ");
}

async function processFile(abs) {
  const rel = path.relative(ROOT, abs);
  const html = await fs.readFile(abs, "utf8");

  if (isRedirectStub(html)) return { rel, status: "skip-stub" };
  if (alreadyHasGeo(html)) return { rel, status: "skip-already" };

  const canonical = getCanonical(html);
  if (!canonical) return { rel, status: "skip-no-canonical" };

  const block = buildGeoBlock(canonical);

  // Insert immediately after the canonical line.
  let next = html.replace(
    /(<link\s+rel=["']canonical["']\s+href=["'][^"']+["']\s*\/?>)/i,
    `$1\n  ${block}`,
  );

  // Add og:locale if missing — drop it next to canonical block as well.
  if (!hasOgLocale(next)) {
    next = next.replace(
      new RegExp(SENTINEL),
      `${SENTINEL}\n  <meta property="og:locale" content="en_SG">`,
    );
  }

  if (next === html) return { rel, status: "no-change" };
  if (!DRY) await fs.writeFile(abs, next);
  return { rel, status: "updated", canonical };
}

async function main() {
  const files = await walk(ROOT);
  const results = await Promise.all(files.map(processFile));
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  for (const r of results.filter((x) => x.status === "updated")) {
    console.log(`[geo] + ${r.rel}`);
  }
  for (const r of results.filter((x) => x.status === "skip-no-canonical")) {
    console.log(`[geo] ? ${r.rel} — no canonical, skipped`);
  }
  console.log("[geo] summary", counts);
}

main().catch((e) => {
  console.error("[geo] FAIL", e);
  process.exit(1);
});
