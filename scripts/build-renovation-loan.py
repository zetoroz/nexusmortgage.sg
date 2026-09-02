#!/usr/bin/env python3
"""Build services/renovation-loan/ by cloning the refinancing service page.

Same approach as scripts/new-article.py: clone a live page so head, analytics,
nav, footer and styling are inherited, then swap head metadata, the four
JSON-LD blocks, and the <main> body.

Rates: the equity-loan comparison uses the site's own live SORA feed rather
than hardcoded numbers. Renovation-loan rates are given as an indicative,
dated market band, not per-bank quotes, because they move and we do not
publish a reno rate sheet.
"""
import json, pathlib, re

ROOT = pathlib.Path("/mnt/media/ler/Work/04-web-design/Nexus Mortgage")
SRC = ROOT / "services/refinancing/index.html"
DST = ROOT / "services/renovation-loan/index.html"
URL = "https://nexusmortgage.sg/services/renovation-loan/"

feed = json.loads((ROOT / "sora-feed.json").read_text())
sora3m = feed["sora"]["compounded_3m_pct"]
spread = feed["typicalSpreadPct"]
asof = feed["asOfSora"]
eff = round(sora3m + spread, 2)
MONTHS = ["January","February","March","April","May","June","July","August",
          "September","October","November","December"]
y, m, d = asof.split("-")
asof_human = f"{int(d)} {MONTHS[int(m)-1]} {y}"

h = SRC.read_text(encoding="utf-8")

# ---- head metadata -----------------------------------------------------
TITLE = "Renovation Loan Singapore: The S$30,000 Cap Explained | Nexus"
DESC = (f"Singapore renovation loans are capped at S$30,000 or 6x monthly income. "
        f"Compare reno loan EIR against an equity term loan from ~{eff}% p.a. "
        f"Independent broker, no fee.")
