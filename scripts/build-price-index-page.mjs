#!/usr/bin/env node
/**
 * build-price-index-page.mjs — generates /singapore-property-price-index/ from
 * ura-prices.json, cloning the /sora-rates-singapore/ shell for head, nav, fonts,
 * CSS and footer so the two live-data pages stay visually identical.
 *
 * Run:  node scripts/build-price-index-page.mjs
 *
 * Re-run on every URA refresh so the page never drifts from the data. That is why
 * there is no separate snippet-patcher here (unlike update-rate-snippets.mjs): the
 * whole page is regenerated, title and meta included.
 *
 * EDITORIAL RULE (YMYL): the headline movement is ALWAYS the official URA PPI, which
 * is hedonic and mix-adjusted. Median transacted PSF is descriptive colour only and
 * must never be presented as a price movement — for 2026Q2 the two differed by 2.6x
 * on YoY. Every median on this page carries that caveat visibly, not just in JSON.
 *
 * All replacements use function-form callbacks so `$1`/`$&` inside generated copy is
 * never interpreted (see the js-replace-dollar-pattern-bug note in the wiki).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SHELL = path.join(ROOT, "sora-rates-singapore", "index.html");
const DATA = path.join(ROOT, "ura-prices.json");
const OUT_DIR = path.join(ROOT, "singapore-property-price-index");
const OUT = path.join(OUT_DIR, "index.html");
const URL_SELF = "https://nexusmortgage.sg/singapore-property-price-index/";

const log = (...a) => console.log("[build-price-index]", ...a);

const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const sgd = n => n == null ? "n/a" : "S$" + Number(n).toLocaleString("en-SG");
const pct = n => n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n}%`;
const qLabel = q => String(q || "").replace(/^(\d{4})Q(\d)$/, (_, y, n) => `Q${n} ${y}`);

/** Replace exactly once with a function repl, failing loudly if the anchor moved. */
function sub1(re, replacement, s, what) {
  let n = 0;
  const out = s.replace(re, () => { n++; return replacement; });
  if (n !== 1) throw new Error(`FAILED to replace ${what} (matched ${n} times)`);
  return out;
}

const DISTRICT_AREAS = {
  "01": "Raffles Place, Marina, Cecil", "02": "Anson, Tanjong Pagar", "03": "Queenstown, Tiong Bahru",
  "04": "Telok Blangah, Harbourfront", "05": "Buona Vista, Pasir Panjang, Clementi", "06": "City Hall, High Street",
  "07": "Beach Road, Bugis, Rochor", "08": "Little India, Farrer Park", "09": "Orchard, Cairnhill, River Valley",
  "10": "Bukit Timah, Holland, Tanglin", "11": "Newton, Novena, Thomson", "12": "Balestier, Toa Payoh, Serangoon",
  "13": "Macpherson, Braddell, Potong Pasir", "14": "Geylang, Eunos, Paya Lebar", "15": "Katong, Marine Parade, Joo Chiat",
  "16": "Bedok, Upper East Coast, Bayshore", "17": "Changi, Loyang, Flora", "18": "Tampines, Pasir Ris",
  "19": "Hougang, Punggol, Sengkang", "20": "Ang Mo Kio, Bishan, Thomson", "21": "Clementi Park, Upper Bukit Timah",
  "22": "Boon Lay, Jurong, Tuas", "23": "Bukit Batok, Bukit Panjang, Choa Chu Kang", "24": "Lim Chu Kang, Tengah",
  "25": "Kranji, Woodgrove, Woodlands", "26": "Upper Thomson, Springleaf", "27": "Yishun, Sembawang",
  "28": "Seletar, Yio Chu Kang"
};

/** Visible FAQ copy. The schema below is generated FROM this array, so the two can
 *  never drift — the site already has pages carrying FAQ schema with no visible
 *  counterpart, which is the failure mode this guards against. */
