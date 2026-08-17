#!/usr/bin/env python3
"""Render brand infographics for blog articles.

Reads scripts/infographic-specs.json, builds an HTML card per spec, screenshots
it with chrome-headless-shell at 2x and writes a 1344x768 .png + .webp into
blog/blog-images/. Same dimensions as every other blog image.

  python3 scripts/build-article-infographics.py              # build all
  python3 scripts/build-article-infographics.py cooling-abo  # build matching

Cards are deliberately data-first: the numbers come from the article they sit
in, so a card can be re-rendered when a rule or a rate changes.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from html import escape
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "blog" / "blog-images"
SPECS = Path(__file__).resolve().parent / "infographic-specs.json"

W, H = 1344, 768
SCALE = 2

CHROME = os.environ.get("CHROME_BIN") or str(
    Path.home()
    / ".cache/ms-playwright/chromium_headless_shell-1234"
    / "chrome-headless-shell-linux64/chrome-headless-shell"
)

NAVY = "#0B1C3A"
GOLD = "#C4973B"
CREAM = "#FAF7F2"


def brand(css):
    """Substitute brand tokens without fighting printf-style formatting."""
    return (css.replace("$NAVY", NAVY).replace("$GOLD", GOLD).replace("$CREAM", CREAM))

BASE_CSS = brand("""
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@font-face{font-family:'Cormorant Garamond';src:url('/fonts/cormorant-garamond.woff2') format('woff2');font-weight:400 700;font-display:block}
@font-face{font-family:'DM Sans';src:url('/fonts/dm-sans.woff2') format('woff2');font-weight:400 700;font-display:block}
html,body{width:1344px;height:768px;overflow:hidden}
body{background:$CREAM;color:$NAVY;font-family:'DM Sans',system-ui,sans-serif;
     -webkit-font-smoothing:antialiased;position:relative}
.card{width:1344px;height:768px;padding:60px 72px 58px;display:flex;flex-direction:column;position:relative}
.kicker{font-size:15px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:$GOLD;margin-bottom:14px}
.title{font-family:'Cormorant Garamond',Georgia,serif;font-size:50px;line-height:1.06;font-weight:600;
       letter-spacing:-.015em;color:$NAVY;max-width:1120px}
.rule{width:74px;height:4px;background:$GOLD;border-radius:2px;margin:20px 0 0}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:6px 0 0}
.foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:14.5px;
      color:rgba(11,28,58,.42);letter-spacing:.02em}
.foot .src{max-width:900px;line-height:1.45}
.mark{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:rgba(11,28,58,.55);
      letter-spacing:.01em;white-space:nowrap}
.mark .dot{color:$GOLD}
/* corner flourish */
.card::after{content:'';position:absolute;right:0;top:0;width:250px;height:250px;
  background:radial-gradient(circle at 100% 0%,rgba(196,151,59,.16),rgba(196,151,59,0) 70%);pointer-events:none}
