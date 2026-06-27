#!/usr/bin/env node
/**
 * defer-analytics.mjs — one-shot rewrite to lazy-load Google Analytics 4 +
 * Meta (Facebook) Pixel.
 *
 * Why
 * ---
 * The current template loads gtag.js and fbevents.js synchronously at the top
 * of every <head>. Combined they ship ~137 KB of JS that executes before LCP
 * on mobile, dragging perf scores into the 60s and pushing LCP past 5s on
 * conversion-critical landing pages (free-report, affordability, equity-loan
 * etc.). Microsoft Clarity is already lazy-loaded; this script applies the
 * same pattern to GA4 + Pixel so all three behave the same way.
 *
 * What changes
 * ------------
 *   - The Meta Pixel block (`<!-- Meta Pixel Code -->` … `<!-- End Meta Pixel
 *     Code -->`) and the Google gtag block (`<!-- Google tag (gtag.js) -->` …
 *     the closing `</script>` after `gtag('config', '…')`) are both removed.
 *   - Replaced with a single `<!-- Analytics — lazy-loaded -->` block that:
 *       * installs the dataLayer + gtag() stub and the fbq() stub synchronously
 *         (so any later gtag('event', …) or fbq('track', …) call queues
 *         correctly even before the real scripts arrive),
 *       * fires `gtag('config', GA_ID)` and `fbq('init', PIXEL_ID)` +
 *         `fbq('track','PageView')` into the queue,
 *       * loads the real `gtag.js` and `fbevents.js` only after the first user
 *         interaction (scroll, pointerdown, keydown, touchstart) OR after the
 *         page becomes idle (requestIdleCallback) with a 5s timeout — same
 *         pattern Microsoft Clarity already uses on this site.
 *   - Pages that only have a gtag block (no Pixel) get a gtag-only lazy block.
 *
 * What is preserved
 * -----------------
 *   - The Microsoft Clarity script (already lazy).
 *   - The custom GA4 click-tracking listener at the top of <head> — it fires
 *     on user click, never on page load, so it doesn't hurt LCP and we keep
 *     it inline.
 *   - The Meta Pixel `<noscript>` fallback image (still useful for users with
 *     JS disabled — no perf cost).
 *
 * What gets lost (acceptable)
 * ---------------------------
 *   - PageView events from users who bounce before 3s on a cold page load.
 *     These are sub-2-second drops and not a meaningful retargeting cohort
 *     for a mortgage broker (real intent dwells much longer). Conversion
 *     events (form submit, WhatsApp click, phone click) all fire on user
 *     action, so the script will have loaded by the time they hit.
 *
 * Run
 * ---
 *   node scripts/defer-analytics.mjs
 *   DRY_RUN=1 node scripts/defer-analytics.mjs   # report only, no writes
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

const SENTINEL = "<!-- Analytics — lazy-loaded -->";

// Block matchers — anchored on the comment lines our existing template uses.
// Both are slurp-mode (multi-line) regexes. We deliberately tolerate the
// `noscript` fallback img between/after the Pixel <script> block; the
// matcher's `.*?` is non-greedy so it stops at the End Meta Pixel comment.
const PIXEL_BLOCK_RE = /\s*<!--\s*Meta Pixel Code\s*-->[\s\S]*?<!--\s*End Meta Pixel Code\s*-->\n?/i;
const GTAG_BLOCK_RE = /\s*<!--\s*Google tag \(gtag\.js\)\s*-->\s*<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-7VKFWNBRM6"><\/script>\s*<script>\s*window\.dataLayer[\s\S]*?gtag\('config', 'G-7VKFWNBRM6'\);\s*<\/script>\n?/i;

const COMBINED_BLOCK = `
  <!-- Analytics — lazy-loaded (GA4 + Meta Pixel). Stubs install
       synchronously so gtag('event',…) and fbq('track',…) calls always
       queue correctly; the real scripts load only after first user
       interaction or after the page becomes idle. Mirrors the Microsoft
       Clarity pattern below so all three vendors behave identically. -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-7VKFWNBRM6');

    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window,document);
    fbq('init', '27348447628084102');
    fbq('track', 'PageView');

    (function(){
      var loaded = false;
      function inject(src){var s=document.createElement('script');s.async=true;s.src=src;document.head.appendChild(s);}
      function load(){
        if (loaded) return; loaded = true;
        inject('https://www.googletagmanager.com/gtag/js?id=G-7VKFWNBRM6');
        inject('https://connect.facebook.net/en_US/fbevents.js');
      }
      var events = ['scroll','pointerdown','keydown','touchstart'];
      function fire(){events.forEach(function(e){window.removeEventListener(e, fire);}); load();}
      events.forEach(function(e){window.addEventListener(e, fire, {passive:true});});
      if ('requestIdleCallback' in window) requestIdleCallback(load, {timeout:5000});
      else setTimeout(load, 3000);
    })();
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=27348447628084102&ev=PageView&noscript=1" /></noscript>
`;

const GTAG_ONLY_BLOCK = `
  <!-- Analytics — GA4 lazy-loaded. Stub installs synchronously so
       gtag('event',…) calls always queue correctly; gtag.js itself loads
       only after first user interaction or once the page becomes idle. -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-7VKFWNBRM6');

    (function(){
      var loaded = false;
      function load(){
        if (loaded) return; loaded = true;
        var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-7VKFWNBRM6';document.head.appendChild(s);
      }
      var events = ['scroll','pointerdown','keydown','touchstart'];
      function fire(){events.forEach(function(e){window.removeEventListener(e, fire);}); load();}
      events.forEach(function(e){window.addEventListener(e, fire, {passive:true});});
      if ('requestIdleCallback' in window) requestIdleCallback(load, {timeout:5000});
      else setTimeout(load, 3000);
    })();
  </script>
`;

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

async function processFile(abs) {
  const rel = path.relative(ROOT, abs);
  const html = await fs.readFile(abs, "utf8");

  if (html.includes(SENTINEL)) return { rel, status: "already" };

  const hasPixel = PIXEL_BLOCK_RE.test(html);
  const hasGtag = GTAG_BLOCK_RE.test(html);

  if (!hasGtag && !hasPixel) return { rel, status: "no-analytics" };

  let next = html;

  if (hasPixel && hasGtag) {
    // Drop Pixel, then replace gtag block with the combined block.
    next = next.replace(PIXEL_BLOCK_RE, "");
    next = next.replace(GTAG_BLOCK_RE, COMBINED_BLOCK);
  } else if (hasGtag) {
    next = next.replace(GTAG_BLOCK_RE, GTAG_ONLY_BLOCK);
  } else {
    // Pixel without gtag — rare. Just drop Pixel and add a Pixel-only
    // wrapper. Not implemented because the site does not have this shape.
    return { rel, status: "pixel-only-unhandled" };
  }

  if (next === html) return { rel, status: "no-change" };

  if (DRY) return { rel, status: "would-update", pixel: hasPixel, gtag: hasGtag };
  await fs.writeFile(abs, next);
  return { rel, status: "updated", pixel: hasPixel, gtag: hasGtag };
}

async function main() {
  const files = await walk(ROOT);
  const results = await Promise.all(files.map(processFile));
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  for (const r of results.filter((x) => ["updated", "would-update"].includes(x.status))) {
    console.log(`[defer] ${r.status === "updated" ? "+" : "?"} ${r.rel}  (pixel:${r.pixel?"y":"n"} gtag:${r.gtag?"y":"n"})`);
  }
  for (const r of results.filter((x) => x.status === "pixel-only-unhandled")) {
    console.log(`[defer] ! ${r.rel} — Pixel without gtag, skipped`);
  }
  console.log("[defer] summary", counts);
}

main().catch((e) => {
  console.error("[defer] FAIL", e);
  process.exit(1);
});
