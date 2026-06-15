#!/usr/bin/env node
/**
 * update-rate-snippets.mjs — refresh title + meta description rate numbers
 * in target HTML pages from the live rates.json output.
 *
 * Wraps content inside HTML comment sentinels so the script can replace
 * deterministically without disturbing any surrounding markup:
 *
 *   <!-- LIVE-RATES:title -->...current rendered title...<!-- /LIVE-RATES:title -->
 *   <!-- LIVE-RATES:desc -->...current rendered description...<!-- /LIVE-RATES:desc -->
 *
 * Inputs:
 *   - rates.json (refRates + packages[])
 *
 * Effect:
 *   - Computes lowest year1Rate among `category: "Fixed"` packages
 *   - Computes lowest year1Rate among SORA-linked packages
 *   - Rewrites title + meta description for each target page using those numbers
 *
 * Idempotent — running with unchanged rates produces no diff.
 *
 * Run:  node scripts/update-rate-snippets.mjs
 * Flags:
 *   DRY_RUN=1   compute + log, do not write
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RATES = path.join(ROOT, "rates.json");
const DRY = process.env.DRY_RUN === "1";

// Year only for SERP freshness. Deliberately NOT month — a churning "June/July…" in the
// title mismatches month-specific searches (e.g. "…february 2026") and tanks CTR; a year-level
// title ranks for every month-variant. Re-evaluated on each cron run.
const NOW = new Date();
const YEAR = NOW.getFullYear();

// Pages that carry live rate numbers in their <title> + meta description.
// Each entry produces both LIVE-RATES:title and LIVE-RATES:desc blocks.
const TARGETS = [
  {
    file: "blog/home-loan-rates-singapore/index.html",
    // NOTE: sentinels live OUTSIDE these tags in the HTML, so the template emits
    // the FULL tag. Never place LIVE-RATES comments inside <title> (RCDATA) or a
    // content="" attribute — they render as literal text in the SERP title/description.
    title: ({ fixed, sora }) =>
      `<title>Singapore Home Loan Rates ${YEAR}: Fixed ${fixed}%, SORA ${sora}% | Nexus</title>`,
    desc: ({ fixed, sora }) =>
      `<meta name="description" content="Singapore home loan rates ${YEAR}: fixed from ${fixed}% p.a., SORA-linked from ${sora}% p.a. Compare 16 MAS-regulated banks. Updated weekly. Free.">`,
  },
];

function fmt(rate) {
  // 2 dp, keep trailing zero (1.40 stays 1.40 — financial display convention).
  return Number(rate).toFixed(2);
}

const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7,
  august:8, september:9, october:10, november:11, december:12 };

// Parse rates.json `asOf` ("11 May 2026" or "May 2026") -> ISO + pretty display.
function parseAsOf(s) {
  const m = String(s || "").match(/(?:(\d{1,2})\s+)?([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  const day = m[1] ? parseInt(m[1], 10) : 1, yr = parseInt(m[3], 10);
  return {
    iso: `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    pretty: m[1] ? `${day} ${m[2]} ${yr}` : `${m[2]} ${yr}`,
  };
}

// Keep a rate page's visible freshness honest: the displayed "as of" date, the
// author byline date, and JSON-LD dateModified all track rates.json `asOf`
// (= when the rate sheet genuinely last changed). No date-faking — it only moves
// when the rates do. Idempotent.
function freshnessPatch(html, asOf) {
  const p = parseAsOf(asOf);
  if (!p) return { out: html, changed: false };
  let out = html, changed = false;
  const sub = (re, rep) => { const n = out.replace(re, rep); if (n !== out) { changed = true; out = n; } };
  sub(/"dateModified":"\d{4}-\d{2}-\d{2}"/, `"dateModified":"${p.iso}"`);
  sub(/(Mortgage Advisor &middot; Updated )\d{1,2} [A-Za-z]+ 20\d\d/, `$1${p.pretty}`);
  sub(/([Aa]s of )(?:\d{1,2} )?[A-Za-z]+ 20\d\d/g, `$1${p.pretty}`); // visible rate-freshness lines
  return { out, changed };
}

function pickRates(rates) {
  const fixed = rates.packages.filter(
    (p) => String(p.category || "").toLowerCase() === "fixed",
  );
  const sora = rates.packages.filter(
    (p) =>
      String(p.subCategory || "").toLowerCase().includes("sora") ||
      String(p.family || "").toLowerCase() === "sora",
  );
  if (!fixed.length) throw new Error("No fixed-rate packages in rates.json");
  if (!sora.length) throw new Error("No SORA packages in rates.json");
  return {
    fixed: fmt(Math.min(...fixed.map((p) => p.year1Rate))),
    sora: fmt(Math.min(...sora.map((p) => p.year1Rate))),
  };
}

function patchSentinel(html, key, value) {
  const re = new RegExp(
    `<!--\\s*LIVE-RATES:${key}\\s*-->[\\s\\S]*?<!--\\s*/LIVE-RATES:${key}\\s*-->`,
    "g",
  );
  let changed = false;
  const out = html.replace(re, () => {
    changed = true;
    return `<!-- LIVE-RATES:${key} -->${value}<!-- /LIVE-RATES:${key} -->`;
  });
  return { out, changed };
}

async function main() {
  const ratesRaw = await fs.readFile(RATES, "utf8");
  const rates = JSON.parse(ratesRaw);
  const numbers = pickRates(rates);
  console.log("[snippets] rates", numbers);

  for (const t of TARGETS) {
    const abs = path.join(ROOT, t.file);
    const html = await fs.readFile(abs, "utf8");
    let next = html;
    const titleStr = t.title(numbers);
    const descStr = t.desc(numbers);
    const r1 = patchSentinel(next, "title", titleStr);
    next = r1.out;
    const r2 = patchSentinel(next, "desc", descStr);
    next = r2.out;
    const r3 = freshnessPatch(next, rates.asOf); // visible "as of" + byline + dateModified
    next = r3.out;
    if (!r1.changed && !r2.changed) {
      console.warn(`[snippets] ${t.file}: no title/desc sentinels found`);
    }
    if (next === html) {
      console.log(`[snippets] ${t.file}: no change`);
      continue;
    }
    if (DRY) {
      console.log(`[snippets] DRY ${t.file}: would update title/desc${r3.changed ? " + freshness(" + rates.asOf + ")" : ""}`);
      continue;
    }
    await fs.writeFile(abs, next);
    console.log(`[snippets] ${t.file}: updated${r3.changed ? " (freshness -> " + rates.asOf + ")" : ""}`);
  }
}

main().catch((err) => {
  console.error("[snippets] FAIL:", err);
  process.exit(1);
});
