#!/usr/bin/env python3
"""Insert a curated 'Further reading' block into blog posts that lack one.

Link targets are chosen to route internal authority into pages that GSC shows
stuck on page 2 (pos 11-21) or sitting orphaned with zero editorial inbound links.
Idempotent: skips any page that already has a further-reading block.
"""
import re, sys, glob, os

DRY = "--apply" not in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# slug -> (anchor text, short factual blurb)
T = {
 "decoupling-private-property-singapore": ("Decoupling property in Singapore: cost, process and tax", "BSD on the share bought over, CPF refund with accrued interest, and the TDSR check on the receiving spouse"),
 "avoid-absd-second-property-singapore": ("How to avoid ABSD on a second property &mdash; real case study", "the legal route, the IRAS 99-1 line, and when decoupling does and does not work"),
 "joint-tenancy-vs-tenancy-in-common-singapore-2026": ("Joint tenancy vs tenancy-in-common", "how the ownership structure you pick at purchase changes your options later"),
 "cpf-oa-hdb-guide": ("How much CPF OA you can use for housing", "Valuation Limit, the 120% Withdrawal Limit and the BRS set-aside after 55"),
 "cpf-accrued-interest-property-sale-2026": ("CPF accrued interest when you sell", "what has to go back to your OA and how it shrinks your cash proceeds"),
 "tdsr-msr-explained": ("TDSR and MSR explained", "the 55% and 30% ceilings and how the MAS stress floor is applied"),
 "mas-stress-test-2026": ("The MAS stress test in 2026", "the floor rate banks use to size your loan, not the rate you actually pay"),
 "self-employed-tdsr-singapore": ("TDSR when you are self-employed", "how variable income is haircut and what documents change the outcome"),
 "when-to-refinance-singapore": ("When to refinance your home loan", "lock-in expiry, notice periods and the break-cost math"),
 "reprice-vs-refinance-singapore": ("Repricing vs refinancing", "staying with your bank versus moving, and when each one wins"),
 "refinance-hdb-loan-to-bank-loan-2026": ("Switching an HDB loan to a bank loan", "the one-way door, and the LTV and tenure rules that apply"),
 "home-loan-rates-singapore": ("Current Singapore home loan rates", "fixed and floating packages compared across banks"),
 "fixed-vs-floating-home-loan-singapore": ("Fixed vs floating home loans", "how to choose when the rate outlook is uncertain"),
 "fdr-fhr-dmr-home-loan-pegs-singapore": ("FDR, FHR and DMR pegs explained", "board-rate pegs and why they behave differently from SORA"),
 "singapore-mortgage-rate-outlook-2026": ("Singapore mortgage rate outlook", "where rates are heading and what it means for your next repricing"),
 "hdb-vs-bank-loan": ("HDB loan vs bank loan", "the LTV, tenure and rate trade-offs between the two"),
 "first-time-hdb-buyer-guide": ("First-time HDB buyer guide", "the full path from grant eligibility to key collection"),
 "hdb-to-condo-upgrade-singapore": ("Upgrading from HDB to a condo", "sequencing the sale and purchase without triggering ABSD"),
 "singapore-pr-buy-hdb-loan-guide-2026": ("PR buying an HDB flat", "eligibility, the three-year rule and loan options"),
 "foreigner-pr-private-property-singapore": ("Foreigners and PRs buying private property", "ABSD rates, eligibility and financing"),
 "ec-mop-2026-changes": ("Executive Condo MOP rules", "what the minimum occupation period allows once it ends"),
 "ssd-singapore-2025-reset": ("Seller's Stamp Duty and the holding-period reset", "when the SSD clock restarts and what it costs"),
 "stamp-duty-singapore-guide-2026": ("Singapore stamp duty guide", "BSD, ABSD and SSD in one place, with worked figures"),
 "cash-out-refinance-singapore-2026": ("Cash-out refinancing explained", "borrowing against equity you already own, and the CPF charge that reduces it"),
 "caveat-loan-singapore": ("Caveat loans in Singapore", "short-term property-backed financing and when it is appropriate"),
 "bridging-loan-singapore-2026": ("Bridging loans", "covering the gap between selling one property and completing the next"),
 "commercial-property-loan-singapore-2026": ("Commercial property loans", "LTV, tenure and how commercial lending differs from residential"),
 "how-to-apply-home-loan-singapore": ("How to apply for a home loan", "documents, IPA and the order the steps actually happen in"),
 "best-home-loan-first-time-buyer": ("Best home loan for a first-time buyer", "what to compare beyond the headline rate"),
 "million-dollar-hdb-flats-2026": ("Million-dollar HDB flats", "what the price trend means for financing and valuation"),
 "hdb-resale-above-income-ceiling-2026": ("Buying resale above the income ceiling", "options when you exceed the grant and HDB-loan limits"),
 "hdb-resale-q1-2026-mortgage": ("HDB resale market and your mortgage", "how resale pricing feeds into valuation and cash-over-valuation"),
 "new-launch-financing-singapore": ("Financing a new launch", "progressive payments and how drawdown changes your instalments"),
 "ipa-mortgage-broker-singapore": ("Getting an IPA before you commit", "why in-principle approval comes before the option fee"),
}
ROOTPAGES = {
 "/mortgage-rates/": ("Compare current mortgage rates", "live fixed and floating packages across 16 banks"),
 "/sora-rates-singapore/": ("Live SORA rate today", "the 1M and 3M compounded SORA feed that prices floating packages"),
 "/equity-loan/": ("Cash-out and equity loans", "up to 75% LTV with a mortgage, 55% fully paid, higher on commercial"),
 "/affordability/": ("Affordability check", "what you can borrow at the MAS stress floor"),
 "/free-report/": ("Free Singapore mortgage report", "Dan's full written breakdown with a 16-bank comparison"),
 "/calculators/": ("Mortgage calculators", "affordability, repayment, refinance savings and cash-out tools"),
}

