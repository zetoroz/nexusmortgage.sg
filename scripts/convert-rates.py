#!/usr/bin/env python3
"""
Convert /login/rates.xlsx → /rates.json

Run from project root:
    python3 scripts/convert-rates.py

The rates.xlsx is a wide pivot table. Each column is one bank+package+qualifying-amount
combination. This script normalises it into a flat JSON array of packages, each with
parsed numeric year-by-year rates, lock-in years, and lender info.

Reference rates (1M SORA, 3M SORA, FHR6) are read from rows 27-28 / inferred from formulas,
and used to compute floating package rates that don't have an explicit "= X.XX%" suffix.
"""
import json
import os
import re
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
# rates.xlsx now lives in repo root (was login/rates.xlsx). Fall back to legacy path.
_XLSX_ROOT   = ROOT / "rates.xlsx"
_XLSX_LEGACY = ROOT / "login" / "rates.xlsx"
XLSX = _XLSX_ROOT if _XLSX_ROOT.exists() else _XLSX_LEGACY
OUT  = ROOT / "rates.json"
HISTORY = ROOT / "rates-history.json"   # append-only audit log of rate changes

# Reference rate fallbacks (used if not detected in the sheet)
DEFAULT_REFS = {"sora1m": 1.076, "sora3m": 1.122, "fhr6": 0.80}

# CLI flag --use-json-refs: prefer refRates from existing rates.json over xlsx.
# Used by the daily MAS cron so live SORA values flow into per-package year1Rate.
USE_JSON_REFS = "--use-json-refs" in sys.argv or os.environ.get("USE_JSON_REFS") == "1"

# ---------- helpers ----------

def forward_fill(values):
    """Take a list, propagate the last non-None value forward into None slots."""
    out = []
    last = None
    for v in values:
        if v is not None and str(v).strip():
            last = v
        out.append(last)
    return out

def parse_qualifying_min(text):
    """`>$1.5M`, `> $500K`, `> $1M + $30K Privilege onboard + CC` → 1500000 / 500000 / 1000000."""
    if not text: return None
    m = re.search(r'\$\s*([\d.]+)\s*(M|K|mil|k)', str(text), re.IGNORECASE)
    if not m: return None
    val = float(m.group(1))
    unit = m.group(2).upper()
    if unit in ('M', 'MIL'): return int(val * 1_000_000)
    if unit == 'K':          return int(val * 1_000)
    return None

def parse_lockin(text):
    """`2yrs` / `2 yrs` / `1yr` / `3yrs` → 2 / 2 / 1 / 3."""
    if not text: return None
    m = re.search(r'(\d+)\s*yr', str(text), re.IGNORECASE)
    return int(m.group(1)) if m else None

