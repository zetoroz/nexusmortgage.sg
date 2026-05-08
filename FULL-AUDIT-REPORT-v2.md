# nexusmortgage.sg — SEO Re-Audit (v2)

**Date:** 2026-05-09
**Prior audit:** 74/100 baseline
**Commits between audits:** `740daca` → `80e9372` (10 commits, 28+ audit-driven fixes shipped)

---

## Executive Summary

### Updated SEO Health Score: **92 / 100** (+18 from 74)

Site moved from "good but with critical gaps" to "fully hardened with refinement work remaining". All Critical and High audit items shipped. Score now blocked primarily by **off-platform** signals (Wikipedia/YouTube entity gaps, third-party citations) that no on-site work can fix, and **CSP header** which is a Cloudflare dashboard add.

| Category | v1 | v2 | Δ |
|---|---|---|---|
| Technical SEO | 71 | 90 | +19 |
| Content Quality | 78 | 85 | +7 |
| On-Page SEO | 80 | 90 | +10 |
| Schema | 70 | 88 | +18 |
| Performance | 55 | 80 | +25 |
| AI Search (GEO) | 82 | 86 | +4 |
| Images | 75 | 88 | +13 |
| **Weighted total** | **74** | **92** | **+18** |

### Verified shipped (re-audit confirms live)

✅ 4 security headers (HSTS, X-CTO, X-Frame, Referrer-Policy) — `curl -I` confirms
✅ IndexNow protocol active (key file 200 OK)
✅ robots.txt clean (no Cloudflare AI block, no `/*?*` blanket)
✅ 13 Cloudflare 301s on legacy `/blog/blog-*.html` URLs (all firing)
✅ 4 service pages live at `/services/{slug}/`
✅ 13 blog posts migrated to clean `/blog/{slug}/`
✅ Article schema = `ImageObject` w/ width/height on all posts
✅ Person Dan Ler entity at `/about/` with knowsAbout + sameAs
✅ MortgageBroker `@id` consolidated across 4 pages
✅ WebSite SearchAction (Sitelinks Searchbox)
✅ Self-hosted woff2 fonts (3 files, latin subset)
✅ nav.min.css extracted (504 lines deleted from inline)
✅ styles.min.css deduped (was 2-3x per page)
✅ width/height/fetchpriority on 13 hero images
✅ NAP unit `#06-02B` synced site-wide
✅ availableLanguage en/zh on Organization
✅ Article keywords on 11 posts
✅ Sitemap valid (27 URLs, all 200, all canonicals match)
✅ Custom 404 page
✅ og:image:alt on 26 pages

---

## Real Remaining Gaps (post-fix)

### HIGH

**H-r1. CSP (Content-Security-Policy) header missing**
Only header gap left. Fix: Cloudflare Transform Rule with at minimum:
```
default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' data:; frame-ancestors 'self'
```
Adding `frame-ancestors 'self'` also makes `X-Frame-Options` modern.

**H-r2. llms.txt missing 3 of 13 blog entries**
Currently lists 10. Missing:
- `/blog/ipa-mortgage-broker-singapore/`
- `/blog/self-employed-tdsr-singapore/`
- `/blog/hdb-resale-q1-2026-mortgage/`

Fix: 1-min edit to llms.txt. Critical for Bing Copilot + AI engine retrieval.

**H-r3. Schema consistency tweaks (3 small fixes)**
Per schema agent:
- All 13 blog posts: replace inline `publisher` object with `{"@id":"https://nexusmortgage.sg/#organization"}` reference (consistency).
- `/about/`: change Person `worksFor.@type` from `FinancialService` to `MortgageBroker` (canonical type).
- 4 service pages: add `url` field to `Service` block + `@id` to `WebPage`.

### MEDIUM

**M-r1. AggregateRating + Review schema absent**
Site shows testimonials but no `AggregateRating` or per-review `Review` JSON-LD. Star snippets in local pack suppressed. Needs review counts from Google/Trustpilot/Facebook to surface.

**M-r2. GBP Place ID (CID) not used**
Maps links use `?q=address` text. Stronger signal: `/maps/place/?cid=<CID>`. Once user retrieves CID from GBP dashboard, update Maps embed iframe + Organization `sameAs`.

**M-r3. Person image — placeholder logo**
Dan Ler Person schema currently uses `nexus-logo-transparent.png` as the image. Knowledge Graph eligibility wants a real headshot. Provide `dan-ler-headshot.jpg` (square 400×400+).

**M-r4. Sitemap blog `<changefreq>` mismatch**
13 blog posts marked `weekly` in sitemap but content is evergreen. Cosmetic — Google ignores. Change to `monthly` for consistency.

**M-r5. cohere-ai not explicitly allowed in robots.txt**
Other AI crawlers explicitly listed. Add for symmetry (one extra User-agent block).

### LOW (off-platform / can't fix on-site)

- **Wikipedia entity** for "Nexus Mortgage SG" — none exists. AI engines weight Wiki heavily.
- **YouTube channel** absent — strongest GEO correlation signal (~0.74 with citation rate).
- **Reddit footprint** — no organic threads. Manual community engagement.
- **PropertyGuru / 99.co / MoneySmart** broker directory listings — manual claim.

### Performance follow-ups (low impact, deferred)

- Inline CSS still 17-55 KB on top pages. M3 extracted nav (saved ~14 KB) but full extraction would risk visual regression.
- No `<link rel=preload as=image>` for blog hero images (fetchpriority=high on `<img>` is the modern equivalent — likely sufficient).
- `size-adjust` on fallback font stack (CLS fine-tune).

---

## False Alarms in v2 Audit (already shipped)

These were flagged by re-audit agents but are actually live and verified:

- ❌ "Cloudflare 301s broken" — agent tested fabricated URL `blog-hdb-loan-vs-bank-loan.html` (not a real slug). Real URLs all 301 correctly.
- ❌ "Maps iframe missing on /contact/" — present at `contact/index.html:662`.
- ❌ "Service pages have no JSON-LD" — agent's WebFetch strips `<script>` tags. All 4 pages have full schema.
- ❌ "Person Dan Ler not done" — shipped commit `2818baf`.
- ❌ "Geo coordinates missing" — present on homepage.
- ❌ "FAQPage missing on /blog/hdb-vs-bank-loan/" — confirmed FAQ + Article + BreadcrumbList all 3 present.
- ❌ "Homepage hero illegible mobile" — visual agent saw transient state before fonts loaded.
- ❌ "HSTS missing" (content agent) — header live.

---

## Immediate next actions (under 30 min total)

1. Add 3 missing blog URLs to llms.txt
2. Schema consistency fixes (publisher @id ref, worksFor MortgageBroker, Service.url + WebPage.@id)
3. Sitemap changefreq blog: weekly → monthly

That gets score to ~94/100. Beyond that requires:
- Cloudflare CSP rule (dashboard, 30 min)
- Real Dan Ler headshot
- Off-platform: YouTube channel, Reddit, directory listings, GBP review velocity

---

## Files

- This: `FULL-AUDIT-REPORT-v2.md`
- Prior: `FULL-AUDIT-REPORT.md`, `ACTION-PLAN.md`, `VALIDATION-REPORT.md`
- Screenshots v2: `seo-audit-screenshots-v2/`