function faqs(d) {
  const pi = d.priceIndex;
  const mt = d.medianTransacted;
  return [
    ["What is the current Singapore private property price index?",
     `URA's Private Residential Property Price Index stood at ${pi.allResidential} in ${qLabel(pi.quarter)}, on a base of 100 at Q1 2009. That is ${pct(pi.qoqPct)} quarter-on-quarter and ${pct(pi.yoyPct)} year-on-year. Landed property sits at ${pi.landed} and non-landed at ${pi.nonLanded}.`],
    ["Are Singapore private property prices still rising in 2026?",
     `Yes, but slowly. The index rose ${pct(pi.qoqPct)} in ${qLabel(pi.quarter)} and ${pct(pi.yoyPct)} over the year. That is materially slower than the double-digit growth of 2021 to 2022, and it is well below what raw median transacted prices appear to show, because medians are distorted by which projects happen to launch in a given quarter.`],
    ["What is the median price per square foot for a Singapore condo?",
     `Across all private residential caveats lodged in ${qLabel(d.latestQuarter)}, the median was ${sgd(mt.medianPsf)} per square foot on ${Number(d.totalUnitsLatestQuarter).toLocaleString("en-SG")} units. This is a descriptive median, not a price index: it moves with the mix of projects transacting, so it should not be read as the rate at which prices are changing.`],
    ["Why does the price index differ from median PSF figures?",
     "The URA index is built with stratified hedonic regression, which controls for property attributes so it isolates genuine price change. A median simply takes the middle transaction, so a quarter dominated by high-priced new launches lifts the median even when underlying prices are flat. In Q2 2026 the official index rose 2.91% year-on-year while the raw median PSF appeared to rise 7.56%, a 2.6x overstatement."],
    ["What is the difference between CCR, RCR and OCR?",
     "CCR is the Core Central Region, covering districts 9, 10 and 11 plus the Downtown Core and Sentosa. RCR is the Rest of Central Region, the ring immediately outside it. OCR is Outside Central Region, the suburbs. URA assigns each project a segment, and the three behave quite differently: OCR carries the largest transaction volume while CCR is thin enough that a couple of launches can swing its median."],
    ["How does the property price index affect my mortgage?",
     "It affects how much you can borrow rather than what you pay. Banks lend against valuation, so a rising index generally lifts valuations and the loan quantum available, and it increases accessible equity on a property you already own. It does not change your interest rate, which is priced off SORA plus a bank spread, and it does not change TDSR, which is capped at 55% of gross monthly income."],
    ["Where does this data come from?",
     "Two official URA sources. The price index is URA's published Private Residential Property Price Index, retrieved from data.gov.sg under the Singapore Open Data Licence. The medians are computed from private residential caveats in URA's Data Service, refreshed every Tuesday and Friday. Neither figure is a valuation of any individual property."]
  ];
}