def parse_rate(text, refs):
    """
    Parse a year-by-year rate cell into a numeric % value.

    Handles patterns:
      'FHR6 (0.80%) + 0.55% = 1.35%'        → 1.35  (use after =)
      'FHR 6 (1.40%) + 0.70%'               → 2.10  (compute from base + spread inline)
      '1.45% Fixed' / '1.45 Fixed'          → 1.45
      '1M SORA + 0.00% = 1.076%'            → 1.076
      '1M SORA + 0.60%'                     → refs.sora1m + 0.60
      '3M SORA + 0.30% = 1.422%'            → 1.422
      '1M/3M SORA + 0.55%'                  → refs.sora3m + 0.55  (use the slower of the two)
      '1.50% Fixed' or any 'X.XX% Fixed'    → 1.50
    """
    if text is None: return None
    s = str(text).strip()
    if not s: return None

    # 1) Has '= X.XX%' suffix → use that
    m = re.search(r'=\s*([\d.]+)\s*%?', s)
    if m:
        try: return round(float(m.group(1)), 4)
        except: pass

    # 2) Pattern 'FHR<n> (X.XX%) + Y.YY%'  — compute base + spread
    m = re.search(r'FHR\s*\d?\s*\(\s*([\d.]+)\s*%\s*\)\s*\+\s*([\d.]+)\s*%', s, re.IGNORECASE)
    if m:
        try: return round(float(m.group(1)) + float(m.group(2)), 4)
        except: pass

    # 3) 'X.XX% Fixed' or 'X.XX Fixed'
    m = re.search(r'([\d.]+)\s*%?\s*Fixed', s, re.IGNORECASE)
    if m:
        try: return round(float(m.group(1)), 4)
        except: pass

    # 4) '1M SORA + X.XX%' / '3M SORA + X.XX%' / '1M/3M SORA + X.XX%'
    m_sora = re.search(r'(1M|3M|1M\s*/\s*3M)\s*SORA\s*\+\s*([\d.]+)\s*%', s, re.IGNORECASE)
    if m_sora:
        ref_label = m_sora.group(1).upper().replace(' ', '')
        try:
            spread = float(m_sora.group(2))
            if ref_label == '1M':           ref = refs['sora1m']
            elif ref_label == '3M':         ref = refs['sora3m']
            elif ref_label == '1M/3M':      ref = max(refs['sora1m'], refs['sora3m'])
            else:                            ref = refs['sora3m']
            return round(ref + spread, 4)
        except: pass

    # 5) Bare 'FHR' reference without parens → use ref + spread
    m = re.search(r'FHR\s*\d?\s*\+\s*([\d.]+)\s*%', s, re.IGNORECASE)
    if m:
        try: return round(refs['fhr6'] + float(m.group(1)), 4)
        except: pass

    # 6) Fallback: first percentage anywhere
    m = re.search(r'([\d.]+)\s*%', s)
    if m:
        try: return round(float(m.group(1)), 4)
        except: pass

    return None

def parse_ref_rate(label_text):
    """`1M COMPOUNDED SORA: 1.076%` → 1.076"""
    if not label_text: return None
    m = re.search(r':\s*([\d.]+)\s*%', str(label_text))
    return float(m.group(1)) if m else None

# ---------- main ----------