# source slug -> ordered target list (blog slugs, or /root/ paths)
M = {
 "avoid-absd-second-property-singapore": ["decoupling-private-property-singapore","joint-tenancy-vs-tenancy-in-common-singapore-2026","ssd-singapore-2025-reset","stamp-duty-singapore-guide-2026","/free-report/"],
 "joint-tenancy-vs-tenancy-in-common-singapore-2026": ["decoupling-private-property-singapore","avoid-absd-second-property-singapore","stamp-duty-singapore-guide-2026","cpf-accrued-interest-property-sale-2026","/free-report/"],
 "ssd-singapore-2025-reset": ["avoid-absd-second-property-singapore","decoupling-private-property-singapore","stamp-duty-singapore-guide-2026","joint-tenancy-vs-tenancy-in-common-singapore-2026","/mortgage-rates/"],
 "stamp-duty-singapore-guide-2026": ["avoid-absd-second-property-singapore","decoupling-private-property-singapore","ssd-singapore-2025-reset","joint-tenancy-vs-tenancy-in-common-singapore-2026","/calculators/"],
 "ec-mop-2026-changes": ["decoupling-private-property-singapore","avoid-absd-second-property-singapore","hdb-to-condo-upgrade-singapore","tdsr-msr-explained","/free-report/"],
 "cpf-accrued-interest-property-sale-2026": ["cpf-oa-hdb-guide","decoupling-private-property-singapore","cash-out-refinance-singapore-2026","joint-tenancy-vs-tenancy-in-common-singapore-2026","/calculators/"],
 "when-to-refinance-singapore": ["reprice-vs-refinance-singapore","refinance-hdb-loan-to-bank-loan-2026","fixed-vs-floating-home-loan-singapore","singapore-mortgage-rate-outlook-2026","/sora-rates-singapore/","/mortgage-rates/"],
 "reprice-vs-refinance-singapore": ["when-to-refinance-singapore","refinance-hdb-loan-to-bank-loan-2026","fdr-fhr-dmr-home-loan-pegs-singapore","singapore-mortgage-rate-outlook-2026","/sora-rates-singapore/"],
 "refinance-hdb-loan-to-bank-loan-2026": ["hdb-vs-bank-loan","when-to-refinance-singapore","reprice-vs-refinance-singapore","cpf-oa-hdb-guide","/mortgage-rates/"],
 "fixed-vs-floating-home-loan-singapore": ["fdr-fhr-dmr-home-loan-pegs-singapore","singapore-mortgage-rate-outlook-2026","when-to-refinance-singapore","mas-stress-test-2026","/sora-rates-singapore/"],
 "fdr-fhr-dmr-home-loan-pegs-singapore": ["fixed-vs-floating-home-loan-singapore","singapore-mortgage-rate-outlook-2026","reprice-vs-refinance-singapore","home-loan-rates-singapore","/sora-rates-singapore/"],
 "singapore-mortgage-rate-outlook-2026": ["fixed-vs-floating-home-loan-singapore","when-to-refinance-singapore","fdr-fhr-dmr-home-loan-pegs-singapore","reprice-vs-refinance-singapore","/sora-rates-singapore/","/mortgage-rates/"],
 "mas-stress-test-2026": ["tdsr-msr-explained","self-employed-tdsr-singapore","how-to-apply-home-loan-singapore","fixed-vs-floating-home-loan-singapore","/affordability/"],
 "how-to-apply-home-loan-singapore": ["ipa-mortgage-broker-singapore","tdsr-msr-explained","mas-stress-test-2026","best-home-loan-first-time-buyer","/affordability/"],
 "hdb-vs-bank-loan": ["refinance-hdb-loan-to-bank-loan-2026","cpf-oa-hdb-guide","first-time-hdb-buyer-guide","tdsr-msr-explained","/mortgage-rates/"],
 "first-time-hdb-buyer-guide": ["hdb-vs-bank-loan","cpf-oa-hdb-guide","hdb-resale-q1-2026-mortgage","how-to-apply-home-loan-singapore","/affordability/"],
 "hdb-resale-q1-2026-mortgage": ["hdb-resale-above-income-ceiling-2026","million-dollar-hdb-flats-2026","cpf-oa-hdb-guide","hdb-vs-bank-loan","/mortgage-rates/"],
 "hdb-resale-above-income-ceiling-2026": ["hdb-resale-q1-2026-mortgage","hdb-vs-bank-loan","cpf-oa-hdb-guide","million-dollar-hdb-flats-2026","/affordability/"],
 "million-dollar-hdb-flats-2026": ["hdb-resale-q1-2026-mortgage","hdb-to-condo-upgrade-singapore","cpf-oa-hdb-guide","hdb-resale-above-income-ceiling-2026","/affordability/"],
 "hdb-to-condo-upgrade-singapore": ["avoid-absd-second-property-singapore","decoupling-private-property-singapore","ssd-singapore-2025-reset","cpf-accrued-interest-property-sale-2026","/free-report/"],
 "singapore-pr-buy-hdb-loan-guide-2026": ["foreigner-pr-private-property-singapore","hdb-vs-bank-loan","cpf-oa-hdb-guide","first-time-hdb-buyer-guide","/mortgage-rates/"],
 "foreigner-pr-private-property-singapore": ["singapore-pr-buy-hdb-loan-guide-2026","avoid-absd-second-property-singapore","stamp-duty-singapore-guide-2026","tdsr-msr-explained","/mortgage-rates/"],
 "cash-out-refinance-singapore-2026": ["cpf-accrued-interest-property-sale-2026","caveat-loan-singapore","bridging-loan-singapore-2026","tdsr-msr-explained","/equity-loan/"],
 "caveat-loan-singapore": ["bridging-loan-singapore-2026","cash-out-refinance-singapore-2026","commercial-property-loan-singapore-2026","tdsr-msr-explained","/equity-loan/"],
 "bridging-loan-singapore-2026": ["caveat-loan-singapore","cash-out-refinance-singapore-2026","hdb-to-condo-upgrade-singapore","ssd-singapore-2025-reset","/equity-loan/"],
 "commercial-property-loan-singapore-2026": ["cash-out-refinance-singapore-2026","caveat-loan-singapore","bridging-loan-singapore-2026","tdsr-msr-explained","/equity-loan/"],
 "dunearn-house-financing-2026": ["new-launch-financing-singapore","tdsr-msr-explained","mas-stress-test-2026","fixed-vs-floating-home-loan-singapore","/mortgage-rates/"],
 "thomson-reserve-financing-2026": ["new-launch-financing-singapore","tdsr-msr-explained","mas-stress-test-2026","fixed-vs-floating-home-loan-singapore","/mortgage-rates/"],
 "lentor-gardens-residences-financing-2026": ["new-launch-financing-singapore","tdsr-msr-explained","mas-stress-test-2026","fixed-vs-floating-home-loan-singapore","/mortgage-rates/"],
 "hudson-place-residences-financing-2026": ["new-launch-financing-singapore","tdsr-msr-explained","mas-stress-test-2026","fixed-vs-floating-home-loan-singapore","/mortgage-rates/"],
}

