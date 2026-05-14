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

// Pages that carry live rate numbers in their <title> + meta description.
// Each entry produces both LIVE-RATES:title and LIVE-RATES:desc blocks.
const TARGETS = [
  {
    file: "blog/home-loan-rates-singapore/index.html",
    title: ({ fixed, sora }) =>
      `Singapore Home Loan Rates: Fixed ${fixed}%, SORA ${sora}% — Updated Weekly | Nexus`,
    desc: ({ fixed, sora }) =>
      `Live Singapore home loan rates: fixed from ${fixed}% p.a., SORA-linked from ${sora}% p.a. effective. Compare 16 MAS-regulated banks. Updated weekly. Free, zero fees.`,
  },
];

function fmt(rate) {
  // 2 dp, keep trailing zero (1.40 stays 1.40 — financial display convention).
  return Number(rate).toFixed(2);
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
    if (!r1.changed && !r2.changed) {
      console.warn(`[snippets] ${t.file}: no sentinels found, skipping`);
      continue;
    }
    if (next === html) {
      console.log(`[snippets] ${t.file}: no change`);
      continue;
    }
    if (DRY) {
      console.log(`[snippets] DRY ${t.file}: would write new title/desc`);
      continue;
    }
    await fs.writeFile(abs, next);
    console.log(`[snippets] ${t.file}: updated`);
  }
}

main().catch((err) => {
  console.error("[snippets] FAIL:", err);
  process.exit(1);
});
