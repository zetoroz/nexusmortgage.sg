#!/usr/bin/env node
/**
 * fetch-ura-data.mjs — private residential price index from the URA Data Service.
 *
 * Mirrors scripts/fetch-mas-rates.mjs in shape: fetch official data, derive a small
 * published aggregate, append an audit entry, regenerate machine-readable feeds.
 *
 * Run:  node scripts/fetch-ura-data.mjs
 * Env:
 *   URA_ACCESS_KEY   AccessKey issued by URA on account activation (NEVER commit)
 *   DRY_RUN=1        fetch + aggregate + log, do not write
 *   FEEDS_ONLY=1     skip URA fetch, regenerate feeds from existing ura-prices.json
 *   URA_RAW_DIR      optional dir to dump raw batch payloads for debugging (gitignored)
 *
 * Effect:
 *   - Writes ura-prices.json      (published aggregate: districts, segments, quarters)
 *   - Appends to ura-history.json (audit log of index movements)
 *   - Writes ura-feed.json        (llms.txt / agent feed)
 *   - Writes ura.xml              (RSS)
 *   - Exit 0 on success or graceful skip; exit 1 only on hard failure with no prior data.
 *
 * IMPORTANT (YMYL): every number published here is derived from URA caveat data and is
 * an aggregate only. It is not a valuation. Do not surface per-unit figures as advice.
 * Raw transaction payloads are NEVER committed — only the derived aggregate is.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PRICES = path.join(ROOT, "ura-prices.json");
const HISTORY = path.join(ROOT, "ura-history.json");
const FEED = path.join(ROOT, "ura-feed.json");
const RSS = path.join(ROOT, "ura.xml");

const URA_BASE = "https://eservice.ura.gov.sg/uraDataService";
const TOKEN_URL = `${URA_BASE}/insertNewToken/v1`;
const DS_URL = `${URA_BASE}/invokeUraDS/v1`;

/**
 * URA's official Private Residential Property Price Index, via data.gov.sg.
 * Open Data Licence, no auth. Base 2009Q1 = 100, compiled with stratified hedonic
 * regression, so it is quality- and mix-adjusted.
 *
 * This is the ONLY number we publish as "the price index". The median PSF derived
 * from PMI_Resi_Transaction below is mix-driven and moves very differently: for
 * 2026Q2 the official PPI rose 0.50% QoQ / 2.91% YoY while the raw median PSF
 * showed 1.17% / 7.56%. Quoting the median as a price movement would be wrong.
 */
const PPI_RESOURCE_ID = "d_97f8a2e995022d311c6c68cfda6d034c";
const PPI_URL = `https://data.gov.sg/api/action/datastore_search?resource_id=${PPI_RESOURCE_ID}&limit=200&offset=418`;

const URA_ACCESS_KEY = process.env.URA_ACCESS_KEY || "";
const RAW_DIR = process.env.URA_RAW_DIR || "";
const DRY = process.env.DRY_RUN === "1";
const FEEDS_ONLY = process.argv.includes("--feeds-only") || process.env.FEEDS_ONLY === "1";

const SQM_TO_SQFT = 10.7639;
/** How many trailing quarters to publish in the index series. */
const QUARTERS_PUBLISHED = 12;
/** A district/segment/quarter cell is suppressed below this many units. */
const MIN_UNITS = 20;

function log(...a) { console.log("[fetch-ura]", ...a); }
function warn(...a) { console.warn("[fetch-ura]", ...a); }

function isoDateSGT(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

async function readJson(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); }
  catch { return fallback; }
}

