# nexusmortgage.sg — Full SEO Audit

**Audited:** 2026-05-09
**Live URL:** https://nexusmortgage.sg/
**Business type:** Singapore mortgage broker (FinancialService + LocalBusiness hybrid)
**Pages crawled:** 23 (10 directory pages + 13 blog posts)
**Method:** 8 parallel subagent specialists + sitemap audit (sitemap = 9/10)

---

## Executive Summary

### SEO Health Score: **74 / 100**

Solid foundation. No penalty risks. Site is fully static (excellent for crawlers), HTTPS enforced, canonicals clean, sitemap accurate, AI bots explicitly allowed, llms.txt populated, 13 substantial blog posts (avg ~1,800 words). Author authority + freshness signals present.

**Where it bleeds:** missing security headers, render-blocking CSS bloat, structured-data type errors on key entities (Article image, Dan Ler Person schema absent), and zero IndexNow integration despite daily-rate freshness.

| Category | Weight | Score | Contribution |
|---|---|---|---|
| Technical SEO | 22% | 71 | 15.6 |
| Content Quality | 23% | 78 | 17.9 |
| On-Page SEO | 20% | 80 | 16.0 |
| Schema | 10% | 70 | 7.0 |
| Performance (CWV) | 10% | 55 | 5.5 |
| AI Search | 10% | 82 | 8.2 |
| Images | 5% | 75 | 3.75 |
| **Total** | **100%** | | **74 / 100** |

### Top 5 Critical

1. **Security headers absent** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP. None set. MAS-regulated YMYL site without HSTS.
2. **Article `image` is bare string** on all 13 blog posts — fails Google's Rich Result requirement (needs `ImageObject` with width/height).
3. **HowTo schema dead-weight** on `blog-first-time-hdb-buyer-guide.html` — Google killed HowTo rich results Sept 2023.
4. **Person schema for Dan Ler missing** site-wide — author named on every Article but no Person entity, no E-E-A-T Knowledge Graph anchor.
5. **TTFB 499ms on homepage** (POOR threshold = >200ms) — driven by 231 KB inline-CSS-heavy HTML payload.

### Top 5 Quick Wins

1. **Bump 2 sitemap lastmods** ✅ already done (`/blog/` + `/mortgage-rates/` → 2026-05-09).
2. **Deduplicate `styles.min.css`** — currently loaded 3× on `/mortgage-rates/`, 2× on `/free-report/`, 3× on `/affordability/`. Free LCP win.
3. **Add `defer`** to Chart.js + datalabels on `/free-report/`.
4. **Add `width`/`height`** to `ec-mop-2026-hero.webp` (CLS fix).
5. **Set Cloudflare Transform Rule** for 4 security headers (HSTS, X-CTO, X-Frame, Referrer-Policy) — 1 hour, zero code.

---

## 1. Technical SEO — 71 / 100