def main():
    wb = load_workbook(XLSX, data_only=True)
    ws = wb["All Rates"]

    # 1) Reference rates
    refs = dict(DEFAULT_REFS)
    r27_label = ws.cell(27, 1).value
    r28_label = ws.cell(28, 1).value
    v = parse_ref_rate(r27_label)
    if v is not None: refs['sora1m'] = v
    v = parse_ref_rate(r28_label)
    if v is not None: refs['sora3m'] = v

    # 1a) If --use-json-refs flag set, override with values from existing rates.json.
    # Lets the daily MAS cron flow live SORA into per-package year1Rate.
    if USE_JSON_REFS and OUT.exists():
        try:
            existing = json.loads(OUT.read_text())
            json_refs = existing.get("refRates") or {}
            for k in ("sora1m", "sora3m", "sora6m", "fhr6"):
                if k in json_refs and json_refs[k] is not None:
                    refs[k] = float(json_refs[k])
            print(f"[convert-rates] --use-json-refs: refs from rates.json = {refs}")
        except Exception as e:
            print(f"[convert-rates] WARN: --use-json-refs requested but failed: {e}")

    # As-of date — best-effort: row 26 col 1 might say "As of 27 Feb 2026"
    as_of = None
    for r in range(25, 30):
        cell = ws.cell(r, 1).value
        if cell and 'As of' in str(cell):
            as_of = str(cell).replace('As of', '').strip()
            break
    if not as_of:
        as_of = "Apr 2026"

    # 2) Forward-fill the header rows (category, subcat, lender, lock-in)
    last_col = ws.max_column
    cats     = forward_fill([ws.cell(1, c).value for c in range(2, last_col + 1)])
    subcats  = forward_fill([ws.cell(2, c).value for c in range(2, last_col + 1)])
    lenders  = [ws.cell(4, c).value for c in range(2, last_col + 1)]  # do NOT forward-fill lender — multi-lender groups
    qualifs  = [ws.cell(3, c).value for c in range(2, last_col + 1)]
    lockins  = forward_fill([ws.cell(12, c).value for c in range(2, last_col + 1)])

    packages = []
    for idx, c in enumerate(range(2, last_col + 1)):
        lender = lenders[idx]
        if not lender:
            continue  # skip empty / spacer columns
        cat    = cats[idx] or ''
        sub    = subcats[idx] or ''
        qual   = qualifs[idx] or ''
        lockin = lockins[idx] or ''
        # parse year-by-year
        yr1 = ws.cell(5, c).value
        yr2 = ws.cell(6, c).value
        yr3 = ws.cell(7, c).value
        yr4 = ws.cell(8, c).value
        yr5 = ws.cell(9, c).value
        thr = ws.cell(10, c).value
        rate1 = parse_rate(yr1, refs)
        # Skip rows where year-1 has no rate (likely a malformed column)
        if rate1 is None:
            continue
        # Determine product family for /free-report/ matching
        family = None
        sub_l = str(sub).lower()
        cat_l = str(cat).lower()
        if 'fhr' in sub_l:               family = 'fhr'
        elif '1 mth sora' in sub_l or '1m sora' in sub_l: family = 'sora1m'
        elif '3 mths sora' in sub_l or '3m sora' in sub_l: family = 'sora3m'
        elif 'combo' in sub_l or 'combo' in cat_l:        family = 'combo'
        elif '1yr fixed' in sub_l or '1 yr fixed' in sub_l or '1year fixed' in sub_l: family = 'fixed1y'
        elif '2yrs fixed' in sub_l or '2 yrs fixed' in sub_l: family = 'fixed2y'
        elif '3yrs fixed' in sub_l or '3 yrs fixed' in sub_l: family = 'fixed3y'

        pkg = {
            "id": idx + 1,
            "lender": str(lender).strip(),
            "category": str(cat).replace(' RATES', '').strip().title(),  # 'Variable', 'Combo', 'Fixed'
            "subCategory": str(sub).strip(),
            "family": family,
            "qualifying": str(qual).strip(),
            "qualifyingMin": parse_qualifying_min(qual),
            "lockInYears": parse_lockin(lockin),
            "year1Rate": rate1,
            "year2Rate": parse_rate(yr2, refs),
            "year3Rate": parse_rate(yr3, refs),
            "year4Rate": parse_rate(yr4, refs),
            "year5Rate": parse_rate(yr5, refs),
            "thereafterRate": parse_rate(thr, refs),
            "year1Raw": (str(yr1).strip() if yr1 else None),
            "year2Raw": (str(yr2).strip() if yr2 else None),
            "year3Raw": (str(yr3).strip() if yr3 else None),
            "year4Raw": (str(yr4).strip() if yr4 else None),
            "year5Raw": (str(yr5).strip() if yr5 else None),
            "thereafterRaw": (str(thr).strip() if thr else None),
        }
        packages.append(pkg)

    out = {
        "asOf": as_of,
        "refRates": refs,
        "packages": packages,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "xlsxFingerprint": _hash_xlsx(XLSX),
    }

    # ---- Diff against previous rates.json (for history) ----
    prev = None
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text())
        except Exception as e:
            print(f"  (could not read previous rates.json: {e})")

    # Preserve MAS-API-sourced asOfSora written by fetch-mas-rates.mjs.
    # convert-rates.py overwrites rates.json from xlsx; without this guard,
    # the daily MAS asOfSora gets clobbered every run and the front end
    # falls back to the stale "As of …" string typed into the xlsx.
    # SORA numeric values are already preserved via --use-json-refs flag.
    if prev:
        prev_as_of_sora = prev.get("asOfSora")
        if prev_as_of_sora:
            out["asOfSora"] = prev_as_of_sora
        prev_inner = (prev.get("refRates") or {}).get("asOfSora")
        if prev_inner:
            out["refRates"]["asOfSora"] = prev_inner

    diffs = _diff_packages(prev["packages"] if prev else [], packages) if prev else []
    refDiffs = _diff_refs(prev.get("refRates") if prev else {}, refs)

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"✓ Wrote {len(packages)} packages → {OUT}")

    # ---- Append history entry ----
    entry = {
        "generatedAt": out["generatedAt"],
        "asOf": as_of,
        "xlsxFingerprint": out["xlsxFingerprint"],
        "packageCount": len(packages),
        "refRates": refs,
        "refRateChanges": refDiffs,
        "packageChanges": diffs,           # only entries where year1Rate / lockIn / qualifyingMin differs
        "summary": _summarise_diff(diffs, refDiffs, prev is not None),
    }
    history = []
    if HISTORY.exists():
        try:
            history = json.loads(HISTORY.read_text())
        except Exception:
            history = []
    history.append(entry)
    # Keep only last 200 entries
    history = history[-200:]
    HISTORY.write_text(json.dumps(history, indent=2, ensure_ascii=False))
    print(f"✓ Appended history entry → {HISTORY} ({len(history)} total)")

    # ---- Sanity summary ----
    by_family = {}
    by_lender = {}
    for p in packages:
        by_family[p['family']] = by_family.get(p['family'], 0) + 1
        by_lender[p['lender']] = by_lender.get(p['lender'], 0) + 1
    print(f"  Families: {by_family}")
    print(f"  Lenders:  {by_lender}")
    print(f"  Diff: {entry['summary']}")


