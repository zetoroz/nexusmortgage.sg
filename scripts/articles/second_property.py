SLUG = "second-property-loan-ltv-singapore"
TITLE = "Second Property Loan Singapore: LTV, Cash &amp; TDSR (2026) | Nexus"
DESC = ("How much can you borrow on a second property in Singapore? LTV drops to 45%, the cash downpayment "
        "rises to 25%, and TDSR still applies at the 4% floor. The full 2026 numbers, with a worked example.")
OG_TITLE = "Second Property Loan in Singapore: What You Can Actually Borrow (2026)"
OG_DESC = ("A second housing loan is capped at 45% LTV with 25% of the price in hard cash, and drops to 25% LTV "
           "if the tenure runs past age 65. The MAS rules, the ABSD on top, and a full worked example.")
KEYWORDS = ("second property loan, 2nd property loan LTV, second property downpayment Singapore, "
            "buying second property Singapore, 2nd property loan Singapore, third property loan, "
            "second home loan LTV, ABSD second property")
SECTION = "MAS Regulation"
DATE_HUMAN = "10 August 2026"
DATE_ISO = "2026-08-10"
READ_TIME = "9-minute read"
WORDS = 2100
H1 = "Second Property Loan in Singapore: LTV, Cash and TDSR"
BREADCRUMB_NAME = "Second Property Loan"

FAQ = [
 ("How much can I borrow for a second property in Singapore?",
  "If you already have one outstanding housing loan, your second loan is capped at 45% of the property's price or valuation, whichever is lower. That drops to 25% if the loan tenure exceeds 30 years (25 years for an HDB flat) or if the tenure plus your current age extends past 65. Either way, at least 25% of the price must be paid in cash. This compares with 75% LTV and only 5% minimum cash on a first housing loan."),
 ("How much cash do I need for a second property?",
  "At least 25% of the purchase price or valuation, whichever is lower, in cash. CPF cannot be used for that portion. On a second loan at 45% LTV you therefore need 25% cash plus a further 30% from cash or CPF, making a 55% total downpayment. The cash requirement is the same 25% whether you fall in the 45% or the 25% LTV tier, and it also applies to a third or subsequent loan."),
 ("What is the LTV for a third property loan in Singapore?",
  "With two or more outstanding housing loans, the third loan is capped at 35% LTV, falling to 15% if the tenure exceeds 30 years (25 for HDB) or runs past age 65. The minimum cash portion stays at 25% of the price. At 15% LTV you would be funding 85% of the purchase yourself, which is why third-property purchases are usually done after clearing an existing loan."),
 ("Does TDSR apply to a second property loan?",
  "Yes. The 55% Total Debt Servicing Ratio cap applies to all property loans regardless of how many you own, and the instalments on your existing mortgage count towards it. The bank computes the new loan at a medium-term interest rate floor of 4% per annum for residential property, not at the rate you will actually pay, so the second loan qualifies for less than the live rate would suggest."),
 ("Does MSR apply when buying a second property?",
  "Only if the property you are buying is an HDB flat or an executive condominium whose minimum occupation period has not expired. MSR caps the housing instalment alone at 30% of gross monthly income. It does not apply to private property or to a post-MOP EC, so most second-property purchases are governed by TDSR alone."),
 ("Does a fully repaid housing loan still count against my LTV?",
  "No. MAS counts a loan as outstanding only where funds have been disbursed but not fully repaid, or have not yet been disbursed. A loan that has been fully repaid falls outside that definition, so a borrower who has cleared their first mortgage is assessed at first-loan limits. Banks verify the count through credit bureau and HDB checks."),
 ("Can I get first-loan LTV if I am selling my current property?",
  "Potentially. If you satisfy the bank before the new loan is disbursed that you have sold or will sell the existing property, you can be assessed at the first-loan LTV. The evidence required is documentary — typically a stamped sale and purchase agreement for the property being sold, an HDB letter approving the sale, or a signed HDB undertaking. Verbal intention is not enough."),
]