### Critical
- **Zero security headers** sent by GitHub Pages/Cloudflare. Verified via `curl -I`. Add via Cloudflare Transform Rules:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  ```

### High
- **`.html` extension URLs** create soft-duplicates. GitHub Pages serves `/blog/blog-foo` (no ext) AND `/blog/blog-foo.html` both as 200. Canonical correctly points to `.html` so consolidation happens, but PageRank leaks.
- **Redundant `blog-` prefix** in every slug (`/blog/blog-hdb-vs-bank-loan.html` → `/blog/hdb-vs-bank-loan/`).
- **No LCP optimization signals** on homepage — no `<link rel=preload as=image>`, no `fetchpriority="high"`.

### Medium
- **IndexNow protocol absent** — no key file at root. With daily SORA refresh, IndexNow ping → instant Bing/Yandex notification.
- **robots.txt has conflicting AI directives** — Cloudflare-managed `Disallow: /` blocks for ClaudeBot/GPTBot followed by custom `Allow: /` for same agents. Last-rule-wins behaviour ambiguous. Remove the Cloudflare-managed block.
- **`Disallow: /*?*`** is too broad — narrow to `/*?s=*` if site search is the target.

### Pass
HTTPS enforced, HTTP/2, canonicals self-referencing, viewport meta correct, sitemap valid, no noindex, www→apex 301 works, fully static SSR.

---

## 2. Content Quality — 78 / 100

13 blog posts averaging ~1,800 words. Strong topical depth on Singapore mortgages (TDSR/MSR/SORA/CPF/HDB/EC/decoupling). Author "Dan Ler" credited everywhere with "Mortgage Advisor at Nexus Mortgage SG" bio block at end of each post. External authority links to MAS, IRAS, CPF, HDB, URA. **YMYL (financial)** trustworthiness bar partially met.

### Gaps
- **No Person entity for Dan Ler** — credentials text-only, no Knowledge Graph anchor.
- **MAS license/registration number not visible** anywhere on site. For mortgage advisory in SG, should display credentials prominently (footer + about page).
- **No Reviews / Testimonials** anywhere. AggregateRating absent from schema.
- **Topic overlap risk** — multiple HDB-loan posts (`blog-hdb-vs-bank-loan`, `blog-first-time-hdb-buyer-guide`, `blog-hdb-resale-q1-2026-mortgage`, `blog-cpf-oa-hdb-guide`). Internal-link audit recommended to ensure they cluster well, not cannibalize.

---

## 3. On-Page SEO — 80 / 100

- Titles: descriptive, keyword-rich, under 60 chars on most posts ✅
- Meta descriptions: present on all sampled pages ✅
- H1 single per page ✅
- Internal linking: dense within blog cluster ✅
- Canonical = sitemap loc on every page ✅

### Issues
- Blog slugs carry redundant `blog-` prefix (5 chars × 13 posts wasted)
- Hero images often lack explicit `width`/`height` attributes → CLS risk
- No breadcrumb visible UI on directory pages (schema present but no rendered crumbs)

---

## 4. Schema & Structured Data — 70 / 100

### Critical
- **Article `image` as bare string URL on all 13 posts** — must be `ImageObject` with `url`, `width`, `height` for rich-result eligibility:
  ```json
  "image": {
    "@type": "ImageObject",
    "url": "https://nexusmortgage.sg/blog/blog-images/[hero].png",
    "width": 1344,
    "height": 768
  }
  ```
- **HowTo on `blog-first-time-hdb-buyer-guide.html`** — Google killed Sept 2023. Remove.

### High
- **No standalone Person entity** for Dan Ler. Add to `/about/`, reference via `@id` from every Article author node.
- **WebSite block has no `potentialAction`** — add SearchAction for Sitelinks Searchbox eligibility.
- **`MortgageBroker` entity has no `@id`** — prevents cross-page node referencing.
- **`blog-hdb-vs-bank-loan.html`** missing FAQPage + BreadcrumbList (only Article block) — inconsistent with the other 12 posts.

### Medium
- **AggregateRating absent** site-wide. If reviews exist (Google, Trustpilot), surface them in schema.
- 11 of 13 Articles missing `keywords` field.

### Info
- FAQPage rich results suppressed by Google for commercial sites since Aug 2023. Keep blocks anyway — high value for AI/LLM citation surfaces (Perplexity, ChatGPT search, AI Overviews).

---

## 5. Performance (CWV) — 55 / 100

### TTFB (curl, SG → MacOS)

| Page | HTML | TTFB | Verdict |
|---|---|---|---|
| `/` | 231 KB | 499 ms | POOR |
| `/mortgage-rates/` | 85 KB | 297 ms | NEEDS IMP |
| `/free-report/` | 320 KB | 284 ms | NEEDS IMP |
| `/blog/` | 58 KB | 43 ms | GOOD |
| `/blog/blog-ec-mop-2026-changes.html` | 38 KB | 377 ms | POOR |
| `/affordability/` | 65 KB | 306 ms | NEEDS IMP |

### Critical
- **Inline `<style>` bloat** — homepage has 55 KB of inline CSS in 3 blocks (904 declarations). `/free-report/` has 47 KB. Every visitor parses this on every page. External versioned CSS = cache hit on repeat.
- **`styles.min.css` loaded 2-3 times** on `/mortgage-rates/`, `/free-report/`, `/affordability/`. Each duplicate = blocking round-trip.

### High
- **Google Fonts blocking** — no `<link rel=preload as=font crossorigin>` for Cormorant Garamond + DM Sans woff2 subsets. Self-host + preload would shave 300-600 ms off LCP.
- **Chart.js on `/free-report/`** loaded synchronously without `defer` on a 320 KB page. Add `defer`.
- **No `<link rel=preload as=image>` anywhere.**

### Medium
- **Blog hero `ec-mop-2026-hero.webp` no `width`/`height`** → CLS layout-shift vector.
- **Homepage HTML 231 KB** — investigate whether mortgage-rates table is rendered inline; defer below-fold rows.

---

## 6. AI Search Readiness (GEO) — 82 / 100

### Strong
- `llms.txt` populated and accurate at root. Lists `/sora-feed.json`, `/rates.json`, `/rates-history.json`, all blog articles, services, NAP.
- robots.txt explicitly allows GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, meta-externalagent, Bytespider, Amazonbot.
- Machine-readable rate feeds (`/sora-feed.json`) — rare and high-value for LLM retrieval.
- 12 of 13 blog posts carry FAQPage schema with passage-style Q&A blocks.
- Authoritative external citations (MAS, IRAS, CPF, HDB, URA) present in every blog post.

### Gaps
- **No Person entity for Dan Ler** → no author Knowledge Graph anchor for AI citations to attribute.
- **MAS regulatory number absent** → trust signal AI engines look for on YMYL.
- **No `sameAs` array** on Organization linking LinkedIn, Facebook, Google Business Profile (if any). AI engines use `sameAs` to triangulate identity.

---

## 7. Local SEO — Hybrid (FinancialService + brick-and-mortar at 39A Jalan Pemimpin)

### Critical
- **NAP unit-number drift** — homepage and `/about/` schema `streetAddress` missing the `#06-02B` unit; `/contact/` page has it correctly. Inconsistent NAP hurts local pack signals.
- **`sameAs` uses Google Maps shortlink** instead of canonical GBP CID URL. Replace with `https://www.google.com/maps?cid=<CID>` form for cleaner entity binding.
- **No Maps embed iframe on `/contact/`** — high-value local signal absent.

### High
- **Mandarin language declared in body text but not in schema or `inLanguage`** on Organization. Add `availableLanguage: ["en", "zh"]`.
- **No dedicated service pages** — `/services/` lists everything in one page. Spin out 4 separate URLs:
  - `/services/hdb-home-loan/`
  - `/services/private-property-loan/`
  - `/services/refinancing/`
  - `/services/commercial-property-loan/`
  Each with its own LocalBusiness/Service schema, enabling distinct ranking + map-pack opportunities.

---

## 8. Backlinks (limited — no Moz/Bing creds)

Common Crawl + visible-web inspection:
- Domain is recent (post-launch), low referring-domain count expected.
- Internal backlinks to `/free-report/` confirmed dense — every blog post has 2-3 references (CTA box + action list + nav). Lead-magnet has good internal-link equity.
- Competitor scan (PropertyGuru Finance, MortgageMaster, RedBrick, Loan Finder, MoneySmart) — gap is large; opportunity for guest posts on Singapore property blogs (Stacked Homes, 99.co, EdgeProp).

### Recommended
- Submit to MAS-regulated finance directory listings.
- Earn citations from PropNex/OrangeTee/ERA research desk by referencing their data (already done in EC post — request reciprocal mention).
- Targeted outreach to Singapore personal-finance blogs (Seedly, MoneySmart, Dollars & Sense) with rates-data hook (`/sora-feed.json` is genuinely useful to bloggers).

---

## 9. Visual / Mobile

10 screenshots in `seo-audit-screenshots/` (desktop + mobile × 5 pages).

Inspected `home_mobile.png`:
- Above-fold: Nexus logo + "Singapore Mortgage Specialist" badge + H1 hero ("Best Home Loan Rates in Singapore — Compare 16 Banks Free") + body copy + CTA button.
- Live SORA ticker visible at top (1.075% / 0.00 / 1.05% / 0.07).
- Dark navy + gold theme renders cleanly on mobile.
- WhatsApp floating CTA bottom-right — good UX, doesn't obscure copy.
- H1 LCP element confirmed as text node (custom font Cormorant Garamond) — performance agent flagged this as preload candidate.

No critical mobile rendering issues visible from screenshots.

---

## Files

- `VALIDATION-REPORT.md` — sitemap audit (already pushed)
- `FULL-AUDIT-REPORT.md` — this file
- `ACTION-PLAN.md` — priority-ranked roadmap (next file)
- `seo-audit-screenshots/*.png` — 10 visual captures