function buildBody(d) {
  const pi = d.priceIndex;
  const mt = d.medianTransacted;
  const segs = d.bySegment || {};
  const segOrder = ["CCR", "RCR", "OCR"].filter(k => segs[k]);

  const segRows = segOrder.map(k => {
    const s = segs[k];
    return `<tr><td><strong>${k}</strong><br><span style="font-size:.82rem;color:rgba(232,227,218,.55);">${esc(s.name)}</span></td>`
      + `<td>${sgd(s.medianPsf)}</td><td>${sgd(s.medianPrice)}</td><td>${Number(s.units).toLocaleString("en-SG")}</td></tr>`;
  }).join("\n          ");

  const distRows = (d.byDistrict || []).map(x =>
    `<tr><td><strong>D${esc(x.district)}</strong></td><td>${esc(DISTRICT_AREAS[x.district] || "")}</td>`
    + `<td>${esc(x.segment || "")}</td><td>${sgd(x.medianPsf)}</td><td>${Number(x.units).toLocaleString("en-SG")}</td></tr>`
  ).join("\n          ");

  // Show the index series, not the median series: the medians are too mix-noisy to
  // present as a trend line without inviting exactly the misreading we are guarding against.
  const qRows = (d.byQuarter || []).slice(-8).map(q =>
    `<tr><td>${qLabel(q.quarter)}</td><td>${sgd(q.medianPsf)}</td><td>${Number(q.units).toLocaleString("en-SG")}</td></tr>`
  ).join("\n          ");

  const faqVisible = faqs(d).map(([q, a]) =>
    `<div class="faq-item">\n        <div class="faq-q">${esc(q)}</div>\n        <div class="faq-a">${esc(a)}</div>\n      </div>`
  ).join("\n      ");

  return `
    <a href="/" class="back-link">&#8592; Nexus Mortgage SG</a>

    <p class="meta">Official URA Data &middot; Updated Twice Weekly</p>

    <h1>Singapore Property Price Index</h1>

    <p style="font-size:1.05rem;color:rgba(232,227,218,.78);">The official URA Private Residential Property Price Index, plus median transacted prices per square foot across all 27 active postal districts. Index data from <a href="https://data.gov.sg/datasets/d_97f8a2e995022d311c6c68cfda6d034c/view" target="_blank" rel="noopener">URA via data.gov.sg</a>; medians computed from private residential caveats in the <a href="https://eservice.ura.gov.sg/maps/api/" target="_blank" rel="noopener">URA Data Service</a>.</p>

    <div class="rate-hero">
      <div class="rate-card">
        <div class="label">URA Price Index &mdash; ${qLabel(pi.quarter)}</div>
        <div><span class="value">${pi.allResidential}</span></div>
        <div class="sub">All residential, base Q1 2009 = 100. ${pct(pi.qoqPct)} quarter-on-quarter, ${pct(pi.yoyPct)} year-on-year.</div>
      </div>
      <div class="rate-card">
        <div class="label">Median Transacted PSF</div>
        <div><span class="value">${sgd(mt.medianPsf)}</span><span class="unit">psf</span></div>
        <div class="sub">${qLabel(d.latestQuarter)}, ${Number(d.totalUnitsLatestQuarter).toLocaleString("en-SG")} units. Descriptive median, <strong>not</strong> a price movement.</div>
      </div>
    </div>

    <p class="as-of">Index as of ${qLabel(pi.quarter)} &middot; caveat data as of ${esc(d.asOf)}</p>

    <h2>What the URA Price Index Actually Measures</h2>

    <p>URA compiles the Private Residential Property Price Index using <strong>stratified hedonic regression</strong>. In plain terms, it controls for what is being sold, so that a quarter full of expensive new launches does not masquerade as a price rise. It is the only figure on this page that answers the question "have prices gone up".</p>

    <p>Latest reading by property type:</p>

    <table class="rates-table">
      <thead><tr><th>Property type</th><th>Index (${qLabel(pi.quarter)})</th></tr></thead>
      <tbody>
          <tr><td><strong>All residential</strong></td><td>${pi.allResidential}</td></tr>
          <tr><td>Landed</td><td>${pi.landed}</td></tr>
          <tr><td>Non-landed</td><td>${pi.nonLanded}</td></tr>
      </tbody>
    </table>

    <div class="pullquote">A median tells you what units sold for. An index tells you whether prices moved. They are not interchangeable, and in Q2 2026 they disagreed by a factor of 2.6.</div>

    <h2>Why Median PSF Is Not a Price Index</h2>

    <p>Every median on this page is descriptive. It answers "what did units go for", which is genuinely useful when you are sizing a purchase or estimating equity. It does not answer "how much have prices moved", and reading it that way produces badly wrong conclusions.</p>

    <p>The gap is not small. For ${qLabel(pi.quarter)}:</p>

    <table class="rates-table">
      <thead><tr><th>Measure</th><th>Quarter-on-quarter</th><th>Year-on-year</th></tr></thead>
      <tbody>
          <tr><td><strong>Official URA index</strong> (hedonic)</td><td>${pct(pi.qoqPct)}</td><td>${pct(pi.yoyPct)}</td></tr>
          <tr><td>Raw median PSF (mix-affected)</td><td>${pct(mt.medianPsfQoqPct)}</td><td>${pct(mt.medianPsfYoyPct)}</td></tr>
      </tbody>
    </table>

    <p>The median overstates the year-on-year move because it tracks <em>which projects transacted</em>, not prices. A quarter with a large launch in a prime district lifts the median while underlying prices sit still. Use the index for direction, the medians for magnitude.</p>

    <h2>Median PSF by Market Segment</h2>

    <p>URA assigns every project to one of three segments. CCR covers districts 9, 10 and 11 plus the Downtown Core and Sentosa; RCR is the ring outside it; OCR is the suburbs.</p>

    <table class="rates-table">
      <thead><tr><th>Segment</th><th>Median PSF</th><th>Median price</th><th>Units</th></tr></thead>
      <tbody>
          ${segRows}
      </tbody>
    </table>

    <p>Note how thin CCR volume is relative to OCR. That thinness is exactly why the CCR median swings hard from quarter to quarter and should not be read as a trend on its own.</p>

    <h2>Median PSF by District</h2>

    <p>Trailing four quarters, so that quieter districts still clear a meaningful sample. Districts with fewer than 20 units in the window are omitted rather than shown as a noisy figure.</p>

    <table class="rates-table">
      <thead><tr><th>District</th><th>Areas</th><th>Segment</th><th>Median PSF</th><th>Units</th></tr></thead>
      <tbody>
          ${distRows}
      </tbody>
    </table>

    <h2>Median PSF by Quarter</h2>

    <p>The last eight quarters of median transacted PSF, with volume. Read the volume column alongside the median: a quarter with unusual volume usually explains an unusual median.</p>

    <table class="rates-table">
      <thead><tr><th>Quarter</th><th>Median PSF</th><th>Units transacted</th></tr></thead>
      <tbody>
          ${qRows}
      </tbody>
    </table>

    <h2>What This Means for Your Mortgage</h2>

    <p>The index affects <strong>how much you can borrow</strong>, not what you pay for it.</p>

    <div class="checklist">
      <p><strong>Rising index, buying:</strong> valuations follow the index with a lag. If your purchase price exceeds valuation, the shortfall is cash, because loan-to-value is calculated on the lower of price and valuation. Check the <a href="/affordability/">affordability calculator</a> before committing.</p>
      <p><strong>Rising index, already own:</strong> more accessible equity. An <a href="/equity-loan/">equity term loan</a> is sized off current valuation minus outstanding loan minus CPF used with accrued interest.</p>
      <p><strong>Either way:</strong> your rate is priced off SORA plus a bank spread, not off the index. See <a href="/sora-rates-singapore/">today's SORA rate</a> and <a href="/mortgage-rates/">current mortgage rates</a>.</p>
      <p><strong>Buying a second property:</strong> the index does not change loan-to-value limits. A second property loan is capped at 45% LTV. See <a href="/blog/second-property-loan-ltv-singapore/">second property loan LTV</a>.</p>
    </div>

    <p>Whatever the index does, MAS requires banks to stress-test your loan at a 4% floor rather than the rate you are quoted. See the <a href="/blog/mas-stress-test-2026/">MAS stress test guide</a> for how that caps borrowing capacity.</p>

    <h2>Frequently Asked Questions</h2>

    <div class="faq">
      ${faqVisible}
    </div>

    <div class="cta-block">
      <p><strong>Working out what a rising index means for your borrowing capacity?</strong></p>
      <p>Nexus compares 16 MAS-regulated banks. Banks pay us on disbursement, so the service is free to you.</p>
      <a class="cta-btn" href="https://wa.me/6587520859">WhatsApp Dan Ler &rarr;</a>
    </div>

    <div class="author-bio" style="display:flex;gap:1rem;align-items:center;margin-top:2.5rem;padding:1.25rem 1.4rem;border:1px solid rgba(196,151,59,.2);border-radius:10px;background:rgba(196,151,59,.05);"><img src="/dan-ler.webp" alt="Dan Ler &mdash; Mortgage Advisor, Nexus Mortgage SG" width="64" height="64" loading="lazy" style="width:64px;height:64px;border-radius:50%;flex-shrink:0;border:2px solid rgba(196,151,59,.35);object-fit:cover;"><p style="margin:0;font-size:.95rem;color:rgba(250,247,242,.75);"><strong style="color:#c4973b;">About the author &mdash;</strong> <a href="/about/" style="color:#c4973b;font-weight:600;">Dan Ler</a> has advised on Singapore home loans since 2017 at Nexus Mortgage SG, an independent brokerage comparing 16+ MAS-regulated lenders. Nexus has facilitated 500+ home loans across HDB, EC, private condo and landed property segments. Banks pay Nexus on disbursement, so there is no cost to the borrower.</p></div>

    <hr class="divider">

    <h2>Further reading</h2>
    <p>
      <a href="/sora-rates-singapore/">SORA rate today</a> &middot;
      <a href="/mortgage-rates/">Current mortgage rates</a> &middot;
      <a href="/affordability/">Affordability calculator</a> &middot;
      <a href="/equity-loan/">Equity / cash-out loan</a> &middot;
      <a href="/blog/singapore-mortgage-rate-outlook-2026/">Rate outlook 2026</a> &middot;
      <a href="/blog/second-property-loan-ltv-singapore/">Second property loan LTV</a>
    </p>

    <p style="font-size:.8rem;color:rgba(232,227,218,.45);margin-top:2.5rem;">
      <em>Sources and limitations. The price index is URA's Private Residential Property Price Index, retrieved from data.gov.sg under the Singapore Open Data Licence, base Q1 2009 = 100, compiled by stratified hedonic regression. Median figures are computed by Nexus from private residential caveats in the URA Data Service, refreshed every Tuesday and Friday; caveats lag transactions by roughly two to three weeks, so the most recent quarter is excluded until complete. Cells with fewer than 20 units are suppressed. ${esc(d.attribution)} Medians are aggregate statistics and are <strong>not a valuation</strong> of any individual property; a bank will instruct its own valuer. This page is general information and not financial advice.</em>
    </p>
`;
}