BODY = r'''
  <div class="short-answer">
    <div class="sa-title">Short answer</div>
    <p>With one outstanding housing loan, a second loan is capped at <strong>45% LTV</strong> and at least <strong>25% of the price must be cash</strong>. If the tenure exceeds 30 years (25 for HDB) or runs past age 65, that falls to <strong>25% LTV</strong>. A third loan is capped at 35%, or 15% on the same triggers. TDSR at 55% still applies, computed at the <strong>4% floor</strong>. ABSD sits on top: 20% for a Singapore Citizen buying a second residential property. A fully repaid loan does not count against you.</p>
  </div>

  <div class="toc">
    <div class="toc-title">In this article</div>
    <ol>
      <li><a href="#ltv">The LTV and cash limits</a></li>
      <li><a href="#trigger">The tenure and age trigger</a></li>
      <li><a href="#tdsr">TDSR, MSR and the 4% floor</a></li>
      <li><a href="#absd">ABSD on top</a></li>
      <li><a href="#worked">A worked example</a></li>
      <li><a href="#counts">What counts as an outstanding loan</a></li>
      <li><a href="#faq">FAQ</a></li>
    </ol>
  </div>

  <h2 id="ltv">The LTV and Cash Limits</h2>

  <p>The single biggest shock for second-property buyers is not the stamp duty. It is discovering that the bank will lend less than half the purchase price, and that a quarter of it has to be hard cash that CPF cannot touch.</p>

  <p>MAS sets the limits by <em>how many housing loans you already have outstanding</em>, not by how many properties you own.</p>

  <table>
    <thead>
      <tr><th>Outstanding housing loans</th><th>Max LTV</th><th>Minimum cash</th></tr>
    </thead>
    <tbody>
      <tr><td>None (first loan)</td><td>75%</td><td>5%</td></tr>
      <tr><td><strong>One (second loan)</strong></td><td><strong>45%</strong></td><td><strong>25%</strong></td></tr>
      <tr><td>Two or more (third+ loan)</td><td>35%</td><td>25%</td></tr>
    </tbody>
  </table>

  <p>So on a second loan you fund 55% of the purchase yourself: 25% in cash, and the remaining 30% from cash or CPF Ordinary Account. On a third, you fund 65%.</p>

  <p>The cash floor is the part that catches people out. On a first loan only 5% must be cash, and most buyers cover the rest from CPF. On a second loan the cash requirement is five times higher, and no amount of CPF balance substitutes for it.</p>

  <h2 id="trigger">The Tenure and Age Trigger</h2>

  <p>Each tier has a lower band, and the trigger is commonly misstated. It is not that you are over 65. It is that <strong>the loan matures after you turn 65</strong>, or that the tenure is unusually long.</p>

  <p>The reduced LTV applies where either of these is true:</p>

  <ul class="checklist">
    <li>Loan tenure exceeds <strong>30 years</strong> for private property, or <strong>25 years</strong> for an HDB flat; or</li>
    <li>Loan tenure <strong>plus your current age</strong> exceeds <strong>65 years</strong>.</li>
  </ul>

  <table>
    <thead>
      <tr><th>Outstanding loans</th><th>Standard tier</th><th>Reduced tier</th><th>Cash either way</th></tr>
    </thead>
    <tbody>
      <tr><td>One (second loan)</td><td>45% LTV</td><td>25% LTV</td><td>25%</td></tr>
      <tr><td>Two or more (third+)</td><td>35% LTV</td><td>15% LTV</td><td>25%</td></tr>
    </tbody>
  </table>

  <p>This bites hard for older buyers. A 45-year-old taking a 25-year tenure reaches 70 at maturity, so the loan drops to the 25% tier &mdash; funding 75% of the purchase personally. Shortening the tenure to 20 years keeps them inside the 45% tier, but raises the monthly instalment, which then has to clear TDSR. That trade-off between tenure, LTV and TDSR is the core of structuring a second-property purchase, and it is worth modelling before you commit to anything.</p>

  <h2 id="tdsr">TDSR, MSR and the 4% Floor</h2>

  <p>Clearing the LTV hurdle is not enough. You still have to clear the income test, and your existing mortgage counts against you.</p>

  <p><strong>TDSR</strong> caps total monthly debt obligations at <strong>55% of gross monthly income</strong>, and it applies to every property loan regardless of how many properties you own. Critically, the bank computes both your existing and your new housing loan at a <strong>medium-term interest rate floor of 4% per annum</strong> for residential property, not at the rate you are actually paying. If your first mortgage is on a 1.4% package, it will still be stress-tested at 4% when sizing the second loan.</p>

  <p><strong>MSR</strong>, the 30% cap on housing instalments alone, applies <em>only</em> to HDB flats and to executive condominiums whose minimum occupation period has not expired. It does not apply to private property or to a post-MOP EC. Most second-property purchases are private, so TDSR is usually the binding constraint.</p>

  <p>For the mechanics of both ratios, see our <a href="../tdsr-msr-explained/">TDSR and MSR explainer</a> and the <a href="../mas-stress-test-2026/">MAS stress test guide</a>.</p>

  <h2 id="absd">ABSD on Top</h2>

  <p>Additional Buyer's Stamp Duty is separate from the loan rules, payable in cash within 14 days, and it is not financeable. Current rates, in force since 27 April 2023:</p>

  <table>
    <thead>
      <tr><th>Buyer profile</th><th>2nd property</th><th>3rd and subsequent</th></tr>
    </thead>
    <tbody>
      <tr><td>Singapore Citizen</td><td>20%</td><td>30%</td></tr>
      <tr><td>Singapore PR</td><td>30%</td><td>35%</td></tr>
      <tr><td>Foreigner</td><td colspan="2">60% on any residential property</td></tr>
    </tbody>
  </table>

  <p>ABSD is charged on the higher of purchase price or market value. Buyer's Stamp Duty is payable on top of that, and while BSD can be reimbursed from CPF after the fact, ABSD has to stay cash unless a remission applies. Married couples with at least one Singapore Citizen should read up on the <a href="../avoid-absd-second-property-singapore/">remission and restructuring routes</a> before committing, because the decision is far easier to make before the first purchase than after.</p>

  <h2 id="worked">A Worked Example</h2>

  <p>Take a S$1,500,000 condo as a second property, bought by a Singapore Citizen aged 40 with one outstanding housing loan, on a 25-year tenure. Age 40 plus 25 years equals 65, which does not exceed 65, so the standard 45% tier applies.</p>

  <table>
    <thead>
      <tr><th>Item</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr><td>Price / valuation</td><td>S$1,500,000</td></tr>
      <tr><td>Maximum loan at 45% LTV</td><td>S$675,000</td></tr>
      <tr><td>Total downpayment (55%)</td><td>S$825,000</td></tr>
      <tr><td>&mdash; of which cash (25%, CPF not allowed)</td><td>S$375,000</td></tr>
      <tr><td>&mdash; balance (30%, cash or CPF OA)</td><td>S$450,000</td></tr>
      <tr><td>Buyer's Stamp Duty</td><td>~S$44,600</td></tr>
      <tr><td>ABSD at 20% (cash, within 14 days)</td><td>S$300,000</td></tr>
      <tr><td><strong>Cash needed up front</strong></td><td><strong>~S$719,600</strong></td></tr>
    </tbody>
  </table>

  <p>Nearly S$720,000 in cash before CPF contributes anything, on a S$1.5M purchase. And had this buyer been 45 rather than 40 on the same 25-year tenure, the loan would have dropped to the 25% tier &mdash; a maximum loan of S$375,000 and a further S$300,000 to find.</p>

  <p>That single fact reframes the whole exercise. For most people the question is not whether the rental yield works. It is whether the cash exists at all, and whether restructuring the first property first would produce a better outcome.</p>

  <h2 id="counts">What Counts as an Outstanding Loan</h2>

  <p>The tier depends on outstanding <em>loans</em>, not properties, and that distinction is worth money.</p>

  <p>MAS counts a housing loan as outstanding where the funds have been disbursed but not fully repaid, or have not yet been disbursed. A loan that has been <strong>fully repaid does not count</strong>. Someone who owns a property outright, with the mortgage cleared, is assessed at first-loan limits &mdash; 75% LTV and 5% minimum cash &mdash; when buying again. Banks verify the count through credit bureau and HDB checks, so this is a matter of record rather than declaration.</p>

  <p>There is also relief if you are selling. If you satisfy the bank, before the new loan is disbursed, that you have sold or will sell the existing property, you can be assessed at the first-loan LTV. The evidence has to be documentary: a stamped sale and purchase agreement for the property being sold, an HDB letter approving the sale, or a signed HDB undertaking. An intention to sell is not enough.</p>

  <p>Between those two routes and the decoupling option, there is usually more than one way to structure a second purchase. Which one is cheapest depends on your ages, your CPF balances and how much of the first mortgage is left &mdash; and the ordering matters, because some doors close once the purchase is made.</p>

  <h2 id="faq">Frequently Asked Questions</h2>

  <div class="faq-q">How much can I borrow for a second property in Singapore?</div>
  <p>If you already have one outstanding housing loan, your second loan is capped at 45% of the property's price or valuation, whichever is lower. That drops to 25% if the loan tenure exceeds 30 years (25 years for an HDB flat) or if the tenure plus your current age extends past 65. Either way, at least 25% of the price must be paid in cash. This compares with 75% LTV and only 5% minimum cash on a first housing loan.</p>

  <div class="faq-q">How much cash do I need for a second property?</div>
  <p>At least 25% of the purchase price or valuation, whichever is lower, in cash. CPF cannot be used for that portion. On a second loan at 45% LTV you therefore need 25% cash plus a further 30% from cash or CPF, making a 55% total downpayment. The cash requirement is the same 25% whether you fall in the 45% or the 25% LTV tier, and it also applies to a third or subsequent loan.</p>

  <div class="faq-q">What is the LTV for a third property loan in Singapore?</div>
  <p>With two or more outstanding housing loans, the third loan is capped at 35% LTV, falling to 15% if the tenure exceeds 30 years (25 for HDB) or runs past age 65. The minimum cash portion stays at 25% of the price. At 15% LTV you would be funding 85% of the purchase yourself, which is why third-property purchases are usually done after clearing an existing loan.</p>

  <div class="faq-q">Does TDSR apply to a second property loan?</div>
  <p>Yes. The 55% Total Debt Servicing Ratio cap applies to all property loans regardless of how many you own, and the instalments on your existing mortgage count towards it. The bank computes the new loan at a medium-term interest rate floor of 4% per annum for residential property, not at the rate you will actually pay, so the second loan qualifies for less than the live rate would suggest.</p>

  <div class="faq-q">Does MSR apply when buying a second property?</div>
  <p>Only if the property you are buying is an HDB flat or an executive condominium whose minimum occupation period has not expired. MSR caps the housing instalment alone at 30% of gross monthly income. It does not apply to private property or to a post-MOP EC, so most second-property purchases are governed by TDSR alone.</p>

  <div class="faq-q">Does a fully repaid housing loan still count against my LTV?</div>
  <p>No. MAS counts a loan as outstanding only where funds have been disbursed but not fully repaid, or have not yet been disbursed. A loan that has been fully repaid falls outside that definition, so a borrower who has cleared their first mortgage is assessed at first-loan limits. Banks verify the count through credit bureau and HDB checks.</p>

  <div class="faq-q">Can I get first-loan LTV if I am selling my current property?</div>
  <p>Potentially. If you satisfy the bank before the new loan is disbursed that you have sold or will sell the existing property, you can be assessed at the first-loan LTV. The evidence required is documentary — typically a stamped sale and purchase agreement for the property being sold, an HDB letter approving the sale, or a signed HDB undertaking. Verbal intention is not enough.</p>

  <hr class="divider">

  <h2 style="font-size:1.1rem; margin-bottom:1rem;">Further reading</h2>
  <ul class="checklist" style="margin-bottom:2rem;">
    <li><a href="../avoid-absd-second-property-singapore/">How to avoid ABSD on a second property</a> &mdash; the legal route, the IRAS 99-1 line, and when decoupling does and does not work</li>
    <li><a href="../decoupling-private-property-singapore/">Decoupling property in Singapore</a> &mdash; BSD on the share bought over, CPF refund with accrued interest, and the TDSR check on the receiving spouse</li>
    <li><a href="../tdsr-msr-explained/">TDSR and MSR explained</a> &mdash; the 55% and 30% ceilings and how the MAS stress floor is applied</li>
    <li><a href="../stamp-duty-singapore-guide-2026/">Singapore stamp duty guide</a> &mdash; BSD, ABSD and SSD in one place, with worked figures</li>
    <li><a href="/affordability/">Affordability check</a> &mdash; what you can borrow at the MAS stress floor</li>
  </ul>

  <hr class="divider">

  <p style="font-size: .8rem; color: rgba(232,227,218,.35); line-height: 1.6;">
    <em>This article is general information for Singapore borrowers. It is not financial, legal or tax advice.
    LTV, cash and TDSR figures follow MAS Notice 632 and Notice 645 as in force at the time of writing; ABSD
    rates follow the IRAS schedule in force from 27 April 2023. Stamp duty figures are indicative and rounded,
    and the actual amount depends on the exact consideration and IRAS calculation. Rules change &mdash; confirm
    your position with your bank, your conveyancing lawyer and IRAS before committing. Sources:
    <a href="https://www.mas.gov.sg/regulation/explainers/new-housing-loans/loan-tenure-and-loan-to-value-limits" target="_blank" rel="noopener" style="color:rgba(196,151,59,.5);">MAS: Loan Tenure and LTV Limits</a>,
    <a href="https://www.mas.gov.sg/regulation/notices/notice-632" target="_blank" rel="noopener" style="color:rgba(196,151,59,.5);">MAS Notice 632</a>,
    <a href="https://www.mas.gov.sg/regulation/explainers/tdsr-for-property-loans/calculating-tdsr" target="_blank" rel="noopener" style="color:rgba(196,151,59,.5);">MAS: Calculating TDSR</a>,
    <a href="https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/additional-buyer%27s-stamp-duty-(absd)" target="_blank" rel="noopener" style="color:rgba(196,151,59,.5);">IRAS: ABSD</a>.</em></p>
'''
