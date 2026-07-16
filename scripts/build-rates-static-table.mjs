// Rebuilds the static best-rates-by-bank table in mortgage-rates/index.html
// from rates.json. The interactive widget is client-fetched, so this baked
// table is what non-JS crawlers (Googlebot pre-render, GPTBot, PerplexityBot)
// actually see. Chained from update-rate-snippets.mjs so the daily rates bot
// keeps it fresh; safe to run standalone: node scripts/build-rates-static-table.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = join(ROOT, "mortgage-rates", "index.html");
const rates = JSON.parse(readFileSync(join(ROOT, "rates.json"), "utf8"));

const NAMES = { DBS: "DBS", OCBC: "OCBC", UOB: "UOB", HSBC: "HSBC", SCB: "Standard Chartered", MB: "Maybank", CITI: "Citibank", RHB: "RHB", BOC: "Bank of China", SBI: "SBI" };
const LINKS = { DBS: "/dbs-home-loan/", OCBC: "/ocbc-home-loan/", UOB: "/uob-home-loan/", HSBC: "/hsbc-home-loan/", SCB: "/standard-chartered-home-loan/", MB: "/maybank-home-loan/" };
const td = `style="padding:.6rem .9rem;border-bottom:1px solid rgba(196,151,59,.12);"`;

const rows = Object.keys(NAMES)
  .map((code) => {
    const sub = rates.packages.filter((p) => p.lender === code);
    if (!sub.length) return null;
    const best = (cat) => {
      const c = sub.filter((p) => p.category === cat);
      return c.length ? c.reduce((a, b) => (a.year1Rate <= b.year1Rate ? a : b)) : null;
    };
    const bf = best("Fixed"), bv = best("Variable");
    const cell = LINKS[code]
      ? `<a href="${LINKS[code]}" style="color:var(--gold-400);font-weight:600;text-decoration:none;">${NAMES[code]}</a>`
      : NAMES[code];
    const fmt = (p) =>
      p ? `${p.year1Rate.toFixed(2)}% <span style='opacity:.55;font-size:.8em'>(${p.subCategory.split(" (")[0]})</span>` : "—";
    return `      <tr><td data-l='Bank' ${td}>${cell}</td><td data-l='Best fixed (Yr 1)' ${td}>${fmt(bf)}</td><td data-l='Best floating (Yr 1)' ${td}>${fmt(bv)}</td></tr>`;
  })
  .filter(Boolean);

const block = `<!-- LIVE-RATES-STATIC-TABLE -->
<div class="rates-static-fallback" style="margin:0 0 2rem;">
  <h2 style="font-family:'Cormorant Garamond',serif;font-size:clamp(1.5rem,3.5vw,2rem);font-weight:400;margin:0 0 .4rem;">Best Home Loan Rates by Bank <em style="font-style:italic;color:var(--gold-400,#E8C97A);">(as of ${rates.asOf})</em></h2>
  <p style="font-size:.85rem;opacity:.65;margin:0 0 1rem;">Representative lowest-tier Year-1 rate per lender across ${rates.packages.length} packages. Indicative only — exact pricing depends on loan size and profile. Interactive comparison below.</p>
  <div style="overflow-x:auto;border:1px solid rgba(196,151,59,.2);border-radius:12px;">
  <table style="width:100%;border-collapse:collapse;font-size:.9rem;min-width:520px;">
    <thead><tr style="text-align:left;">
      <th style="padding:.7rem .9rem;border-bottom:2px solid rgba(196,151,59,.35);">Bank</th>
      <th style="padding:.7rem .9rem;border-bottom:2px solid rgba(196,151,59,.35);">Best fixed (Yr 1)</th>
      <th style="padding:.7rem .9rem;border-bottom:2px solid rgba(196,151,59,.35);">Best floating (Yr 1)</th>
    </tr></thead>
    <tbody>
${rows.join("\n")}
    </tbody>
  </table>
  </div>
</div>
<!-- /LIVE-RATES-STATIC-TABLE -->`;

let html = readFileSync(HTML, "utf8");
const re = /<!-- LIVE-RATES-STATIC-TABLE -->[\s\S]*?<!-- \/LIVE-RATES-STATIC-TABLE -->/;
if (!re.test(html)) {
  console.error("[rates-static-table] sentinels not found in mortgage-rates/index.html");
  process.exit(1);
}
const next = html.replace(re, block);
if (next !== html) {
  writeFileSync(HTML, next);
  console.log(`[rates-static-table] rebuilt (${rows.length} banks, as of ${rates.asOf})`);
} else {
  console.log("[rates-static-table] no-change");
}