function buildSchema(d) {
  const pi = d.priceIndex;
  const article = {
    "@context": "https://schema.org", "@type": "Article",
    headline: "Singapore Property Price Index: Official URA PPI and Median PSF by District",
    datePublished: "2026-08-12", dateModified: d.asOf,
    inLanguage: "en-SG", articleSection: "Property Market",
    description: `Official URA Private Residential Property Price Index at ${pi.allResidential} for ${qLabel(pi.quarter)}, ${pct(pi.qoqPct)} QoQ and ${pct(pi.yoyPct)} YoY, with median transacted PSF across all Singapore postal districts.`,
    mainEntityOfPage: { "@type": "WebPage", "@id": URL_SELF },
    author: {
      "@id": "https://nexusmortgage.sg/#dan-ler", "@type": "Person", name: "Dan Ler",
      url: "https://nexusmortgage.sg/about/", image: "https://nexusmortgage.sg/dan-ler.webp",
      jobTitle: "Mortgage Advisor",
      worksFor: { "@type": "Organization", name: "Nexus Mortgage", url: "https://nexusmortgage.sg" }
    },
    publisher: { "@id": "https://nexusmortgage.sg/#organization" }
  };

  const dataset = {
    "@context": "https://schema.org", "@type": "Dataset",
    name: "Singapore Private Residential Property Price Index and Median PSF",
    description: "Official URA Private Residential Property Price Index (base Q1 2009 = 100, stratified hedonic regression) together with median transacted price per square foot by postal district and market segment, derived from URA private residential caveats.",
    creator: { "@type": "Organization", name: "Urban Redevelopment Authority", url: "https://www.ura.gov.sg" },
    publisher: {
      "@type": "Organization", name: "Nexus Mortgage", url: "https://nexusmortgage.sg/",
      logo: { "@type": "ImageObject", url: "https://nexusmortgage.sg/nexus-logo-transparent.png" }
    },
    license: "https://data.gov.sg/open-data-licence",
    isAccessibleForFree: true,
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://nexusmortgage.sg/ura-feed.json" },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://nexusmortgage.sg/ura-prices.json" },
      { "@type": "DataDownload", encodingFormat: "application/rss+xml", contentUrl: "https://nexusmortgage.sg/ura.xml" }
    ],
    variableMeasured: [
      { "@type": "PropertyValue", name: "URA Private Residential Property Price Index", value: pi.allResidential, description: "All residential, base Q1 2009 = 100" },
      { "@type": "PropertyValue", name: "Median transacted PSF", value: d.medianTransacted.medianPsf, unitText: "SGD per square foot" }
    ],
    keywords: "Singapore property price index, URA PPI, private residential property, median PSF, CCR RCR OCR, property prices Singapore",
    spatialCoverage: { "@type": "Place", name: "Singapore" },
    temporalCoverage: `${(d.byQuarter?.[0]?.quarter || "").replace("Q", "-Q")}/..`
  };

  const faq = {
    "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "en-SG",
    mainEntity: faqs(d).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
  };

  const bc = {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://nexusmortgage.sg/" },
      { "@type": "ListItem", position: 2, name: "Singapore Property Price Index", item: URL_SELF }
    ]
  };

  return [article, dataset, faq, bc]
    .map(o => `<script type="application/ld+json">${JSON.stringify(o, null, 0)}</script>`)
    .join("\n  ");
}

