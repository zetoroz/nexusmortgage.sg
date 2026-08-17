# Rates Sync — How to Update Bank Rates

The rates the website shows live in two layers:

1. **`/rates.xlsx`** (project root) — master spreadsheet, edited like any normal Excel file. Wide pivot table with one column per (lender × package × qualifying-tier). Legacy path `/login/rates.xlsx` still supported as fallback.
2. **`/rates.json`** — generated, normalised JSON. Read by the website at runtime.

## Daily SORA Auto-Refresh (CI)

`scripts/fetch-mas-rates.mjs` runs daily at 09:00 SGT via GitHub Action
(`.github/workflows/fetch-mas-rates.yml`). Pipeline:

1. `node scripts/fetch-mas-rates.mjs` — pull live SORA from MAS, update `rates.json.refRates`.
2. `python3 scripts/convert-rates.py --use-json-refs` — re-read `rates.xlsx`, override refRates with the just-fetched values, recompute every package's `year1Rate` (so `/free-report/` and the PDF get fresh numbers).
3. `node scripts/fetch-mas-rates.mjs --feeds-only` — regenerate `rates.xml` + `sora-feed.json` from the post-Python `rates.json`.
4. Commit + push if anything changed.

Set repo Variable `MAS_API_URL` to override the default endpoint when MAS publishes a known-good URL.

## To update rates manually (when you change the xlsx)

1. Open `/rates.xlsx`, edit the values you need (rates, qualifying amounts, lock-ins).
2. Save the file.
3. From the project root, run:

   ```bash
   python3 scripts/convert-rates.py
   ```

   This regenerates `/rates.json`. You'll see a summary like:
   ```
   ✓ Wrote 98 packages → /rates.json
     Families: {'fhr': 3, 'sora1m': 15, 'sora3m': 19, 'combo': 1, 'fixed1y': 11, 'fixed2y': 32, 'fixed3y': 17}
     Lenders:  {'DBS': 18, 'UOB': 18, 'CITI': 4, ...}
   ```

4. Commit and push `rates.xlsx`, `rates.json`, **and `rates-history.json`**.

## Flag: `--use-json-refs`

Force `convert-rates.py` to read `refRates` from the existing `rates.json` instead
of the xlsx's reference-rate cells. Used by the daily cron so MAS-fetched SORA
values flow into per-package `year1Rate`. Run manually:

```bash
node scripts/fetch-mas-rates.mjs && python3 scripts/convert-rates.py --use-json-refs
```

## Tracking changes

Every time `convert-rates.py` runs it:
- Diffs the new `rates.json` against the previous one (per-package year1Rate, lockInYears, qualifyingMin, plus the ref rates).
- Appends a structured entry to `rates-history.json` — timestamp, asOf, xlsx fingerprint, and the list of changes.
- Keeps the last 200 entries (so old syncs eventually roll off).

Open **`/login/rates-admin.html`** in a browser to see the live state:
- Current asOf, package count, last-sync age, xlsx fingerprint.
- Filterable rate table (all / fixed / floating + free-text search).
- Change history — what each lender's rate moved from→to, with delta pills.

## What the JSON contains

```json
{
  "asOf": "27 Feb 2026",
  "refRates": { "sora1m": 1.076, "sora3m": 1.122, "fhr6": 0.80 },
  "packages": [
    {
      "id": 1,
      "lender": "DBS",
      "category": "Variable",
      "subCategory": "FHR Pegged",
      "family": "fhr",
      "qualifying": ">$1.5M",
      "qualifyingMin": 1500000,
      "lockInYears": 2,
      "year1Rate": 1.35,
      "year2Rate": 1.35,
      "year3Rate": 2.10,
      "year4Rate": 2.40,
      "year5Rate": 2.40,
      "thereafterRate": 2.40,
      "year1Raw": "FHR6 (0.80%) + 0.55% = 1.35%",
      ...
    },
    ...
  ]
}
```

## Where it's used

- **`/free-report/`** fetches `rates.json` and picks the best package per (lender, family) for the user's loan amount tier. Falls back to a baked-in 6-bank list if the JSON fails to load.
- **`/mortgage-rates/`** fetches `rates.json` to keep its 1M SORA / 3M SORA / FHR6 reference rates and the "as of" date in sync. The full package cards on that page still use the curated inline config (richer formatting, lock-in details, after-fixed continuation strings).
- **`/rates.xlsx`** (root) — the master xlsx lives here. Legacy path `/login/rates.xlsx` still works as fallback.

