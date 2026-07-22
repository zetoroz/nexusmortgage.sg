// Bakes a static article grid into blog/index.html from blog/articles.json.
//
// Why: the grid was 100% client-rendered (fetch + innerHTML), so crawlers and
// AI bots that don't execute JS saw ZERO links to the 38 articles — the whole
// blog corpus was a crawl dead-end reachable only via sitemap.xml. The static
// bake gives every article a real <a href> in the delivered HTML; the existing
// JS fetch still runs on load and re-renders the same markup (harmless).
//
// Run after every articles.json change:  node scripts/build-blog-grid.mjs
// Markup mirrors the client renderer in blog/index.html — keep them in sync.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = join(ROOT, "blog", "index.html");
const JSON_PATH = join(ROOT, "blog", "articles.json");

const articles = JSON.parse(readFileSync(JSON_PATH, "utf8"));
const live = articles.filter((a) => a.status === "live");
const comingSoon = articles.filter((a) => a.status !== "live");
const sorted = live.concat(comingSoon);
const delays = ["delay-1", "delay-2", "delay-3", "delay-4"];

// Baking every article's full excerpt here gave the hub ~10k characters of
// article-specific text, and Google started ranking /blog/ ABOVE the articles
// themselves on 15 queries (e.g. "hdb decoupling": /blog/ pos 44 vs the article
// at 58.8). Keep the links for crawlability, cut the topical overlap.
const TEASER_MAX = 110;
function teaser(text) {
  const s = String(text || "").trim();
  if (s.length <= TEASER_MAX) return s;
  const cut = s.slice(0, TEASER_MAX);
  const at = cut.lastIndexOf(" ");
  return (at > 60 ? cut.slice(0, at) : cut).replace(/[,;:—–-]+$/, "") + "…";
}

const cards = sorted
  .map((a, i) => {
    const delay = delays[i] || "";
    const shimmer = a.status === "live" ? ".6" : ".35";
    const thumb =
      `<div class="card-thumb">` +
      `<img src="${a.thumbnail}" alt="${a.thumbnailAlt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">` +
      `<div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(196,151,59,${shimmer}),transparent);z-index:1;"></div>` +
      `</div>`;
    const dateStr =
      a.status === "live" && a.readTime ? `${a.date} &nbsp;·&nbsp; ${a.readTime}` : a.date;
    const body =
      `<div class="card-body">` +
      `<div class="card-meta"><span class="card-tag">${a.tag}</span><span class="card-date">${dateStr}</span></div>` +
      `<h3 class="card-title">${a.title}</h3>` +
      `<p class="card-excerpt">${teaser(a.excerpt)}</p>` +
      (a.status === "live"
        ? `<span class="card-cta">Read More <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>`
        : `<span class="card-cta disabled">Coming Soon</span>`) +
      `</div>`;
    if (a.status === "live") {
      const href = a.url || `./${a.slug}/`;
      return `<a href="${href}" class="article-card reveal ${delay}">${thumb}${body}</a>`;
    }
    return `<div class="article-card coming-soon reveal ${delay}"><span class="coming-soon-badge">Coming Soon</span>${thumb}${body}</div>`;
  })
  .join("\n");

let html = readFileSync(HTML, "utf8");
// Greedy on purpose: spans from the first opening sentinel to the LAST closing
// one. A clean file has exactly one pair, so this behaves identically — but if a
// previous run leaked stray sentinels into the block (see the $1/$2 bug below),
// greedy swallows the whole damaged region and rebuilds it clean.
const re = /(<!-- STATIC-BLOG-GRID -->)[\s\S]*(<!-- \/STATIC-BLOG-GRID -->)/;
if (!re.test(html)) {
  console.error("[build-blog-grid] STATIC-BLOG-GRID sentinels not found in blog/index.html");
  process.exit(1);
}
const strays = (html.match(/STATIC-BLOG-GRID/g) || []).length;
if (strays !== 2) {
  console.warn(`[build-blog-grid] found ${strays} sentinel markers (expected 2) — repairing damaged block`);
}
// Replacer FUNCTION, not a template string. With a string replacement, JS
// interprets $1/$2/$& inside it as capture-group references — and article
// excerpts are full of "S$1.475M" / "S$2,799", so those dollar-amounts were
// being rewritten into the captured sentinel comments and corrupting the page.
html = html.replace(re, (_m, open, close) => `${open}\n${cards}\n${close}`);
writeFileSync(HTML, html);
console.log(`[build-blog-grid] baked ${sorted.length} cards (${live.length} live) into blog/index.html`);