swaps = [
 (r"<title>.*?</title>", f"<title>{TITLE}</title>"),
 (r'<meta name="description" content="[^"]*">',
  f'<meta name="description" content="{DESC}">'),
 (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{URL}">'),
 (r'<meta property="og:title" content="[^"]*">',
  '<meta property="og:title" content="Renovation Loan Singapore: What You Can Actually Borrow (2026)">'),
 (r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{URL}">'),
 (r'<meta property="og:description" content="[^"]*">',
  f'<meta property="og:description" content="{DESC}">'),
 (r'<meta name="keywords" content="[^"]*">',
  '<meta name="keywords" content="renovation loan Singapore, reno loan, reno loan '
  'interest rate, HDB renovation loan, renovation loan EIR, S$30000 renovation cap, '
  'equity term loan renovation">'),
]
for pat, rep in swaps:
    h2 = re.sub(pat, lambda _m: rep, h, count=1, flags=re.S)
    if h2 == h:
        print(f"  [warn] no match: {pat[:50]}")
    h = h2

# ---- JSON-LD blocks ----------------------------------------------------
blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
assert len(blocks) == 4, f"expected 4 ld+json blocks, got {len(blocks)}"

# block 0: WebPage/WebSite/MortgageBroker. Retarget the WebPage node only.
b0 = json.loads(blocks[0])
def retarget(node):
    if isinstance(node, dict):
        if node.get("@type") == "WebPage":
            node["@id"] = URL + "#webpage"
            node["url"] = URL
            node["name"] = "Renovation Loan Singapore"
            node["description"] = DESC
        for v in node.values(): retarget(v)
    elif isinstance(node, list):
        for v in node: retarget(v)
retarget(b0)

b1 = {
 "@context": "https://schema.org", "@type": "Service",
 "@id": URL + "#service", "url": URL,
 "name": "Renovation Loan Advisory",
 "serviceType": "Renovation financing and equity-funded renovation",
 "description": ("Independent comparison of Singapore renovation loans against "
                 "equity term loans and cash-out refinancing, covering the S$30,000 "
                 "regulatory cap, flat rate versus effective interest rate, and the "
                 "quantum at which secured borrowing becomes cheaper."),
 "provider": {"@type": "MortgageBroker", "@id": "https://nexusmortgage.sg/#organization",
              "name": "Nexus Mortgage", "url": "https://nexusmortgage.sg/"},
 "areaServed": {"@type": "Country", "name": "Singapore"},
 "audience": {"@type": "Audience",
              "audienceType": "Singapore home owners renovating an HDB flat, condo or landed property"},
 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "SGD",
            "description": "Zero broker fee. Banks pay our referral.", "url": URL},
}

b2 = {
 "@context": "https://schema.org", "@type": "BreadcrumbList",
 "itemListElement": [
   {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://nexusmortgage.sg/"},
   {"@type": "ListItem", "position": 2, "name": "Services", "item": "https://nexusmortgage.sg/services/"},
   {"@type": "ListItem", "position": 3, "name": "Renovation Loan", "item": URL},
 ]}

FAQ = [
 ("How much can I borrow with a renovation loan in Singapore?",
  "Singapore renovation loans are capped at the lower of six times your monthly income or "
  "S$30,000. That ceiling applies across banks and is not negotiable. If your renovation "
  "budget exceeds S$30,000, the shortfall has to come from cash, a personal loan, or "
  "secured borrowing against the property such as an equity term loan or cash-out refinancing."),
 ("Is the advertised renovation loan rate the rate I actually pay?",
  "No. Banks advertise a flat rate, which is calculated on the original principal for the "
  "whole tenure even though your balance falls every month. The figure that reflects what "
  "you actually pay is the effective interest rate, or EIR, and it is usually close to "
  "double the flat rate. Always compare renovation loans on EIR, never on the headline "
  "flat rate."),
 ("Can I use a renovation loan to buy furniture or appliances?",
  "Generally no. Renovation loan funds are disbursed by cashier's order made out to your "
  "contractor or interior designer, not to you, and banks require quotations and invoices "
  "tied to structural and fitting works. Loose furniture, appliances and soft furnishings "
  "normally fall outside the permitted scope."),
 ("Does HDB provide a renovation loan?",
  "No. HDB lends for the purchase of a flat through the HDB concessionary loan, but it does "
  "not offer renovation financing. Every renovation loan in Singapore is a bank product, "
  "available for HDB flats, executive condominiums, private condominiums and landed homes alike."),
 (f"When is an equity term loan cheaper than a renovation loan?",
  f"Once the amount is large enough for the secured rate to outweigh the fixed setup costs. "
  f"A renovation loan typically carries an EIR in the mid single digits to around nine per "
  f"cent, while an equity term loan against your property prices off the mortgage market, "
  f"currently around {eff}% per annum based on 3-month Compounded SORA at {sora3m}% as of "
  f"{asof_human} plus a typical {spread}% spread. An equity loan carries legal and valuation "
  f"costs of roughly S$2,500 to S$3,500, so on S$30,000 the renovation loan usually still "
  f"wins on simplicity. Past roughly S$80,000 to S$100,000 the secured route is normally "
  f"materially cheaper over the full tenure."),
]
b3 = {"@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": [{"@type": "Question", "name": q,
                      "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}

new_blocks = [json.dumps(b0, ensure_ascii=False), json.dumps(b1, ensure_ascii=False),
              json.dumps(b2, ensure_ascii=False), json.dumps(b3, ensure_ascii=False)]
i = [0]
def sub_block(mo):
    out = f'<script type="application/ld+json">{new_blocks[i[0]]}</script>'
    i[0] += 1
    return out
h = re.sub(r'<script type="application/ld\+json">.*?</script>', sub_block, h, flags=re.S)
assert i[0] == 4

# ---- <main> body -------------------------------------------------------
HERO_SVG = re.search(r'<svg class="hero-deco-rings".*?</svg>', h, re.S).group(0)

def faq_html(items):
    out = []
    for q, a in items:
        out.append(f'        <h3 class="reveal">{q}</h3>\n        <p>{a}</p>')
    return "\n".join(out)

MAIN = f'''<main id="main">
    <section class="page-hero">
      {HERO_SVG}

      <div class="container-narrow">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span class="breadcrumb-sep" aria-hidden="true">/</span>
          <a href="/services/">Services</a>
          <span class="breadcrumb-sep" aria-hidden="true">/</span>
          <span aria-current="page">Renovation Loan</span>
        </nav>
        <h1 class="page-title">Renovation Loan Singapore: what you can <em>actually</em> borrow</h1>
        <p class="lede">
          Every Singapore renovation loan stops at S$30,000, or six times your monthly income,
          whichever is lower. Most renovation budgets do not. This page covers the cap, the gap
          between the advertised rate and what you really pay, and the point at which borrowing
          against your property becomes the cheaper answer.
        </p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.75rem;">
          <a href="https://wa.me/6587520859?text=Hi%2C+I%27d+like+help+financing+a+renovation." target="_blank" rel="noopener" class="btn-gold">Get My Renovation Quote &rarr;</a>
          <a href="/equity-loan/" class="btn-ghost">Compare Equity Loan</a>
        </div>

        <div class="keyfacts" role="list">
          <div role="listitem">
            <div class="lbl">Maximum quantum</div>
            <div class="val">S$30K</div>
            <div class="sub">Or 6x monthly income, whichever is lower. Applies at every bank.</div>
          </div>
          <div role="listitem">
            <div class="lbl">Tenure</div>
            <div class="val">1&ndash;5 yr</div>
            <div class="sub">Five years is the standard maximum for renovation financing.</div>
          </div>
          <div role="listitem">
            <div class="lbl">Compare on</div>
            <div class="val">EIR</div>
            <div class="sub">Not the flat rate. EIR is usually close to double the advertised figure.</div>
          </div>
          <div role="listitem">
            <div class="lbl">Equity loan from</div>
            <div class="val">~{eff}%</div>
            <div class="sub">3M Compounded SORA {sora3m}% as of {asof_human}, plus typical {spread}% spread.</div>
          </div>
        </div>
      </div>
    </section>

    <section class="content-section cream">
      <div class="container-prose prose">

        <p class="reveal" style="font-size:1.08rem;">
          A renovation loan is the most misunderstood product in Singapore home financing. It is
          not a mortgage, it is not secured against your property, and it is far smaller than most
          people expect. Understanding those three facts before you sign a contractor's quotation
          will save you more than shopping for a slightly lower rate ever will.
        </p>

        <h2 class="reveal">The S$30,000 ceiling is the whole story</h2>
        <p>
          Whatever the marketing says, a Singapore renovation loan is capped at
          <strong>the lower of six times your monthly income or S$30,000</strong>. Someone earning
          S$4,000 a month is capped at S$24,000, not S$30,000. The ceiling is uniform across banks,
          so there is no lender to shop for a bigger number from.
        </p>
        <p>
          For context, a full renovation of a four-room HDB flat commonly lands somewhere between
          S$45,000 and S$70,000, and a condominium fit-out routinely runs past S$100,000. The
          renovation loan is therefore rarely the whole answer. It is the cheap first tranche, and
          the question that actually matters is how you fund the balance.
        </p>

        <h2 class="reveal">Flat rate versus EIR: the number banks lead with is <em>not</em> the number you pay</h2>
        <p>
          Renovation loans are advertised at a <strong>flat rate</strong>, charged on the full
          original principal for the entire tenure even though you are repaying the balance down
          every month. The figure that reflects your real cost is the
          <strong>effective interest rate</strong>, and it typically works out close to
          <strong>double</strong> the advertised flat rate.
        </p>
        <p>
          A loan advertised at a low-single-digit flat rate can carry an EIR in the mid single
          digits or higher once the maths is done properly. Two banks quoting the same flat rate
          can also differ on processing fee, commonly around one per cent of the approved amount,
          and on insurance requirements. Ask every lender for the EIR in writing and compare only
          that.
        </p>

        <h2 class="reveal">What the money can and cannot be spent on</h2>
        <p>
          Renovation loan funds are not paid to you. They are disbursed by
          <strong>cashier's order made out to your contractor or interior designer</strong>,
          against quotations and invoices. Banks expect the spend to be structural and fixed:
          rewiring, plumbing, flooring, carpentry, tiling, painting, built-in fittings.
        </p>
        <p>
          Loose furniture, appliances, curtains and soft furnishings generally fall outside the
          permitted scope. That distinction catches people out late, when the budget is already
          committed, so it is worth sorting at quotation stage rather than at drawdown.
        </p>

        <h2 class="reveal">Where the crossover sits: renovation loan or equity</h2>
        <p>
          This is the decision worth getting right. A renovation loan is unsecured, so it is priced
          for unsecured risk. An <a href="/equity-loan/">equity term loan</a> is secured against
          your property, so it prices off the mortgage market instead. As of
          <strong>{asof_human}</strong>, 3-month Compounded SORA sits at <strong>{sora3m}%</strong>,
          which with a typical <strong>{spread}%</strong> spread puts secured borrowing around
          <strong>{eff}% per annum</strong>. That is a different order of cost from unsecured
          renovation financing.
        </p>
        <p>
          It does not follow that equity always wins. An equity term loan carries legal and
          valuation costs of roughly <strong>S$2,500 to S$3,500</strong>, and those are fixed
          regardless of how much you draw. On a S$30,000 renovation the setup cost eats the rate
          advantage, and the renovation loan is usually the cleaner choice. Once the requirement
          runs past roughly <strong>S$80,000 to S$100,000</strong>, the secured route is normally
          materially cheaper across the full tenure, and it stretches repayment over the remaining
          mortgage term rather than compressing it into five years.
        </p>
        <p>
          There is a middle case too. Many owners take the S$30,000 renovation loan for the fixed
          works and fund the balance through
          <a href="/services/refinancing/">cash-out refinancing</a> at the point their lock-in
          expires, which folds the renovation into a loan they were going to reprice anyway. If
          your lock-in ends within the next year, that timing is worth planning around.
        </p>

        <h2 class="reveal">Bank renovation loans in Singapore</h2>
        <p>
          Renovation loans are offered by <strong>DBS and POSB, OCBC, UOB, Maybank, CIMB,
          Standard Chartered</strong> and <strong>Hong Leong Finance</strong>, among others. The
          products are structurally similar because the S$30,000 cap and the disbursement rules
          are common to all of them. They differ on flat rate, processing fee, whether a fire
          insurance or credit-life policy is bundled, and how quickly they will disburse against a
          contractor's progress claims.
        </p>
        <p>
          Because the rates move and the promotional tiers change, we do not publish a renovation
          rate sheet. We quote live across lenders when you ask. For current mortgage benchmarks,
          which drive the equity comparison above, see our
          <a href="/sora-rates-singapore/">SORA rate tracker</a> and
          <a href="/mortgage-rates/">current mortgage rates</a>.
        </p>

        <h2 class="reveal">HDB does not lend for renovation</h2>
        <p>
          A common misconception. HDB provides the concessionary loan for
          <em>buying</em> a flat, and nothing for renovating one. Every renovation loan in
          Singapore is a bank product, and the same S$30,000 cap applies whether you are
          renovating an HDB flat, an executive condominium, a private condominium or a landed home.
          If you are buying and renovating at once, sequence the mortgage first, because the
          renovation loan sits on your unsecured credit and can affect how the mortgage is assessed.
        </p>

        <h2 class="reveal">Frequently asked questions</h2>
{faq_html(FAQ)}

        <h2 class="reveal">Work out the cheapest route before you sign the quotation</h2>
        <p>
          Send us your renovation budget and your current mortgage details. We will show you the
          renovation loan quantum you qualify for, the EIR across lenders, and the equity or
          cash-out alternative side by side, so the comparison is on total cost rather than
          headline rate. There is no broker fee. Banks pay our referral on disbursement.
        </p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem;">
          <a href="https://wa.me/6587520859?text=Hi%2C+I%27d+like+help+financing+a+renovation." target="_blank" rel="noopener" class="btn-gold">WhatsApp Dan &rarr;</a>
          <a href="/contact/" class="btn-ghost">Contact Form</a>
        </div>

      </div>
    </section>
  </main>'''

start = h.index("<main id=\"main\">")
end = h.index("</main>") + len("</main>")
h = h[:start] + MAIN + h[end:]

DST.parent.mkdir(parents=True, exist_ok=True)
DST.write_text(h, encoding="utf-8")
print(f"wrote {DST.relative_to(ROOT)}  ({len(h):,} bytes)")
print(f"equity comparison uses live feed: 3M SORA {sora3m}% + {spread}% = {eff}% as of {asof_human}")