""")


def _shell(v):
    return escape(str(v), quote=False)


# --------------------------------------------------------------------------
# card templates
# --------------------------------------------------------------------------

def card_ladder(s):
    """Tiered bars. rows: [{label, value, pct, note?}] pct 0-100 drives width."""
    rows = ""
    for r in s["rows"]:
        hl = " hl" if r.get("highlight") else ""
        note = f'<span class="ln">{_shell(r["note"])}</span>' if r.get("note") else ""
        rows += (
            f'<div class="lrow{hl}">'
            f'<div class="llab">{_shell(r["label"])}</div>'
            f'<div class="ltrack"><div class="lbar" style="width:{r["pct"]}%"></div></div>'
            f'<div class="lval">{_shell(r["value"])}{note}</div>'
            f"</div>"
        )
    css = """
    .ladder{flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px}
    .lrow{display:grid;grid-template-columns:340px 1fr 150px;align-items:center;gap:30px;padding:7px 0}
    .llab{font-size:19.5px;font-weight:500;color:rgba(11,28,58,.82);line-height:1.25}
    .ltrack{height:42px;background:rgba(11,28,58,.07);border-radius:6px;overflow:hidden}
    .lbar{height:100%;background:linear-gradient(90deg,#12294f,#0B1C3A);border-radius:6px}
    .lrow.hl .lbar{background:linear-gradient(90deg,#C4973B,#E0B86A)}
    .lrow.hl .lval{color:#8a6620}
    .lval{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:600;text-align:right;line-height:1}
    .lval .ln{display:block;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;
              color:rgba(11,28,58,.45);letter-spacing:.02em;margin-top:5px}
    """
    return css, f'<div class="ladder">{rows}</div>'


def card_compare(s):
    """Column comparison. cols: [str]; rows: [{label, cells:[str]}]"""
    cols = s["cols"]
    n = len(cols)
    head = '<div class="crow chead"><div class="cfeat"></div>'
    for i, c in enumerate(cols):
        acc = " acc" if i == s.get("accent") else ""
        head += f'<div class="ccell{acc}">{_shell(c)}</div>'
    head += "</div>"
    body = ""
    for r in s["rows"]:
        body += f'<div class="crow"><div class="cfeat">{_shell(r["label"])}</div>'
        for i, c in enumerate(r["cells"]):
            acc = " acc" if i == s.get("accent") else ""
            body += f'<div class="ccell{acc}">{_shell(c)}</div>'
        body += "</div>"
    css = """
    .cmp{border-top:2px solid rgba(11,28,58,.14);flex:1;display:flex;flex-direction:column;justify-content:center}
    .crow{display:grid;grid-template-columns:280px repeat(%d,1fr);gap:20px;align-items:center;
          padding:15px 0;border-bottom:1px solid rgba(11,28,58,.11)}
    .crow:last-child{border-bottom:none}
    .chead{padding:14px 0 13px;border-bottom:2px solid rgba(11,28,58,.2)}
    .chead .ccell{font-size:15px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:#0B1C3A}
    .chead .ccell.acc{color:#8a6620}
    .cfeat{font-size:18px;font-weight:600;color:rgba(11,28,58,.9);line-height:1.25}
    .ccell{font-size:17px;color:rgba(11,28,58,.72);line-height:1.35}
    .ccell.acc{background:rgba(196,151,59,.14);border-radius:6px;padding:9px 13px;margin:-9px 0;
               color:rgba(11,28,58,.88);font-weight:500}
    """ % n
    return css, f'<div class="cmp">{head}{body}</div>'


def card_timeline(s):
    """Horizontal steps. steps: [{when, label, note?}]"""
    steps = ""
    for i, st in enumerate(s["steps"]):
        hl = " hl" if st.get("highlight") else ""
        note = f'<div class="tnote">{_shell(st["note"])}</div>' if st.get("note") else ""
        steps += (
            f'<div class="tstep{hl}"><div class="tdot"></div>'
            f'<div class="twhen">{_shell(st["when"])}</div>'
            f'<div class="tlab">{_shell(st["label"])}</div>{note}</div>'
        )
    css = """
    .tl{display:grid;grid-template-columns:repeat(%d,1fr);gap:24px;position:relative;
        align-items:stretch;padding-top:60px;margin-top:12px}
    .tl::before{content:'';position:absolute;left:9%%;right:9%%;top:14px;height:3px;
                background:rgba(11,28,58,.16);border-radius:2px}
    .tstep{position:relative;background:#fff;border:1px solid rgba(11,28,58,.12);border-radius:13px;
           padding:38px 24px 34px;text-align:center;display:flex;flex-direction:column;justify-content:center;
           box-shadow:0 2px 14px rgba(11,28,58,.05)}
    .tdot{width:21px;height:21px;border-radius:50%%;background:#FAF7F2;border:4px solid #0B1C3A;
          position:absolute;top:-55px;left:50%%;margin-left:-10.5px;z-index:2}
    .tstep.hl{background:#0B1C3A;border-color:#0B1C3A}
    .tstep.hl .tdot{border-color:#C4973B;background:#C4973B;box-shadow:0 0 0 7px rgba(196,151,59,.22)}
    .twhen{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:600;color:#0B1C3A;
           line-height:1.05;margin-bottom:13px}
    .tstep.hl .twhen{color:#C4973B}
    .tlab{font-size:18px;font-weight:600;color:rgba(11,28,58,.88);line-height:1.32;margin-bottom:8px}
    .tstep.hl .tlab{color:rgba(250,247,242,.94)}
    .tnote{font-size:15px;color:rgba(11,28,58,.5);line-height:1.42}
    .tstep.hl .tnote{color:rgba(250,247,242,.58)}
    """ % len(s["steps"])
    return css, f'<div class="tl">{steps}</div>'


def card_math(s):
    """Worked calculation. rows: [{label, value, op?}] then total {label, value, note?}"""
    rows = ""
    for r in s["rows"]:
        op = f'<span class="mop">{_shell(r["op"])}</span>' if r.get("op") else '<span class="mop"></span>'
        sub = f'<span class="msub">{_shell(r["note"])}</span>' if r.get("note") else ""
        rows += (
            f'<div class="mrow">{op}<div class="mlab">{_shell(r["label"])}{sub}</div>'
            f'<div class="mval">{_shell(r["value"])}</div></div>'
        )
    t = s["total"]
    tnote = f'<div class="tsub">{_shell(t["note"])}</div>' if t.get("note") else ""
    total = (
        f'<div class="mtotal"><div class="tlab2">{_shell(t["label"])}{tnote}</div>'
        f'<div class="tval">{_shell(t["value"])}</div></div>'
    )
    css = brand("""
    .math{max-width:1010px;margin:0 auto;width:100%}
    .mrow{display:grid;grid-template-columns:46px 1fr auto;align-items:baseline;gap:16px;
          padding:14px 0;border-bottom:1px solid rgba(11,28,58,.1)}
    .mop{font-family:'Cormorant Garamond',serif;font-size:32px;color:$GOLD;font-weight:600;line-height:1}
    .mlab{font-size:19px;font-weight:500;color:rgba(11,28,58,.85);line-height:1.3}
    .msub{display:block;font-size:14.5px;font-weight:400;color:rgba(11,28,58,.48);margin-top:4px}
    .mval{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:600;color:$NAVY;
          white-space:nowrap;line-height:1}
    .mtotal{display:flex;justify-content:space-between;align-items:center;margin-top:20px;
            background:$NAVY;border-radius:11px;padding:24px 32px}
    .tlab2{font-size:19px;font-weight:600;color:rgba(250,247,242,.9);letter-spacing:.01em}
    .tsub{font-size:14.5px;font-weight:400;color:rgba(250,247,242,.55);margin-top:5px}
    .tval{font-family:'Cormorant Garamond',serif;font-size:47px;font-weight:600;color:$GOLD;
          line-height:1;white-space:nowrap}
    """)
    return css, f'<div class="math">{rows}{total}</div>'


def card_stat(s):
    """Big number tiles. tiles: [{num, label, note?}]"""
    tiles = ""
    for t in s["tiles"]:
        note = f'<div class="snote">{_shell(t["note"])}</div>' if t.get("note") else ""
        hl = " hl" if t.get("highlight") else ""
        tiles += (
            f'<div class="stile{hl}"><div class="snum">{_shell(t["num"])}</div>'
            f'<div class="slab">{_shell(t["label"])}</div>{note}</div>'
        )
    css = brand("""
    .stats{display:grid;grid-template-columns:repeat(NCOL,1fr);gap:26px;align-items:stretch}
    .stile{background:#fff;border:1px solid rgba(11,28,58,.13);border-radius:13px;padding:40px 30px;min-height:300px;
           box-shadow:0 2px 14px rgba(11,28,58,.05);
           display:flex;flex-direction:column;justify-content:center}
    .stile.hl{background:$NAVY;border-color:$NAVY}
    .snum{font-family:'Cormorant Garamond',serif;font-size:74px;font-weight:600;color:$NAVY;
          line-height:1;letter-spacing:-.02em;margin-bottom:18px}
    .stile.hl .snum{color:$GOLD}
    .slab{font-size:17.5px;font-weight:600;color:rgba(11,28,58,.85);line-height:1.32}
    .stile.hl .slab{color:rgba(250,247,242,.92)}
    .snote{font-size:14.5px;color:rgba(11,28,58,.5);line-height:1.42;margin-top:9px}
    .stile.hl .snote{color:rgba(250,247,242,.55)}
    """).replace("NCOL", str(len(s["tiles"])))
    return css, f'<div class="stats">{tiles}</div>'


def card_split(s):
    """Two-option decision. sides: [{head, sub, points:[str]}]"""
    sides = ""
    for i, sd in enumerate(s["sides"]):
        pts = "".join(f"<li>{_shell(p)}</li>" for p in sd["points"])
        acc = " acc" if i == s.get("accent") else ""
        sides += (
            f'<div class="side{acc}"><div class="shead">{_shell(sd["head"])}</div>'
            f'<div class="ssub">{_shell(sd["sub"])}</div><ul>{pts}</ul></div>'
        )
    css = brand("""
    .split{display:grid;grid-template-columns:1fr 62px 1fr;align-items:stretch;gap:0}
    .side{background:#fff;border:1px solid rgba(11,28,58,.13);border-radius:13px;padding:36px 34px;min-height:340px;
          box-shadow:0 2px 14px rgba(11,28,58,.05);
          display:flex;flex-direction:column;justify-content:center}
    .side.acc{background:$NAVY;border-color:$NAVY}
    .shead{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:600;color:$NAVY;line-height:1.1}
    .side.acc .shead{color:$GOLD}
    .ssub{font-size:15px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
          color:$GOLD;margin:9px 0 18px}
    .side.acc .ssub{color:rgba(250,247,242,.6)}
    .side ul{list-style:none}
    .side li{font-size:17px;color:rgba(11,28,58,.78);line-height:1.42;margin-bottom:12px;
             padding-left:24px;position:relative}
    .side.acc li{color:rgba(250,247,242,.85)}
    .side li::before{content:'';position:absolute;left:0;top:9px;width:9px;height:9px;border-radius:50%;
                     background:$GOLD}
    .vs{display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;
        font-size:27px;font-weight:600;color:rgba(11,28,58,.35)}
    """)
    inner = sides.replace(
        '</div><div class="side', '</div><div class="vs">vs</div><div class="side', 1
    )
    return css, f'<div class="split">{inner}</div>'


def card_hero(s):
    """Navy hero banner for articles missing one."""
    sub = f'<div class="hsub">{_shell(s["sub"])}</div>' if s.get("sub") else ""
    chips = ""
    if s.get("chips"):
        chips = '<div class="chips">' + "".join(
            f'<span class="chip">{_shell(c)}</span>' for c in s["chips"]
        ) + "</div>"
    css = brand("""
    body{background:$NAVY;color:$CREAM}
    .card{padding:0}
    .card::after{background:radial-gradient(circle at 100% 0%,rgba(196,151,59,.3),rgba(196,151,59,0) 70%);
                 width:520px;height:520px}
    .hero{width:100%;height:100%;padding:78px 86px;display:flex;flex-direction:column;justify-content:center;
          position:relative;z-index:2}
    .hk{font-size:16px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:$GOLD;
        margin-bottom:24px}
    .htitle{font-family:'Cormorant Garamond',Georgia,serif;font-size:74px;line-height:1.05;font-weight:600;
            letter-spacing:-.02em;color:$CREAM;max-width:1020px}
    .hrule{width:96px;height:4px;background:$GOLD;border-radius:2px;margin:30px 0 26px}
    .hsub{font-size:23px;line-height:1.5;color:rgba(250,247,242,.66);max-width:880px;font-weight:400}
    .chips{display:flex;gap:13px;margin-top:34px;flex-wrap:wrap}
    .chip{font-size:15.5px;font-weight:600;letter-spacing:.03em;color:rgba(250,247,242,.85);
          border:1px solid rgba(196,151,59,.45);background:rgba(196,151,59,.11);
          padding:9px 18px;border-radius:100px}
    .hmark{position:absolute;right:86px;bottom:64px;font-family:'Cormorant Garamond',serif;font-size:23px;
           font-weight:600;color:rgba(250,247,242,.5);z-index:3}
    .hmark .dot{color:$GOLD}
    /* faint skyline */
    .sky{position:absolute;left:0;right:0;bottom:0;height:190px;opacity:.13;z-index:1}
    """)
    sky = (
        '<svg class="sky" viewBox="0 0 1344 190" preserveAspectRatio="none">'
        '<g fill="#C4973B">'
        '<rect x="60" y="86" width="88" height="104"/><rect x="164" y="52" width="66" height="138"/>'
        '<rect x="246" y="104" width="104" height="86"/><rect x="366" y="30" width="74" height="160"/>'
        '<rect x="456" y="94" width="92" height="96"/><rect x="564" y="64" width="60" height="126"/>'
        '<rect x="640" y="112" width="118" height="78"/><rect x="774" y="44" width="70" height="146"/>'
        '<rect x="860" y="98" width="96" height="92"/><rect x="972" y="72" width="64" height="118"/>'
        '<rect x="1052" y="118" width="110" height="72"/><rect x="1178" y="58" width="78" height="132"/>'
        "</g></svg>"
    )
    inner = (
        f'{sky}<div class="hero"><div class="hk">{_shell(s.get("kicker","Nexus Mortgage SG"))}</div>'
        f'<div class="htitle">{_shell(s["title"])}</div><div class="hrule"></div>{sub}{chips}</div>'
        f'<div class="hmark">nexusmortgage<span class="dot">.</span>sg</div>'
    )
    return css, inner


TEMPLATES = {
    "ladder": card_ladder,
    "compare": card_compare,
    "timeline": card_timeline,
    "math": card_math,
    "stat": card_stat,
    "split": card_split,
    "hero": card_hero,
}


def build_html(spec):
    css, inner = TEMPLATES[spec["type"]](spec)
    if spec["type"] == "hero":
        return (
            f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<style>{BASE_CSS}{css}</style></head><body><div class='card'>{inner}</div></body></html>"
        )
    kicker = f'<div class="kicker">{_shell(spec["kicker"])}</div>' if spec.get("kicker") else ""
    src = f'<div class="src">{_shell(spec["source"])}</div>' if spec.get("source") else "<div class='src'></div>"
    return (
        f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{BASE_CSS}{css}</style></head><body><div class='card'>"
        f'<div class="head">{kicker}<div class="title">{_shell(spec["title"])}</div>'
        f'<div class="rule"></div></div>'
        f'<div class="body">{inner}</div>'
        f'<div class="foot">{src}<div class="mark">nexusmortgage<span class="dot">.</span>sg</div></div>'
        f"</div></body></html>"
    )


def render(specs, port):
    tmp = ROOT / ".imgtmp"
    tmp.mkdir(exist_ok=True)
    made = []
    for spec in specs:
        name = spec["out"]
        (tmp / f"{name}.html").write_text(build_html(spec), encoding="utf-8")
        raw = tmp / f"{name}.raw.png"
        cmd = [
            CHROME, "--headless", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox",
            "--hide-scrollbars", "--virtual-time-budget=3000",
            f"--force-device-scale-factor={SCALE}",
            f"--window-size={W},{H}", f"--screenshot={raw}",
            f"http://localhost:{port}/.imgtmp/{name}.html",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if not raw.exists():
            print(f"  FAIL {name}: {r.stderr[-300:]}")
            continue
        im = Image.open(raw).convert("RGB")
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        im.save(OUT / f"{name}.png", "PNG", optimize=True)
        im.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
        made.append(name)
        print(f"  ok   {name}.webp  ({(OUT / f'{name}.webp').stat().st_size // 1024} KB)")
    shutil.rmtree(tmp, ignore_errors=True)
    return made


def main():
    specs = json.loads(SPECS.read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        pat = sys.argv[1]
        specs = [s for s in specs if pat in s["out"] or pat in s.get("slug", "")]
    if not specs:
        print("no specs matched")
        return
    port = int(os.environ.get("PORT", "3311"))
    srv = subprocess.Popen(
        ["node", str(ROOT / "serve.mjs")],
        cwd=ROOT, env={**os.environ, "PORT": str(port)},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        import time
        time.sleep(1.5)
        print(f"rendering {len(specs)} card(s) -> blog/blog-images/")
        made = render(specs, port)
        print(f"done: {len(made)}/{len(specs)}")
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
