# Sitemap Validation Report — nexusmortgage.sg

**Audited:** 2026-05-09
**Sitemap:** https://nexusmortgage.sg/sitemap.xml
**URL count:** 23 (well below 50,000 protocol limit)

## Pass

- Valid XML (`xmllint` clean)
- All 23 URLs return HTTP 200
- All HTTPS, no HTTP, no www-mismatch
- `robots.txt` references sitemap on line 47
- All canonical tags match sitemap `<loc>` (no canonical drift)
- No `noindex` directives on any sitemap URL
- No redirects in sitemap (all final URLs)
- New EC MOP 2026 post correctly registered with `lastmod` 2026-05-09
- AI/LLM crawlers explicitly allowed (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, etc.) — strong GEO posture
- Login dir `/login/` correctly disallowed in robots + absent from sitemap

## Issues

| # | Issue | Severity | URLs affected | Fix |
|---|-------|----------|---------------|-----|
| 1 | `<priority>` + `<changefreq>` on every URL | Info | 23 / 23 | Remove both tags. Google has ignored them since 2017. Sitemap shrinks ~30%. |
| 2 | Stale `lastmod` dates | Low | ~15 URLs frozen at 2026-04-27/28/30 | Bump `lastmod` only when page content actually changes. Auto-set via build/deploy hook. |
| 3 | `/mortgage-rates/` `lastmod` = 2026-04-30 but rates refresh daily (`rates.json`) | Medium | 1 | Bump `lastmod` daily alongside rates cron — page content (rate cards) changes daily. |
| 4 | No image sitemap | Low | 0 | Add `sitemap-images.xml` with `<image:image>` entries for blog hero images. Improves Google Images SERP + AI Overviews citation odds. |
| 5 | No `<lastmod>` on `/blog/` index | Low | 1 | Update `lastmod` on blog index when new posts added. Currently 2026-04-28 — should be 2026-05-09. |

## Coverage Check

Filesystem `index.html` files vs sitemap entries — **100% covered**:

```
✅ /                           ✅ /about/
✅ /contact/                   ✅ /services/
✅ /affordability/             ✅ /refinance-calculator/
✅ /equity-loan/               ✅ /free-report/
✅ /mortgage-rates/            ✅ /blog/
✅ /blog/blog-* (13 posts)     ⛔ /login/ (correctly excluded — disallowed)
```

No orphan pages, no missing pages.

## Recommendations (priority-ranked)

### High value, low effort
1. **Bump `/blog/` index `lastmod` to 2026-05-09** — signals fresh content to Googlebot.
2. **Bump `/mortgage-rates/` `lastmod` to today** — daily SORA refresh content is fresh; sitemap currently lies.

### Medium value
3. **Strip `<priority>` + `<changefreq>` tags** — clean noise, shrinks file. Optional but tidier.
4. **Add image sitemap** — extends visibility in image SERPs and AI citation surfaces (Perplexity, ChatGPT search). Especially valuable now that 13 blog posts have unique hero images.

### Low priority
5. **Daily lastmod automation** — cron job in `scripts/` that bumps `lastmod` on `/mortgage-rates/` whenever `rates.json` changes.

## Quick Fix Patch

Suggested two-line edit (immediate):

```xml
<!-- Blog index: bump lastmod -->
<url>
  <loc>https://nexusmortgage.sg/blog/</loc>
  <lastmod>2026-05-09</lastmod>
  ...

<!-- Rates page: bump lastmod -->
<url>
  <loc>https://nexusmortgage.sg/mortgage-rates/</loc>
  <lastmod>2026-05-09</lastmod>
  ...
```

## Verdict

**Score: 9/10.** Clean, accurate, well-maintained sitemap. Only nitpicks: stale lastmod on 2 high-velocity pages and unnecessary deprecated tags. No critical issues, no penalties at risk.
