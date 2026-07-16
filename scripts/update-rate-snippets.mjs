#!/usr/bin/env node
/**
 * update-rate-snippets.mjs — refresh title + meta description rate numbers
 * (and other live-rate fragments) on target HTML pages from rates.json.
 *
 * Two sentinel namespaces:
 *
 *   <!-- LIVE-RATES:title -->...full <title>…</title> tag…<!-- /LIVE-RATES:title -->
 *   <!-- LIVE-RATES:desc  -->...full <meta description>…</meta> tag…<!-- /LIVE-RATES:desc -->
 *     Used by the bank-rate landing pages (home-loan-rates blog).
 *
 *   <!-- LIVE-SORA:KEY -->fragment<!-- /LIVE-SORA:KEY -->
 *     Used by the SORA landing page. KEY ∈ {title, desc, 1m, 3m, effective,
 *     asOfSoraHuman, datemod, jumbo, standard, small, commercial, …}.
 *     Fragments are short numbers / dates / sub-tag strings.
 *
 * Inputs:
 *   - rates.json (refRates.sora1m, sora3m, asOfSora + packages[])
 *
 * Effect:
 *   - LIVE-RATES targets: rebuild full <title> + <meta description> from min
 *     fixed-package + min SORA-package year1Rates, plus rates.asOf freshness.
 *   - LIVE-SORA targets: rewrite each fragment from refRates.sora1m / sora3m /
 *     asOfSora and a derived effective home-loan rate (3M + typical spread).
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

// Typical residential SORA spread used to display "effective home-loan rate" on
// the SORA landing page. Roughly the 50th percentile of 2026 quotes across the
// 16 MAS-regulated banks Nexus places loans with. Update if market shifts.
const TYPICAL_SORA_SPREAD_PCT = 0.80;

// LIVE-RATES targets — bank-rate landing pages. Each target rebuilds the FULL
// tag inside the sentinel. Never put sentinels inside <title> RCDATA or
// content="" attributes; they would render as literal text in SERPs.
const RATE_TARGETS = [
  {
    file: "blog/home-loan-rates-singapore/index.html",
    title: ({ fixed, sora }) =>
      `<title>Singapore Home Loan Rates ${YEAR}: Fixed ${fixed}%, SORA ${sora}% | Nexus</title>`,
    desc: ({ fixed, sora }) =>
      `<meta name="description" content="Singapore home loan rates ${YEAR}: fixed from ${fixed}% p.a., SORA-linked from ${sora}% p.a. Compare 16 MAS-regulated banks. Updated weekly. Free.">`,
  },
];

// LIVE-SORA targets — SORA-specific landing page. fragments() returns a
// {sentinelKey: fragmentString} map; every sentinel block on the page that
// matches a key gets rewritten. Keys not present in the map are left alone.
const SORA_TARGETS = [
  {
    file: "sora-rates-singapore/index.html",
    fragments: ({ sora1m, sora3m, asOfSoraIso, asOfSoraHuman, effective, jumboLow, jumboHigh, stdLow, stdHigh, smallLow, smallHigh, commLow, commHigh }) => ({
      // Full-tag rebuilds — sentinels must wrap the WHOLE tag from outside
      // (sentinels inside <title> RCDATA / content="" render as literal SERP text).
      "titletag": `<title>SORA Rate Today Singapore: 1M ${sora1m}% &amp; 3M ${sora3m}% (Updated Daily) | Nexus</title>`,
      "desctag": `<meta name="description" content="Live Singapore SORA rate today: 1M Compounded SORA ${sora1m}%, 3M Compounded SORA ${sora3m}% as of ${asOfSoraHuman}. Daily MAS feed, historical trend, home-loan effective rate.">`,
      "1m": sora1m,
      "3m": sora3m,
      "3m2": sora3m,
      "3m3": sora3m,
      "3m4": sora3m,
      "1m3": sora1m,
      "asOfSoraHuman": asOfSoraHuman,
      "asOfSoraHuman2": asOfSoraHuman,
      "effective": effective,
      "effective2": effective,
      "jumbo": `${jumboLow}–${jumboHigh}`,
      "standard": `${stdLow}–${stdHigh}`,
      "small": `${smallLow}–${smallHigh}`,
      "commercial": `${commLow}–${commHigh}`,
      "datemod": asOfSoraIso,
    }),
  },
];

function fmt(rate, dp = 2) {
  return Number(rate).toFixed(dp);
}

const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7,
  august:8, september:9, october:10, november:11, december:12 };
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

// Parse refRates.asOfSora — already in ISO 'YYYY-MM-DD'. Return ISO + "25 June 2026".
function parseAsOfSora(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const moIdx = parseInt(mo, 10) - 1;
  if (moIdx < 0 || moIdx > 11) return null;
  return {
    iso,
    pretty: `${parseInt(d, 10)} ${MONTH_NAMES[moIdx]} ${y}`,
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
  sub(/([Aa]s of )(?:\d{1,2} )?[A-Za-z]+ 20\d\d/g, `$1${p.pretty}`);
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

function pickSora(rates) {
  const r = rates.refRates || {};
  if (typeof r.sora1m !== "number" || typeof r.sora3m !== "number")
    throw new Error("refRates.sora1m / sora3m missing from rates.json");
  const p = parseAsOfSora(r.asOfSora);
  if (!p) throw new Error(`refRates.asOfSora not parseable: ${r.asOfSora}`);
  const sora1m = fmt(r.sora1m);
  const sora3m = fmt(r.sora3m);
  const effective = fmt(r.sora3m + TYPICAL_SORA_SPREAD_PCT);
  // Spread band edges (low/high) by loan profile — see notes in TARGET above.
  const band = (lowSpread, highSpread) => [
    fmt(r.sora3m + lowSpread),
    fmt(r.sora3m + highSpread),
  ];
  const [jumboLow, jumboHigh] = band(0.60, 0.80);
  const [stdLow, stdHigh]     = band(0.80, 0.95);
  const [smallLow, smallHigh] = band(0.95, 1.20);
  const [commLow, commHigh]   = band(1.00, 1.80);
  return {
    sora1m, sora3m, effective,
    asOfSoraIso: p.iso,
    asOfSoraHuman: p.pretty,
    jumboLow, jumboHigh, stdLow, stdHigh,
    smallLow, smallHigh, commLow, commHigh,
  };
}

function patchSentinel(html, prefix, key, value) {
  const re = new RegExp(
    `<!--\\s*${prefix}:${key}\\s*-->[\\s\\S]*?<!--\\s*/${prefix}:${key}\\s*-->`,
    "g",
  );
  let changed = false;
  const out = html.replace(re, () => {
    changed = true;
    return `<!-- ${prefix}:${key} -->${value}<!-- /${prefix}:${key} -->`;
  });
  return { out, changed };
}

async function processRateTarget(t, numbers, rates) {
  const abs = path.join(ROOT, t.file);
  const html = await fs.readFile(abs, "utf8");
  let next = html;
  const r1 = patchSentinel(next, "LIVE-RATES", "title", t.title(numbers));
  next = r1.out;
  const r2 = patchSentinel(next, "LIVE-RATES", "desc", t.desc(numbers));
  next = r2.out;
  const r3 = freshnessPatch(next, rates.asOf);
  next = r3.out;
  if (!r1.changed && !r2.changed) console.warn(`[snippets] ${t.file}: no title/desc sentinels found`);
  if (next === html) return { file: t.file, status: "no-change" };
  if (DRY) return { file: t.file, status: "would-update" };
  await fs.writeFile(abs, next);
  return { file: t.file, status: "updated" };
}

async function processSoraTarget(t, sora) {
  const abs = path.join(ROOT, t.file);
  const html = await fs.readFile(abs, "utf8");
  const map = t.fragments(sora);
  let next = html, anyChanged = false;
  for (const [key, value] of Object.entries(map)) {
    const r = patchSentinel(next, "LIVE-SORA", key, value);
    next = r.out;
    if (r.changed) anyChanged = true;
  }
  if (!anyChanged) console.warn(`[snippets] ${t.file}: no LIVE-SORA sentinels found`);
  if (next === html) return { file: t.file, status: "no-change" };
  if (DRY) return { file: t.file, status: "would-update" };
  await fs.writeFile(abs, next);
  return { file: t.file, status: "updated" };
}

async function main() {
  const ratesRaw = await fs.readFile(RATES, "utf8");
  const rates = JSON.parse(ratesRaw);
  const numbers = pickRates(rates);
  const sora = pickSora(rates);
  console.log("[snippets] rate-package mins", numbers);
  console.log("[snippets] sora", { sora1m: sora.sora1m, sora3m: sora.sora3m, effective: sora.effective, asOf: sora.asOfSoraHuman });

  const all = [];
  for (const t of RATE_TARGETS) all.push(await processRateTarget(t, numbers, rates));
  for (const t of SORA_TARGETS) all.push(await processSoraTarget(t, sora));

  for (const r of all) console.log(`[snippets] ${r.file}: ${r.status}`);
}

main().catch((err) => {
  console.error("[snippets] FAIL:", err);
  process.exit(1);
});

// Keep the static crawler-visible rates table on /mortgage-rates/ in sync daily.
await import("./build-rates-static-table.mjs");