def _hash_xlsx(path):
    """SHA-1 fingerprint of the xlsx so we can tell whether the master file changed."""
    if not path.exists():
        return None
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()[:12]


def _pkg_key(p):
    """Stable key per (lender, family, qualifyingMin) — survives row reordering in xlsx."""
    return f"{p.get('lender','?')}|{p.get('family','?')}|{p.get('qualifyingMin') or 0}"


def _diff_packages(old, new):
    """Return a list of {key, what, before, after} for material changes."""
    om = {_pkg_key(p): p for p in old}
    nm = {_pkg_key(p): p for p in new}
    changes = []
    for key, np in nm.items():
        op = om.get(key)
        if op is None:
            changes.append({
                "key": key, "lender": np['lender'], "package": np.get('subCategory'),
                "qualifying": np.get('qualifying'), "what": "added", "after": np.get('year1Rate')
            })
            continue
        if op.get('year1Rate') != np.get('year1Rate'):
            delta = round((np.get('year1Rate') or 0) - (op.get('year1Rate') or 0), 4)
            changes.append({
                "key": key, "lender": np['lender'], "package": np.get('subCategory'),
                "qualifying": np.get('qualifying'),
                "what": "year1Rate",
                "before": op.get('year1Rate'),
                "after": np.get('year1Rate'),
                "deltaPct": delta,
            })
        if op.get('lockInYears') != np.get('lockInYears'):
            changes.append({
                "key": key, "lender": np['lender'],
                "what": "lockInYears",
                "before": op.get('lockInYears'),
                "after": np.get('lockInYears'),
            })
        if op.get('qualifyingMin') != np.get('qualifyingMin'):
            changes.append({
                "key": key, "lender": np['lender'],
                "what": "qualifyingMin",
                "before": op.get('qualifyingMin'),
                "after": np.get('qualifyingMin'),
            })
    for key, op in om.items():
        if key not in nm:
            changes.append({
                "key": key, "lender": op['lender'], "package": op.get('subCategory'),
                "qualifying": op.get('qualifying'), "what": "removed", "before": op.get('year1Rate')
            })
    return changes


def _diff_refs(old, new):
    out = {}
    for k in ('sora1m', 'sora3m', 'fhr6'):
        ov = old.get(k) if old else None
        nv = new.get(k)
        if ov != nv:
            out[k] = {"before": ov, "after": nv,
                      "deltaPct": round((nv or 0) - (ov or 0), 4) if ov is not None else None}
    return out


def _summarise_diff(pkgChanges, refChanges, hadPrevious):
    if not hadPrevious:
        return "Initial rates.json — no prior version to diff against."
    if not pkgChanges and not refChanges:
        return "No material changes."
    parts = []
    if refChanges:
        parts.append(f"ref rates changed: {', '.join(refChanges.keys())}")
    by_kind = {}
    for c in pkgChanges:
        by_kind[c['what']] = by_kind.get(c['what'], 0) + 1
    parts.append(", ".join(f"{n} {k}" for k, n in by_kind.items()))
    return " · ".join(parts)


if __name__ == "__main__":
    main()
