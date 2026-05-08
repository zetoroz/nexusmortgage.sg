# nexusmortgage.sg — Action Plan

**Date:** 2026-05-09
**Source:** FULL-AUDIT-REPORT.md
**Score now:** 74 / 100 → **target 90+** after Critical+High items shipped

---

## CRITICAL (fix this week)

### C1. Add 4 security headers via Cloudflare Transform Rules
**Effort:** 1 hr · **Impact:** 🟢 high · **Score lift:** +5
- Cloudflare → Rules → Transform Rules → Modify Response Header
- Add HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Verify via `curl -I https://nexusmortgage.sg/`
- Required for MAS-regulated YMYL trust posture

### C2. Fix Article `image` to ImageObject on all 13 blog posts
**Effort:** 30 min · **Impact:** 🟢 high · **Score lift:** +3
- Replace bare string with `{"@type":"ImageObject","url":"...","width":1344,"height":768}`
- Required for Google Article rich-result eligibility
- Bulk find/replace in `blog/*.html`

### C3. Remove dead HowTo schema
**Effort:** 5 min · **Impact:** 🟡 cleanup · **Score lift:** +1
- Delete HowTo block from `blog-first-time-hdb-buyer-guide.html`
- Google killed HowTo rich results Sept 2023

### C4. Add Person entity for Dan Ler
**Effort:** 30 min · **Impact:** 🟢 high · **Score lift:** +4
- Standalone Person block on `/about/` with `@id`, `jobTitle`, `worksFor`, `knowsAbout`, `sameAs` (LinkedIn, GBP)
- Update every Article author node to reference `@id`
- E-E-A-T anchor + AI-citation attribution

### C5. Display MAS license/registration number
**Effort:** 15 min · **Impact:** 🟢 high · **Score lift:** +2
- Add to footer + `/about/` page + Person schema
- YMYL trust requirement, AI engines look for it on financial-advisory pages

---

## HIGH (fix within 2 weeks)

### H1. Deduplicate `styles.min.css` link tags
**Effort:** 15 min · **Impact:** 🟢 high · **Score lift:** +3
- `/mortgage-rates/`: 3 → 1
- `/free-report/`: 2 → 1
- `/affordability/`: 3 → 1
- Each duplicate = blocking round-trip removed

### H2. Add `defer` to Chart.js + datalabels
**Effort:** 5 min · **Impact:** 🟡 medium · **Score lift:** +1
- File: `/free-report/index.html`
- Both `<script src=".../chart.js">` and datalabels plugin

### H3. Self-host Cormorant Garamond + DM Sans woff2
**Effort:** 1.5 hr · **Impact:** 🟢 high · **Score lift:** +4
- Download woff2 subsets for the 2-3 weights actually used
- Add `<link rel=preload as=font crossorigin>` for above-fold weights
- Drop Google Fonts blocking chain (~300-600 ms LCP saved)

### H4. Add `width`/`height` to all hero `<img>` tags
**Effort:** 30 min · **Impact:** 🟡 medium · **Score lift:** +2
- Start with `ec-mop-2026-hero.webp` on the new EC post
- Sweep all 13 blog posts for hero + inline images
- CLS fix

### H5. Add @id to MortgageBroker entity
**Effort:** 10 min · **Impact:** 🟡 medium · **Score lift:** +1
- `"@id": "https://nexusmortgage.sg/#organization"` on every page that declares MortgageBroker
- Enables cross-page node referencing

### H6. Add WebSite SearchAction (Sitelinks Searchbox)
**Effort:** 10 min · **Impact:** 🟡 medium · **Score lift:** +1
- Homepage WebSite block + `potentialAction` with SearchAction → `urlTemplate`

### H7. Fix NAP unit-number drift
**Effort:** 15 min · **Impact:** 🟢 high (local) · **Score lift:** +3
- Homepage + `/about/` schema `streetAddress` missing `#06-02B`
- Also update `sameAs` from Google Maps shortlink to canonical GBP CID URL

### H8. Add IndexNow protocol
**Effort:** 1 hr · **Impact:** 🟢 high · **Score lift:** +3
- Generate key at bing.com/indexnow
- Drop `{key}.txt` at domain root
- GitHub Actions cron: ping `api.indexnow.org/indexnow` on every commit affecting `/blog/` or `/mortgage-rates/`
- Site has daily-rate refresh — IndexNow is genuinely high-value here

### H9. Restore consistent schema on `blog-hdb-vs-bank-loan.html`
**Effort:** 10 min · **Impact:** 🟡 medium · **Score lift:** +1
- Add FAQPage + BreadcrumbList blocks (the only post missing them)

### H10. Resolve robots.txt AI bot conflict
**Effort:** 10 min · **Impact:** 🟡 medium · **Score lift:** +1
- Remove Cloudflare-managed `Disallow: /` block for AI agents
- Keep only your explicit `Allow: /` directives