## Schema notes

- `family` is one of: `fhr`, `sora1m`, `sora3m`, `combo`, `fixed1y`, `fixed2y`, `fixed3y` — used by `/free-report/` to group packages.
- `qualifyingMin` is parsed from `qualifying` text (`>$1.5M` → 1500000). If the qualifying text contains additional conditions (`+ $30K Privilege onboard`), only the dollar threshold is captured.
- `yearXRate` is the parsed numeric percentage. The original cell text is preserved as `yearXRaw` for display.
- Year-rate parsing handles four common patterns:
  1. `... = X.XX%` → use the value after `=`
  2. `FHR<n> (R%) + S%` → compute `R + S`
  3. `X.XX% Fixed` → use `X.XX`
  4. `1M SORA + S%` / `3M SORA + S%` → `refRates.soraXm + S`

## Adding new lenders / packages

The script picks up any column whose row 4 (Lenders) is non-empty and whose year-1 rate parses to a number. To add a new lender:
1. Add the columns in the xlsx following the same row layout.
2. Re-run the script.
3. If the lender's display name should be different from its xlsx code (e.g. `MB` → `Maybank`), update `LENDER_DISPLAY` in `/free-report/index.html`.

---

# Article Infographics

Blog articles carry a hero plus **two in-article images**. In-article images are
brand infographics rendered from HTML, not stock photos and not AI renders, so
they can be re-rendered whenever a rule or a rate changes.

Thumbnails (`*-thumb.webp`) are for the `/blog/` grid only and must never be
used as an in-article image.

## New articles

`new-article.py` now owns both. Define `IMAGES` in the article module and the
generator merges the specs, renders them, and places them:

```bash
python3 scripts/new-article.py scripts/articles/my_article.py
```

It refuses to run if the template has lost the floating WhatsApp button or the
in-article image CSS, and warns if an article ends up without a hero plus two
cards. `--no-images` defers the image step.

`scripts/articles/sibor.py` is the worked reference: it carries `IMAGES`, and
re-running it reproduces the published article byte for byte.

The floating WhatsApp button is inherited from the template, so it needs no
per-article config. `scripts/add-wa-float.py` backfills it into existing
articles if one ever slips through.

## Adding images to an existing article

1. Add two entries to **`scripts/infographic-specs.json`**:

   ```json
   {
     "out": "my-article-ltv-ladder",
     "slug": "my-article-slug",
     "type": "ladder",
     "kicker": "Section label",
     "title": "The point the card makes",
     "source": "Assumptions and caveats, shown small at the foot.",
     "rows": [ { "label": "...", "value": "45%", "pct": 60, "highlight": true } ],
     "anchor": "ltv",
     "alt": "Descriptive alt text for screen readers and image search",
     "caption": "A takeaway, not a repeat of the title."
   }
   ```

   `anchor` is the `id` of the `<h2>` the image is inserted after.
   Pull the numbers from the article itself so the card and the prose agree.

2. Render, then place:

   ```bash
   python3 scripts/build-article-infographics.py       # all, or pass a name filter
   python3 scripts/insert-article-images.py            # --dry-run to preview
   ```

Both scripts are idempotent. `insert-article-images.py` also adds the
`.blog-img` / `.img-caption` CSS if the article lacks it, promotes a `hero`
card into `og:image` / `twitter:image`, and rebuilds the Article JSON-LD
`image` array to match the page.

## Tables

Tables in `BODY` must carry `class="compare-table"`. A bare `<table>` inherits
no styling and renders as unformatted text.

## Card types

| `type` | Shape | Use for |
|---|---|---|
| `ladder` | Horizontal bars | Tiers and bands: BSD, LTV, SSD, land psf |
| `compare` | Column table | 2 to 4 options across several features |
| `timeline` | Nodes plus cards | Sequences and dates |
| `math` | Stacked sum with total | Worked cash examples |
| `stat` | Big number tiles | Three headline figures |
| `split` | Two-column decision | This-or-that choices |
| `hero` | Navy banner | Article hero when there is no photo |

Output is 1344x768 `.png` + `.webp` in `blog/blog-images/`, matching every
other blog image. Rendering needs `chrome-headless-shell`; override the path
with `CHROME_BIN` if Playwright's copy moves.