HAS = re.compile(r'further reading|related (guides?|reading|articles?)|you may also', re.I)

def build(targets):
    li = []
    for t in targets:
        if t.startswith("/"):
            if t not in ROOTPAGES: raise KeyError(t)
            a, b = ROOTPAGES[t]; href = t
        else:
            if t not in T: raise KeyError(t)
            a, b = T[t]; href = "../%s/" % t
        li.append('            <li><a href="%s">%s</a> &mdash; %s</li>' % (href, a, b))
    return ('\n        <hr class="divider">\n\n'
            '        <h2 style="font-size:1.1rem; margin-bottom:1rem;">Further reading</h2>\n'
            '        <ul class="checklist" style="margin-bottom:2rem;">\n'
            + "\n".join(li) + '\n        </ul>\n\n')

changed = skipped = 0
for slug, targets in sorted(M.items()):
    p = "blog/%s/index.html" % slug
    if not os.path.exists(p):
        print("  MISSING FILE: %s" % p); continue
    h = open(p, encoding="utf-8").read()
    if HAS.search(h):
        skipped += 1; print("  skip (already has block): %s" % slug); continue
    end = h.rfind("</article>")
    if end == -1:
        print("  NO </article> ANCHOR: %s" % slug); continue
    # Place the block BEFORE the closing legal disclaimer, matching the
    # pattern already used on decoupling/cpf-oa/tdsr pages.
    tail = h[:end]
    i, where = end, "before </article>"
    for m in re.finditer(r'<(?:p|div)[^>]*>(?:(?!</(?:p|div)>).)*?'
                         r'(?:not (?:financial|constitute)|general information'
                         r'|does not constitute|informational purposes)',
                         tail, re.S | re.I):
        i, where = m.start(), "before disclaimer"
    # back up over an <hr> immediately preceding the disclaimer
    if where == "before disclaimer":
        hr = re.search(r'(?:<hr[^>]*>\s*)$', tail[:i])
        if hr: i = hr.start()
    block = build(targets)
    out = h[:i] + block + h[i:]
    print("  + %-52s %d links  (%s)" % (slug, len(targets), where))
    if not DRY:
        open(p, "w", encoding="utf-8").write(out)
    changed += 1

print("\n%s: %d pages would change, %d skipped" % ("DRY RUN" if DRY else "APPLIED", changed, skipped))
if DRY: print("re-run with --apply to write")