---

## MEDIUM (fix within 1 month)

### M1. Spin out 4 dedicated service pages
- `/services/hdb-home-loan/`
- `/services/private-property-loan/`
- `/services/refinancing/`
- `/services/commercial-property-loan/`
- Each with own LocalBusiness/Service schema. Major local + topic-cluster lift.

### M2. Add Maps iframe to `/contact/`
- Embed Google Maps iframe pointing to GBP CID. Local pack signal.

### M3. Extract per-page inline CSS to versioned external file
- Homepage: 55 KB inline. `/free-report/`: 47 KB.
- Move to versioned `/styles-{hash}.css`. Cache hit on repeat visits = zero parse cost.

### M4. Add AggregateRating schema if reviews exist
- Pull Google reviews via GBP API or manual.
- Surface in MortgageBroker block.

### M5. Migrate to clean URLs (drop `.html` + `blog-` prefix)
- `/blog/blog-foo.html` → `/blog/foo/`
- 301 redirects from old to new
- Update sitemap, internal links, canonicals.
- Larger lift but resolves the .html duplicate issue and tightens slugs.

### M6. Add `keywords` to 11 Article blocks
- Topic classification signal.

### M7. Add `availableLanguage: ["en", "zh"]` to Organization schema
- Mandarin already declared in body text.

### M8. Outreach for backlinks
- Stacked Homes, 99.co, EdgeProp, Seedly, MoneySmart, Dollars & Sense
- Pitch: free `/sora-feed.json` for their rate-trackers + EC/HDB analysis posts.

---

## LOW (backlog)

- L1. Narrow `Disallow: /*?*` in robots.txt to specific patterns.
- L2. Verify Cloudflare proxy on www CNAME (currently routing through BOM PoP for some users).
- L3. Add `<link rel=preload as=image>` for homepage hero element.
- L4. Investigate homepage 231 KB HTML payload — defer below-fold rates table rows.
- L5. `size-adjust` on fallback font stack to reduce FOUT-induced CLS.

---

## Score Trajectory

| Stage | Score | Delta |
|---|---|---|
| Now | 74 | — |
| After Critical (C1-C5) | 89 | +15 |
| After High (H1-H10) | 91 | +2 (mostly hardening, less score-visible) |
| After Medium (M1-M8) | 95 | +4 |
| Stretch | 97-98 | requires backlink + review velocity, time-bound |

---

## Owner Quick-Sheet

| Item | Files Touched | Time | Priority |
|---|---|---|---|
| Cloudflare headers | (Cloudflare dashboard) | 1h | C1 |
| Article ImageObject | `blog/*.html` × 13 | 30m | C2 |
| Remove HowTo | `blog/blog-first-time-hdb-buyer-guide.html` | 5m | C3 |
| Person Dan Ler | `about/index.html` + all `blog/*.html` | 30m | C4 |
| MAS license display | `about/index.html`, footer | 15m | C5 |
| Dedupe styles.min.css | `mortgage-rates/index.html`, `free-report/index.html`, `affordability/index.html` | 15m | H1 |
| Defer Chart.js | `free-report/index.html` | 5m | H2 |
| Self-host fonts | (new `/fonts/` dir + all pages) | 1.5h | H3 |
| Image dims | `blog/*.html` | 30m | H4 |
| MortgageBroker @id | `index.html`, `about/`, `contact/`, `services/` | 10m | H5 |
| WebSite SearchAction | `index.html` | 10m | H6 |
| NAP unit number | `index.html`, `about/index.html` | 15m | H7 |
| IndexNow | (new key file + GitHub Action) | 1h | H8 |
| Schema parity | `blog/blog-hdb-vs-bank-loan.html` | 10m | H9 |
| robots.txt | `robots.txt` | 10m | H10 |

**Total Critical+High effort:** ~7 hours. Score lift: +30 points if all shipped.

---

## What's Already Done (don't redo)

- ✅ Sitemap valid, accurate, robots-referenced (9/10 score, see VALIDATION-REPORT.md)
- ✅ HTTPS + HTTP/2 + canonical + viewport + sitemap referenced in robots ✓
- ✅ AI bots explicitly allowed in robots.txt
- ✅ llms.txt populated with rate endpoints + blog list (just updated for EC post)
- ✅ 13 blog posts with substantive 1500-2000 word coverage
- ✅ FAQPage schema on 12 of 13 blog posts (kept for GEO/LLM citation value despite Google's 2023 rich-result restriction)
- ✅ External citations to MAS, IRAS, CPF, HDB, URA on every blog post
- ✅ Sitemap lastmod for `/blog/` and `/mortgage-rates/` bumped to 2026-05-09 (commit c12a3f8)
- ✅ Internal linking to `/free-report/` from every blog post (lead-magnet equity confirmed)