async function writeJson(p, obj) {
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function escapeXml(s) {
  return String(s ?? "").replace(/[<>&'"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

/**
 * URA contractDate is "MMYY" (e.g. "0625" = June 2025). Returns { year, quarter, key }
 * or null when unparseable. Two-digit years are assumed 2000s; URA only serves 5 years.
 */
function parseContractDate(mmyy) {
  const s = String(mmyy ?? "").trim();
  if (!/^\d{4}$/.test(s)) return null;
  const mm = parseInt(s.slice(0, 2), 10);
  const yy = parseInt(s.slice(2), 10);
  if (mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  const quarter = Math.floor((mm - 1) / 3) + 1;
  return { year, quarter, key: `${year}Q${quarter}` };
}

/** Compare "2025Q3" style keys chronologically. */
function quarterCmp(a, b) {
  const [ay, aq] = a.split("Q").map(Number);
  const [by, bq] = b.split("Q").map(Number);
  return ay - by || aq - bq;
}

/** Weighted median over [{ value, weight }]. Returns null on empty input. */
function weightedMedian(items) {
  const arr = items.filter(x => Number.isFinite(x.value) && x.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (!arr.length) return null;
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let cum = 0;
  for (const x of arr) {
    cum += x.weight;
    if (cum >= total / 2) return x.value;
  }
  return arr[arr.length - 1].value;
}

function round(n, dp = 0) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

/**
 * URA market segment codes. CCR = Core Central Region, RCR = Rest of Central Region,
 * OCR = Outside Central Region. The API returns these codes directly.
 */
const SEGMENT_NAMES = {
  CCR: "Core Central Region",
  RCR: "Rest of Central Region",
  OCR: "Outside Central Region"
};

const SALE_TYPES = { "1": "New Sale", "2": "Sub Sale", "3": "Resale" };

async function requestToken() {
  if (!URA_ACCESS_KEY) throw new Error("URA_ACCESS_KEY not set");
  const r = await fetch(TOKEN_URL, {
    headers: {
      AccessKey: URA_ACCESS_KEY,
      Accept: "application/json",
      // URA's WAF rejects requests without a conventional browser-ish UA.
      "User-Agent": "Mozilla/5.0 (compatible; nexusmortgage-ura-bot/1.0)"
    },
    signal: AbortSignal.timeout(30_000)
  });
  if (!r.ok) throw new Error(`URA token HTTP ${r.status}`);
  const j = await r.json();
  const token = j?.Result || j?.result;
  if (!token) throw new Error(`URA token missing in response: ${JSON.stringify(j).slice(0, 200)}`);
  log(`token acquired (ends ...${String(token).slice(-6)})`);
  return token;
}

/**
 * Pulls the official PPI series and returns the latest quarter plus QoQ/YoY for
 * "All Residential". Returns null on failure — the aggregate stays publishable
 * without it, but the page must then not claim a price movement.
 */
async function fetchOfficialPpi() {
  const r = await fetch(PPI_URL, {
    headers: { Accept: "application/json", "User-Agent": "nexusmortgage-ura-bot/1.0" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!r.ok) throw new Error(`data.gov.sg PPI HTTP ${r.status}`);
  const j = await r.json();
  const recs = j?.result?.records;
  if (!Array.isArray(recs) || !recs.length) throw new Error("PPI empty record set");

  // Records are "1975-Q1" style; sort chronologically and take the newest quarter.
  const qKey = s => {
    const m = /^(\d{4})-Q([1-4])$/.exec(String(s || ""));
    return m ? Number(m[1]) * 10 + Number(m[2]) : -1;
  };
  const byType = t => recs.filter(x => x.property_type === t).sort((a, b) => qKey(a.quarter) - qKey(b.quarter));
  const all = byType("All Residential");
  if (all.length < 5) throw new Error(`PPI series too short (${all.length})`);

  const latest = all[all.length - 1];
  const prevQ = all[all.length - 2];
  const prevY = all[all.length - 5];
  const pct = (a, b) => (a != null && b != null && b !== 0) ? round(((a - b) / b) * 100, 2) : null;
  const idx = x => numOrNull(x?.index);
  const latestOf = t => {
    const s = byType(t);
    const hit = s.filter(x => x.quarter === latest.quarter).pop();
    return idx(hit);
  };

  return {
    source: "URA Private Residential Property Price Index via data.gov.sg",
    basis: "Base quarter 2009-Q1 = 100. Stratified hedonic regression (quality- and mix-adjusted).",
    licence: "Singapore Open Data Licence",
    quarter: String(latest.quarter).replace("-", ""),
    allResidential: idx(latest),
    landed: latestOf("Landed"),
    nonLanded: latestOf("Non-Landed"),
    qoqPct: pct(idx(latest), idx(prevQ)),
    yoyPct: pct(idx(latest), idx(prevY))
  };
}

async function fetchBatch(token, batch) {
  const url = `${DS_URL}?service=PMI_Resi_Transaction&batch=${batch}`;
  const r = await fetch(url, {
    headers: {
      AccessKey: URA_ACCESS_KEY,
      Token: token,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; nexusmortgage-ura-bot/1.0)"
    },
    signal: AbortSignal.timeout(120_000)
  });
  if (!r.ok) throw new Error(`URA batch ${batch} HTTP ${r.status}`);
  const j = await r.json();
  if (String(j?.Status || "").toLowerCase() !== "success") {
    throw new Error(`URA batch ${batch} status=${j?.Status} msg=${j?.Message}`);
  }
  const result = j?.Result;
  if (!Array.isArray(result)) throw new Error(`URA batch ${batch} Result not an array`);
  if (RAW_DIR) {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.writeFile(path.join(RAW_DIR, `ura-batch-${batch}.json`), JSON.stringify(j), "utf8");
  }
  log(`batch ${batch}: ${result.length} projects`);
  return result;
}

/**
 * Flattens URA's project -> transaction[] shape into observation rows.
 * Each row carries PSF plus the dimensions we aggregate on.
 */
function flatten(projects) {
  const rows = [];
  for (const p of projects) {
    const segment = String(p?.marketSegment || "").toUpperCase() || null;
    const txns = Array.isArray(p?.transaction) ? p.transaction : [];
    for (const t of txns) {
      const price = numOrNull(t?.price);
      const areaSqm = numOrNull(t?.area);
      const when = parseContractDate(t?.contractDate);
      if (price == null || areaSqm == null || areaSqm <= 0 || !when) continue;
      const units = Math.max(1, parseInt(t?.noOfUnits, 10) || 1);
      // URA prices are the total transacted price for the record (all units in it).
      const psf = price / units / (areaSqm * SQM_TO_SQFT);
      if (!Number.isFinite(psf) || psf <= 0) continue;
      rows.push({
        psf,
        pricePerUnit: price / units,
        units,
        segment,
        district: String(t?.district || "").padStart(2, "0"),
        propertyType: t?.propertyType || null,
        saleType: SALE_TYPES[String(t?.typeOfSale)] || null,
        tenure: t?.tenure || null,
        quarter: when.key
      });
    }
  }
  return rows;
}

/** Builds one aggregate cell from a set of rows. Returns null if below MIN_UNITS. */
function cell(rows) {
  const units = rows.reduce((s, r) => s + r.units, 0);
  if (units < MIN_UNITS) return null;
  return {
    medianPsf: round(weightedMedian(rows.map(r => ({ value: r.psf, weight: r.units })))),
    medianPrice: round(weightedMedian(rows.map(r => ({ value: r.pricePerUnit, weight: r.units })))),
    units
  };
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function aggregate(rows) {
  const quarters = [...new Set(rows.map(r => r.quarter))].sort(quarterCmp);
  // Drop the newest quarter if it is still filling up: URA caveats lag ~2-3 weeks, so the
  // in-progress quarter understates volume and skews the median. Publish complete ones only.
  const series = quarters.slice(-(QUARTERS_PUBLISHED + 1));
  const latestComplete = series[series.length - 2] || series[series.length - 1] || null;
  const published = series.filter(q => quarterCmp(q, latestComplete) <= 0).slice(-QUARTERS_PUBLISHED);

  const inScope = rows.filter(r => published.includes(r.quarter));
  const latestRows = rows.filter(r => r.quarter === latestComplete);

  // Trailing 12 months = last 4 published quarters, used for the district table so that
  // thin districts still clear MIN_UNITS.
  const ttmQuarters = published.slice(-4);
  const ttmRows = rows.filter(r => ttmQuarters.includes(r.quarter));

  const byQuarter = [];
  for (const q of published) {
    const qRows = inScope.filter(r => r.quarter === q);
    const overall = cell(qRows);
    const segs = {};
    for (const [seg, sRows] of groupBy(qRows, r => r.segment)) {
      if (!SEGMENT_NAMES[seg]) continue;
      const c = cell(sRows);
      if (c) segs[seg] = c;
    }
    byQuarter.push({ quarter: q, ...(overall || { medianPsf: null, medianPrice: null, units: 0 }), segments: segs });
  }

  const byDistrict = [];
  for (const [d, dRows] of [...groupBy(ttmRows, r => r.district)].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!/^\d{2}$/.test(d)) continue;
    const c = cell(dRows);
    if (!c) continue;
    byDistrict.push({
      district: d,
      segment: (groupBy(dRows, r => r.segment).size
        ? [...groupBy(dRows, r => r.segment)].sort((a, b) => b[1].length - a[1].length)[0][0]
        : null),
      ...c
    });
  }

  const bySegment = {};
  for (const [seg, sRows] of groupBy(latestRows, r => r.segment)) {
    if (!SEGMENT_NAMES[seg]) continue;
    const c = cell(sRows);
    if (c) bySegment[seg] = { name: SEGMENT_NAMES[seg], ...c };
  }

  const bySaleType = {};
  for (const [st, sRows] of groupBy(latestRows, r => r.saleType)) {
    const c = cell(sRows);
    if (c) bySaleType[st] = c;
  }

  // Quarter-on-quarter and year-on-year movement on the overall median PSF.
  const idx = byQuarter.map(q => q.medianPsf);
  const last = idx[idx.length - 1] ?? null;
  const prevQ = idx[idx.length - 2] ?? null;
  const prevY = idx.length >= 5 ? idx[idx.length - 5] : null;
  const pct = (a, b) => (a != null && b != null && b !== 0) ? round(((a - b) / b) * 100, 2) : null;

  return {
    latestQuarter: latestComplete,
    totalUnitsLatestQuarter: latestRows.reduce((s, r) => s + r.units, 0),
    // Descriptive statistics only. medianPsf answers "what did units go for", NOT
    // "how much have prices moved" — the quarter-on-quarter swing here is dominated
    // by which projects happened to transact. Price movement comes from priceIndex.
    medianTransacted: {
      note: "Median transacted PSF from URA caveats. Mix-affected and NOT a price index. "
          + "For price movement use priceIndex (official URA PPI).",
      medianPsf: last,
      medianPsfQoqPct: pct(last, prevQ),
      medianPsfYoyPct: pct(last, prevY)
    },
    bySegment,
    bySaleType,
    byDistrict,
    byQuarter
  };
}

async function main() {
  const prev = await readJson(PRICES, null);
  const history = await readJson(HISTORY, []);

  let agg = null;
  if (FEEDS_ONLY) {
    log("--feeds-only: skipping URA fetch, regenerating feeds from ura-prices.json");
    if (!prev) { warn("no existing ura-prices.json — nothing to regenerate"); process.exit(1); }
    agg = prev;
  } else {
    try {
      const token = await requestToken();
      const all = [];
      for (const b of [1, 2, 3, 4]) {
        all.push(...await fetchBatch(token, b));
      }
      const rows = flatten(all);
      log(`flattened ${rows.length} transactions across ${all.length} projects`);
      if (rows.length < 1000) throw new Error(`implausibly few transactions (${rows.length}) — refusing to publish`);

      let priceIndex = null;
      try {
        priceIndex = await fetchOfficialPpi();
        log(`official PPI ${priceIndex.quarter}: ${priceIndex.allResidential} ` +
            `(QoQ ${priceIndex.qoqPct}%, YoY ${priceIndex.yoyPct}%)`);
      } catch (e) {
        warn("official PPI fetch failed:", e.message);
        warn("publishing medians without a price-movement claim");
      }

      agg = {
        source: "Urban Redevelopment Authority (URA) Data Service, PMI_Resi_Transaction",
        attribution: "Contains information from URA accessed via the URA Data Service.",
        note: "Aggregated caveat data. Indicative only, not a valuation.",
        generatedAt: new Date().toISOString(),
        asOf: isoDateSGT(),
        priceIndex,
        ...aggregate(rows)
      };
      const mt = agg.medianTransacted;
      log(`latest complete quarter ${agg.latestQuarter}: median PSF S$${mt.medianPsf} ` +
          `(mix-affected: ${mt.medianPsfQoqPct}% QoQ, ${mt.medianPsfYoyPct}% YoY)`);
    } catch (e) {
      warn("URA fetch failed:", e.message);
      if (!prev) { warn("no prior ura-prices.json to fall back to — exiting non-zero"); process.exit(1); }
      warn("keeping existing ura-prices.json; regenerating feeds only");
      agg = prev;
    }
  }

  if (DRY) { log("DRY_RUN=1, not writing"); return; }

  // Only append history when the published quarter or index actually moved.
  const moved = !prev
    || prev.latestQuarter !== agg.latestQuarter
    || prev.medianTransacted?.medianPsf !== agg.medianTransacted?.medianPsf
    || prev.priceIndex?.allResidential !== agg.priceIndex?.allResidential;
  if (moved && !FEEDS_ONLY) {
    const pi = agg.priceIndex;
    history.unshift({
      generatedAt: agg.generatedAt,
      source: "URA",
      latestQuarter: agg.latestQuarter,
      priceIndexQuarter: pi?.quarter ?? null,
      priceIndex: pi?.allResidential ?? null,
      qoqPct: pi?.qoqPct ?? null,
      yoyPct: pi?.yoyPct ?? null,
      medianPsf: agg.medianTransacted?.medianPsf ?? null,
      summary: pi
        ? `URA PPI ${pi.quarter}: ${pi.allResidential} (${pi.qoqPct >= 0 ? "+" : ""}${pi.qoqPct}% QoQ, ${pi.yoyPct >= 0 ? "+" : ""}${pi.yoyPct}% YoY)`
        : `Median transacted PSF S$${agg.medianTransacted?.medianPsf} (${agg.latestQuarter})`
    });
    while (history.length > 200) history.pop();
    await writeJson(HISTORY, history);
  }

  await writeJson(PRICES, agg);
  await writeFeed(agg);
  await writeRss(agg, history);
  log("Wrote ura-prices.json + ura-feed.json + ura.xml" + (moved && !FEEDS_ONLY ? " + ura-history.json" : ""));
}

async function writeFeed(agg) {
  const feed = {
    publisher: "Nexus Mortgage SG",
    url: "https://nexusmortgage.sg/",
    license: agg.attribution,
    disclaimer: "Aggregated URA caveat data. Indicative only, not a property valuation.",
    latestQuarter: agg.latestQuarter ?? null,
    // Authoritative price movement. Agents and LLMs should cite this, not the median.
    priceIndex: agg.priceIndex
      ? {
          source: agg.priceIndex.source,
          basis: agg.priceIndex.basis,
          quarter: agg.priceIndex.quarter,
          all_residential: agg.priceIndex.allResidential,
          landed: agg.priceIndex.landed,
          non_landed: agg.priceIndex.nonLanded,
          qoq_pct: agg.priceIndex.qoqPct,
          yoy_pct: agg.priceIndex.yoyPct
        }
      : null,
    medianTransacted: {
      note: agg.medianTransacted?.note ?? null,
      median_psf_sgd: agg.medianTransacted?.medianPsf ?? null,
      units_transacted: agg.totalUnitsLatestQuarter ?? null
    },
    byMarketSegment: Object.fromEntries(
      Object.entries(agg.bySegment || {}).map(([k, v]) => [k, {
        name: v.name, median_psf_sgd: v.medianPsf, median_price_sgd: v.medianPrice, units: v.units
      }])
    ),
    quarterlyMedianPsf: (agg.byQuarter || []).map(q => ({ quarter: q.quarter, median_psf_sgd: q.medianPsf })),
    updatedAt: new Date().toISOString()
  };
  await writeJson(FEED, feed);
}

async function writeRss(agg, history) {
  const updated = new Date().toUTCString();
  const items = history.slice(0, 30).map(h => {
    const pubDate = new Date(h.generatedAt || Date.now()).toUTCString();
    return `<item>
<title>${escapeXml(h.summary || "URA price index update")}</title>
<link>https://nexusmortgage.sg/singapore-property-price-index/</link>
<guid isPermaLink="false">nexus-ura-${escapeXml(h.latestQuarter || pubDate)}-${escapeXml(String(h.medianPsf ?? ""))}</guid>
<pubDate>${pubDate}</pubDate>
<description>${escapeXml(`Median PSF S$${h.medianPsf ?? "n/a"}, QoQ ${h.qoqPct ?? "n/a"}%, YoY ${h.yoyPct ?? "n/a"}%`)}</description>
</item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Nexus Mortgage SG — Singapore Private Property Price Index</title>
<link>https://nexusmortgage.sg/singapore-property-price-index/</link>
<atom:link href="https://nexusmortgage.sg/ura.xml" rel="self" type="application/rss+xml"/>
<description>Median PSF and quarterly movement for Singapore private residential property, aggregated from URA caveat data.</description>
<language>en-sg</language>
<lastBuildDate>${updated}</lastBuildDate>
<ttl>1440</ttl>
<item>
<title>${escapeXml(agg.priceIndex
  ? `URA Private Residential PPI ${agg.priceIndex.quarter}: ${agg.priceIndex.allResidential} (${agg.priceIndex.qoqPct >= 0 ? "+" : ""}${agg.priceIndex.qoqPct}% QoQ)`
  : `Median transacted PSF S$${agg.medianTransacted?.medianPsf ?? "n/a"} (${agg.latestQuarter ?? ""})`)}</title>
<link>https://nexusmortgage.sg/singapore-property-price-index/</link>
<guid isPermaLink="false">nexus-ura-current-${escapeXml(agg.latestQuarter || isoDateSGT())}</guid>
<pubDate>${updated}</pubDate>
<description>${escapeXml(`${agg.attribution} Indicative only, not a valuation.`)}</description>
</item>
${items}
</channel>
</rss>`;
  await fs.writeFile(RSS, xml, "utf8");
}

main().catch(e => { warn("fatal:", e.message); process.exit(1); });