async function main() {
  const d = JSON.parse(await fs.readFile(DATA, "utf8"));
  if (!d.priceIndex) throw new Error("ura-prices.json has no priceIndex — refusing to build a page with no authoritative index");
  let h = await fs.readFile(SHELL, "utf8");
  const pi = d.priceIndex;

  const title = `Singapore Property Price Index ${qLabel(pi.quarter)}: URA PPI ${pi.allResidential} (${pct(pi.qoqPct)} QoQ) | Nexus`;
  const desc = `Official URA private residential property price index at ${pi.allResidential} for ${qLabel(pi.quarter)}, ${pct(pi.qoqPct)} QoQ and ${pct(pi.yoyPct)} YoY. Median transacted PSF ${sgd(d.medianTransacted.medianPsf)} with a full district breakdown.`;

  // Head metadata. The SORA shell wraps title/description in LIVE-SORA sentinels;
  // strip those so update-rate-snippets.mjs never patches this page by mistake.
  h = sub1(/<!-- LIVE-SORA:titletag -->.*?<!-- \/LIVE-SORA:titletag -->/s, `<title>${esc(title)}</title>`, h, "title");
  h = sub1(/<!-- LIVE-SORA:desctag -->.*?<!-- \/LIVE-SORA:desctag -->/s, `<meta name="description" content="${esc(desc)}">`, h, "description");
  h = sub1(/<meta name="keywords" content=".*?">/s,
    '<meta name="keywords" content="singapore property price index, URA property price index, private property price index singapore, property price index 2026, median psf singapore, condo psf by district, CCR RCR OCR, singapore property prices">', h, "keywords");
  h = sub1(/<meta property="og:title" content=".*?">/s,
    `<meta property="og:title" content="${esc(`Singapore Property Price Index — URA PPI ${pi.allResidential} (${qLabel(pi.quarter)})`)}">`, h, "og:title");
  h = sub1(/<meta property="og:description" content=".*?">/s,
    `<meta property="og:description" content="${esc(desc)}">`, h, "og:description");
  h = sub1(/<meta property="og:url" content=".*?">/s, `<meta property="og:url" content="${URL_SELF}">`, h, "og:url");
  h = sub1(/<link rel="canonical" href=".*?">/s, `<link rel="canonical" href="${URL_SELF}">`, h, "canonical");
  h = h.replace(/<link rel="alternate" hreflang="(en-sg|x-default)" href=".*?">/g,
    m => m.replace(/href=".*?"/, () => `href="${URL_SELF}"`));

  // Replace the four JSON-LD blocks wholesale.
  const firstLd = h.indexOf('<script type="application/ld+json">');
  const lastLdEnd = h.lastIndexOf("</script>", h.indexOf("<!-- Self-hosted fonts"));
  if (firstLd < 0 || lastLdEnd < 0) throw new Error("could not locate JSON-LD block range in shell");
  h = h.slice(0, firstLd) + buildSchema(d) + h.slice(lastLdEnd + "</script>".length);

  // Swap the article body.
  const openTag = '<div class="blog-wrap">';
  const start = h.indexOf(openTag);
  const end = h.indexOf("\n  </div>", start);
  if (start < 0 || end < 0) throw new Error("could not locate blog-wrap body range in shell");
  h = h.slice(0, start + openTag.length) + buildBody(d) + h.slice(end);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT, h, "utf8");
  log(`wrote ${path.relative(ROOT, OUT)} (${h.length} bytes) — index ${pi.allResidential} ${qLabel(pi.quarter)}`);
}

main().catch(e => { console.error("[build-price-index] fatal:", e.message); process.exit(1); });
