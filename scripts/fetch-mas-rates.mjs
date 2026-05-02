#!/usr/bin/env node
/**
 * fetch-mas-rates.mjs — daily SORA refresh from MAS API.
 *
 * Run:  node scripts/fetch-mas-rates.mjs
 * Env:
 *   MAS_API_URL   override base endpoint (default: documented MAS API)
 *   DRY_RUN=1     parse + log, do not write
 *
 * Effect:
 *   - Updates rates.json -> refRates.sora1m / sora3m / sora6m / asOfSora
 *   - Appends entry to rates-history.json
 *   - Regenerates rates.xml (RSS) + sora-feed.json (llms.txt feed)
 *   - Exit 0 on success or graceful skip; exit 1 only on hard parse error.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RATES = path.join(ROOT, "rates.json");
const HISTORY = path.join(ROOT, "rates-history.json");
const RSS = path.join(ROOT, "rates.xml");
const FEED = path.join(ROOT, "sora-feed.json");

const MAS_API_URL =
  process.env.MAS_API_URL ||
  "https://eservices.mas.gov.sg/api/action/datastore/search.json?resource_id=9a0bf149-308c-4bb2-832c-c0c8d28ba4f9&limit=1&sort=end_of_day%20desc";

const DRY = process.env.DRY_RUN === "1";
const FEEDS_ONLY = process.argv.includes("--feeds-only") || process.env.FEEDS_ONLY === "1";

function log(...a) { console.log("[fetch-mas]", ...a); }
function warn(...a) { console.warn("[fetch-mas]", ...a); }

function isoDateSGT(d = new Date()) {
  const sgt = new Date(d.getTime() + 8 * 3600 * 1000);
  return sgt.toISOString().slice(0, 10);
}
function humanDate(d = new Date()) {
  return d.toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit", month: "long", year: "numeric"
  });
}

async function readJson(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); }
  catch { return fallback; }
}

async function writeJson(p, obj) {
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function fetchMasSora() {
  const r = await fetch(MAS_API_URL, {
    headers: { Accept: "application/json", "User-Agent": "nexusmortgage-rates-bot/1.0" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!r.ok) throw new Error(`MAS HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error(`MAS non-JSON response (${ct})`);
  const data = await r.json();
  const rec = data?.result?.records?.[0];
  if (!rec) throw new Error("MAS empty record set");

  const pick = (...keys) => {
    for (const k of keys) {
      const v = rec[k];
      if (v != null && v !== "" && !Number.isNaN(parseFloat(v))) return parseFloat(v);
    }
    return null;
  };

  return {
    asOf: rec.end_of_day || rec.eod || isoDateSGT(),
    sora1m: pick("compounded_sora_1m", "sora_1m", "comp_sora_1m"),
    sora3m: pick("compounded_sora_3m", "sora_3m", "comp_sora_3m"),
    sora6m: pick("compounded_sora_6m", "sora_6m", "comp_sora_6m"),
    soraOn: pick("sora", "sora_on")
  };
}

function delta(curr, prev) {
  if (curr == null || prev == null) return null;
  return Math.round((curr - prev) * 1000) / 1000;
}

async function main() {
  const rates = await readJson(RATES, { refRates: {} });
  const history = await readJson(HISTORY, []);

  let masOk = false;
  let live = null;
  if (FEEDS_ONLY) {
    log("--feeds-only: skipping MAS fetch, regenerating feeds from current rates.json");
  } else {
    try {
      live = await fetchMasSora();
      masOk = true;
      log("MAS feed", live);
    } catch (e) {
      warn("MAS fetch failed:", e.message);
      warn("Keeping existing rates.json refRates; regenerating feeds anyway.");
    }
  }

  if (masOk && live) {
    const prev = rates.refRates || {};
    const next = {
      ...prev,
      sora1m: live.sora1m ?? prev.sora1m,
      sora3m: live.sora3m ?? prev.sora3m,
      sora6m: live.sora6m ?? prev.sora6m
    };

    const changes = {};
    for (const k of ["sora1m", "sora3m", "sora6m"]) {
      const d = delta(next[k], prev[k]);
      if (d != null && d !== 0) changes[k] = { from: prev[k], to: next[k], delta: d };
    }

    rates.refRates = next;
    rates.refRates.asOfSora = live.asOf;
    rates.asOfSora = live.asOf;

    const entry = {
      generatedAt: new Date().toISOString(),
      source: "MAS",
      asOfSora: live.asOf,
      refRateChanges: changes,
      summary: Object.keys(changes).length
        ? `SORA update: ${Object.entries(changes).map(([k,v]) => `${k} ${v.from}→${v.to}`).join(", ")}`
        : "SORA refresh — no change."
    };
    history.unshift(entry);
    while (history.length > 200) history.pop();
  }

  if (DRY) { log("DRY_RUN=1, not writing"); return; }

  if (masOk) {
    await writeJson(RATES, rates);
    await writeJson(HISTORY, history);
  }
  await writeRss(rates, history);
  await writeFeed(rates);
  log(masOk
    ? "Wrote rates.json + rates-history.json + rates.xml + sora-feed.json"
    : "Wrote rates.xml + sora-feed.json (MAS skipped)");
}

async function writeRss(rates, history) {
  const r = rates.refRates || {};
  const updated = new Date().toUTCString();
  const items = history.slice(0, 30).map(h => {
    const ch = h.refRateChanges || {};
    const desc = h.summary || "Rates update";
    const pubDate = new Date(h.generatedAt || Date.now()).toUTCString();
    return `<item>
<title>${escapeXml(desc)}</title>
<link>https://nexusmortgage.sg/mortgage-rates/</link>
<guid isPermaLink="false">nexus-rates-${pubDate}</guid>
<pubDate>${pubDate}</pubDate>
<description>${escapeXml(JSON.stringify(ch))}</description>
</item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Nexus Mortgage SG — Live SORA Rates</title>
<link>https://nexusmortgage.sg/mortgage-rates/</link>
<atom:link href="https://nexusmortgage.sg/rates.xml" rel="self" type="application/rss+xml"/>
<description>Daily Singapore SORA (1M, 3M, 6M Compounded) and bank mortgage rate snapshots. Source: MAS.</description>
<language>en-sg</language>
<lastBuildDate>${updated}</lastBuildDate>
<ttl>720</ttl>
<item>
<title>Current Compounded SORA — 1M ${fmt(r.sora1m)} | 3M ${fmt(r.sora3m)} | 6M ${fmt(r.sora6m)}</title>
<link>https://nexusmortgage.sg/mortgage-rates/</link>
<guid isPermaLink="false">nexus-current-${rates.asOfSora || isoDateSGT()}</guid>
<pubDate>${updated}</pubDate>
<description>Latest published Compounded SORA values per MAS. As of ${escapeXml(rates.asOfSora || "")}.</description>
</item>
${items}
</channel>
</rss>`;
  await fs.writeFile(RSS, xml, "utf8");
}

async function writeFeed(rates) {
  const r = rates.refRates || {};
  const feed = {
    publisher: "Nexus Mortgage SG",
    url: "https://nexusmortgage.sg/",
    license: "Reference data sourced from Monetary Authority of Singapore (MAS).",
    asOfSora: rates.asOfSora || null,
    sora: {
      compounded_1m_pct: r.sora1m ?? null,
      compounded_3m_pct: r.sora3m ?? null,
      compounded_6m_pct: r.sora6m ?? null
    },
    typicalSpreadPct: 0.8,
    masStressTestFloorPct: 4.0,
    hdbConcessionaryPct: 2.6,
    derived: {
      effectiveSora3mPlusSpreadPct: r.sora3m != null ? round(r.sora3m + 0.8, 3) : null
    },
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(FEED, JSON.stringify(feed, null, 2) + "\n", "utf8");
}

function fmt(v) { return v == null ? "n/a" : `${v.toFixed(2)}%`; }
function round(n, p) { const m = 10 ** p; return Math.round(n * m) / m; }
function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]));
}

main().catch(e => { console.error("[fetch-mas] FATAL", e); process.exit(1); });
