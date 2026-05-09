function buildReportPdf(r, lead) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 14;
  const CW = W - 2 * M;

  // ── Palette ──
  const NAVY = [11, 28, 58], NAVY_DARK = [6, 18, 42];
  const GOLD = [196, 151, 59], GOLD_TINT = [253, 247, 233];
  const CREAM = [250, 247, 242];
  const INK = [11, 18, 32], INK_2 = [44, 56, 78];
  const MUTED = [86, 101, 122], FAINT = [148, 163, 184];
  const BORDER = [221, 225, 232], BORDER_LT = [236, 239, 244];
  const SURFACE = [251, 252, 253], SOFT_BG = [246, 247, 249];
  const GREEN = [5, 150, 105], GREEN_SOFT = [236, 253, 245], GREEN_DK = [4, 120, 87];
  const RED = [220, 38, 38], RED_SOFT = [254, 242, 242];
  const AMBER = [217, 119, 6];

  const setColor = c => doc.setTextColor(c[0], c[1], c[2]);
  const setFill  = c => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw  = c => doc.setDrawColor(c[0], c[1], c[2]);
  const fmtN = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-SG');
  const fmt$ = n => '$' + fmtN(n);
  const dateStr = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

  let pageNum = 0;
  const TOTAL_PAGES = 9;

  function pageChrome(eyebrow) {
    pageNum++;
    if (pageNum > 1) doc.addPage();
    setFill(NAVY); doc.rect(0, 0, W, 14, 'F');
    setFill(GOLD); doc.rect(0, 14, W, 0.4, 'F');
    doc.setFont('times','normal'); doc.setFontSize(11); setColor(CREAM);
    doc.text('Nexus', M, 9);
    setColor(GOLD); doc.text('.', M + 12, 9);
    if (eyebrow) {
      doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor([200,200,200]);
      doc.text(eyebrow.toUpperCase(), M + 22, 9);
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor([180,180,180]);
    doc.text(pageNum + ' / ' + TOTAL_PAGES, W - M, 9, { align: 'right' });
    setDraw(BORDER_LT); doc.line(M, H - 9, W - M, H - 9);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(MUTED);
    doc.text('nexusmortgage.sg  ·  free service  ·  banks pay our referral fee', M, H - 5);
    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor([108,84,33]);
    doc.text('WhatsApp +65 8752 0859  ·  danler@nexusmortgage.sg', W - M, H - 5, { align: 'right' });
    return 22;
  }

  function sectionHeader(y, eyebrow, title, sub) {
    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(GOLD);
    doc.text(eyebrow.toUpperCase(), M, y);
    setFill(GOLD); doc.rect(M, y + 1.5, doc.getTextWidth(eyebrow.toUpperCase()), 0.4, 'F');
    y += 7;
    doc.setFont('times','normal'); doc.setFontSize(17); setColor(INK);
    const tlines = doc.splitTextToSize(title, CW);
    doc.text(tlines, M, y);
    y += tlines.length * 6.5;
    if (sub) {
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(MUTED);
      const slines = doc.splitTextToSize(sub, CW);
      doc.text(slines, M, y + 1);
      y += slines.length * 4.2;
    }
    return y + 5;
  }

  function kpiTile(x, y, w, h, label, value, sub, accent) {
    setFill(SURFACE); doc.rect(x, y, w, h, 'F');
    setDraw(BORDER); doc.rect(x, y, w, h);
    if (accent) { setFill(accent); doc.rect(x, y, 1.5, h, 'F'); }
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(MUTED);
    doc.text(label.toUpperCase(), x + 5, y + 6);
    doc.setFont('times','normal'); doc.setFontSize(15); setColor(INK);
    doc.text(value, x + 5, y + 16);
    if (sub) {
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(MUTED);
      const lines = doc.splitTextToSize(sub, w - 10);
      doc.text(lines, x + 5, y + h - 4);
    }
  }

  function table(headers, rows, opts) {
    const o = opts || {};
    const x0 = M;
    const widths = o.widths;
    const totalW = widths.reduce(function(s,w){return s+w;},0);
    const aligns = o.aligns || widths.map(function(_,i){return i===0?'left':'right';});
    let y = o.y;
    setFill(NAVY); doc.rect(x0, y, totalW, 6.5, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(CREAM);
    let cx = x0;
    headers.forEach(function(h,i){
      const align = aligns[i];
      const tx = align==='right' ? cx + widths[i] - 3 : cx + 3;
      doc.text(String(h).toUpperCase(), tx, y + 4.5, { align: align });
      cx += widths[i];
    });
    y += 6.5;
    rows.forEach(function(row, ri){
      const rh = row._h || 6.8;
      if (row._highlight) {
        setFill(row._highlightColor || GREEN_SOFT);
        doc.rect(x0, y, totalW, rh, 'F');
      } else if (ri % 2 === 1) {
        setFill(SOFT_BG); doc.rect(x0, y, totalW, rh, 'F');
      }
      doc.setFont('helvetica','normal'); doc.setFontSize(8.3);
      setColor(row._color || INK);
      cx = x0;
      row.cells.forEach(function(cell, i){
        const align = aligns[i];
        const tx = align==='right' ? cx + widths[i] - 3 : cx + 3;
        const obj = (cell && typeof cell === 'object') ? cell : { text: cell };
        if (obj.font === 'bold') doc.setFont('helvetica','bold'); else doc.setFont('helvetica','normal');
        if (obj.color) setColor(obj.color); else setColor(row._color || INK);
        doc.text(String(obj.text == null ? '' : obj.text), tx, y + rh - 2.3, { align: align });
        cx += widths[i];
      });
      setDraw(BORDER_LT); doc.line(x0, y + rh, x0 + totalW, y + rh);
      y += rh;
    });
    return y;
  }

  function bar(x, y, w, h, used, cap, max) {
    const m = max || Math.max(cap, used) * 1.05;
    setFill(BORDER_LT); doc.rect(x, y, w, h, 'F');
    if (used > 0) {
      const fillW = Math.min(1, used / m) * w;
      const tone = used <= cap ? GREEN : (used <= cap*1.05 ? AMBER : RED);
      setFill(tone); doc.rect(x, y, fillW, h, 'F');
    }
    const capX = x + Math.min(1, cap / m) * w;
    setDraw(NAVY); doc.setLineWidth(0.5);
    doc.line(capX, y - 0.5, capX, y + h + 0.5);
    doc.setLineWidth(0.2);
  }

  // ── Pre-compute everything ──
  const isRefi = r.inp.mode === 'refinance';
  const propLabel = r.inp.propertyType === 'hdb' ? 'HDB / EC' : 'Private';
  const sel = r.banks[selectedRateIdx] || r.banks[0];
  const monthly = sel.monthly;
  const totalIncome = r.inp.income || 0;
  const price = r.inp.price || (isRefi ? r.inp.loan : 0);
  const tdsrFail = !r.tdsrPass || (r.msrApplies && !r.msrPass);

  const buyers = (r.inp.borrowerResidencies || ['SC']).map(function(res, i){
    return { residency: res, propertiesOwned: (r.inp.borrowerPropertiesOwned || [0])[i] || 0 };
  });
  const buyerDesc = buyersDescription(buyers);
  const bsd = calcBSD(price);
  const absdRate = calcABSDRate(buyers);
  const absd = Math.round(price * absdRate);
  const absdRateLabel = absdLabel(absdRate);

  const regulatoryLtvPct = (r.ltvPct || 75) / 100;
  const effectiveLtvPct = (r.effectiveLtvPct || (r.ltvPct || 75)) / 100;
  const ltvPct = effectiveLtvPct;
  const downPayment = r.actualDownPayment != null ? r.actualDownPayment : Math.round(price * (1 - ltvPct));
  const minCashRequired = Math.round(price * 0.05);
  const cpfPortion = Math.max(0, downPayment - minCashRequired);
  const legalFee = price > 1000000 ? 3000 : 2500;
  const valuationFee = price > 1000000 ? 600 : 300;
  const upfrontTotal = downPayment + bsd + absd + legalFee + valuationFee;
  const upfrontMinCash = minCashRequired + bsd + absd + valuationFee;
  const upfrontMinCPF = cpfPortion + legalFee;
  const cpfOA = r.inp.cpfOA || 0;
  const cashOnHand = r.inp.cashOnHand || 0;
  const totalShortfall = Math.max(0, upfrontTotal - (cpfOA + cashOnHand));

  // ═══════════════════ PAGE 1 — COVER ═══════════════════
  pageNum = 1;
  setFill(NAVY); doc.rect(0, 0, W, H, 'F');
  setFill(GOLD); doc.rect(0, 70, W, 0.6, 'F');
  setFill(GOLD); doc.rect(0, 71.5, W, 0.2, 'F');
  doc.setFont('times','normal'); doc.setFontSize(34); setColor(CREAM);
  doc.text('Nexus', M, 35);
  setColor(GOLD); doc.text('.', M + 38, 35);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); setColor([200,200,200]);
  doc.text('SINGAPORE MORTGAGE SPECIALISTS', M, 41);
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(GOLD);
  doc.text('REPORT DATE  ·  ' + dateStr.toUpperCase(), W - M, 25, { align: 'right' });

  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(GOLD);
  doc.text(isRefi ? 'REFINANCE OPPORTUNITY ANALYSIS' : 'PROPERTY PURCHASE REPORT', M, 90);
  doc.setFont('times','normal'); doc.setFontSize(36); setColor(CREAM);
  doc.text(['Your personalised', 'mortgage report.'], M, 105);
  doc.setFont('helvetica','normal'); doc.setFontSize(11); setColor([200,200,200]);
  const subTxt = isRefi
    ? 'A side-by-side analysis of your current loan against the cheapest packages on the market right now — with year-by-year cost projections and a refinance playbook.'
    : 'A complete affordability and rate analysis built around your income, property type, and tenure — with stamp duties, funds position, and the cheapest 8 packages from 16 banks.';
  doc.text(doc.splitTextToSize(subTxt, CW - 50), M, 145);

  let yPF = 175;
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(GOLD);
  doc.text('PREPARED FOR', M, yPF); yPF += 5;
  doc.setFont('times','normal'); doc.setFontSize(20); setColor(CREAM);
  doc.text(lead.name, M, yPF + 5); yPF += 10;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); setColor([180,180,180]);
  doc.text(lead.email + '   ·   ' + lead.phone, M, yPF + 4);

  const cardY = 220;
  setFill([15, 35, 65]); doc.rect(M, cardY, CW, 32, 'F');
  setDraw(GOLD); doc.setLineWidth(0.4); doc.rect(M, cardY, CW, 32);
  doc.setLineWidth(0.2);
  const kpiW = CW / 4;
  const kpis = [
    ['BEST RATE', (r.bestRate*100).toFixed(2) + '%'],
    [isRefi ? 'NEW MONTHLY' : 'EST. MONTHLY', fmt$(monthly) + '/mo'],
    [isRefi ? 'CURRENT LOAN' : 'LOAN AMOUNT', fmt$(r.inp.loan)],
    ['TENURE', r.inp.tenure + ' years'],
  ];
  kpis.forEach(function(k, i){
    const cx = M + kpiW * i + 6;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(GOLD);
    doc.text(k[0], cx, cardY + 9);
    doc.setFont('times','normal'); doc.setFontSize(15); setColor(CREAM);
    doc.text(k[1], cx, cardY + 22);
    if (i < 3) {
      setDraw([60,80,110]); doc.line(M + kpiW * (i+1), cardY + 5, M + kpiW * (i+1), cardY + 27);
    }
  });

  setFill(NAVY_DARK); doc.rect(0, H - 24, W, 24, 'F');
  setFill(GOLD); doc.rect(0, H - 24, W, 0.4, 'F');
  doc.setFont('times','normal'); doc.setFontSize(12); setColor(CREAM);
  doc.text('Want us to lock in this rate?', M, H - 12);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor([180,180,180]);
  doc.text('Free service  ·  zero fees  ·  banks pay our referral fee', M, H - 6);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); setColor(GOLD);
  doc.text('WhatsApp +65 8752 0859', W - M, H - 14, { align: 'right' });
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor([180,180,180]);
  doc.text('danler@nexusmortgage.sg  ·  nexusmortgage.sg', W - M, H - 6, { align: 'right' });

  // ═══════════════════ PAGE 2 — EXECUTIVE SUMMARY ═══════════════════
  let y = pageChrome('Executive Summary');
  y = sectionHeader(y, 'Executive summary', 'At a glance — what your numbers say.',
    'A snapshot of the key metrics; the rest of this report explains how each was derived.');

  const kpiH = 26;
  const kpiTW = (CW - 9) / 4;
  const tdsrPct = r.tdsrUsage * 100;
  kpiTile(M, y, kpiTW, kpiH, 'Best rate found', (r.bestRate*100).toFixed(2) + '% p.a.',
    r.banks[0].bank + ' · ' + r.banks[0].pkg, GOLD);
  kpiTile(M + kpiTW + 3, y, kpiTW, kpiH, 'Estimated monthly', fmt$(monthly) + '/mo',
    'at best rate over ' + r.inp.tenure + 'y', GREEN);
  kpiTile(M + (kpiTW + 3) * 2, y, kpiTW, kpiH, 'TDSR usage', tdsrPct.toFixed(1) + '%',
    r.tdsrPass ? 'Within 55% cap' : 'Exceeds 55% cap', r.tdsrPass ? GREEN : RED);
  kpiTile(M + (kpiTW + 3) * 3, y, kpiTW, kpiH, 'Effective LTV', (r.effectiveLtvPct || r.ltvPct).toFixed(1) + '%',
    'Down payment ' + fmt$(downPayment), NAVY);
  y += kpiH + 8;

  const verdict = tdsrFail
    ? { tone: RED, soft: RED_SOFT,
        title: 'You exceed the ' + (r.cappedBy === 'MSR' ? '30% MSR' : '55% TDSR') + ' cap',
        body: 'At your requested loan, this won\'t pass MAS stress-testing. The good news: there are clear levers to fit inside the cap — see the Optimisation Playbook.' }
    : { tone: GREEN, soft: GREEN_SOFT,
        title: 'You qualify — and there\'s headroom to go higher',
        body: 'Your monthly fits comfortably inside both regulatory caps. The cheapest package gives a Year-1 monthly of ' + fmt$(monthly) + '.' };
  setFill(verdict.soft); doc.rect(M, y, CW, 22, 'F');
  setFill(verdict.tone); doc.rect(M, y, 1.8, 22, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(11); setColor(verdict.tone);
  doc.text(verdict.title, M + 6, y + 9);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); setColor(INK_2);
  doc.text(doc.splitTextToSize(verdict.body, CW - 12), M + 6, y + 15);
  y += 30;

  y = sectionHeader(y, 'What\'s in this report', 'A walkthrough across nine pages.', '');
  const toc = [
    ['1', 'Cover'],
    ['2', 'Executive summary (this page)'],
    ['3', 'Income, debt servicing & affordability'],
    ['4', 'Bank rate comparison — top 8 packages'],
    ['5', 'Your selected package — full terms'],
    ['6', 'Stress test & lifetime cost'],
    ['7', isRefi ? 'Refinance comparison' : 'Upfront costs & funds position'],
    ['8', 'Amortisation schedule, year by year'],
    ['9', 'Optimisation playbook & next steps'],
  ];
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
  toc.forEach(function(t){
    setColor(GOLD); doc.setFont('helvetica','bold'); doc.text(t[0], M, y);
    setColor(INK_2); doc.setFont('helvetica','normal'); doc.text(t[1], M + 8, y);
    setDraw(BORDER_LT); doc.line(M + 8 + doc.getTextWidth(t[1]) + 2, y - 1, W - M, y - 1);
    y += 6;
  });

  // ═══════════════════ PAGE 3 — INCOME & DEBT SERVICING ═══════════════════
  y = pageChrome('Income · Debt Servicing · Affordability');
  y = sectionHeader(y, 'Income & debt servicing', 'How TDSR and MSR see your case.',
    'MAS rules cap your debt servicing at 55% of effective monthly income (TDSR), and HDB/EC mortgages at 30% (MSR). All numbers below stress-tested at MAS 4%.');

  const incomeFixed = (r.inp.borrowerIncomes || [r.inp.income]).reduce(function(s,v){return s+(v||0);},0);
  const incomeVar30 = ((r.inp.borrowerVariableIncomes||[]).reduce(function(s,v){return s+(v||0);},0)) * 0.30;
  const pledgedTotal = (r.inp.borrowerPledged||[]).reduce(function(s,v){return s+(v||0);},0);
  const showTotal = (r.inp.borrowerShow||[]).reduce(function(s,v){return s+(v||0);},0);
  const incomePledged = pledgedTotal / 48;
  const incomeShow = (showTotal * 0.30) / 48;
  const debtsTotal = r.inp.debts || 0;
  const availForMortgage = (r.inp.income||0) - debtsTotal;

  const rowsIncome = [
    { cells: ['Fixed monthly income (all borrowers)', fmt$(incomeFixed) + '/mo'] },
    { cells: ['+ Variable income × 30% (MAS haircut)', fmt$(incomeVar30) + '/mo'] },
  ];
  if (pledgedTotal > 0) rowsIncome.push({ cells: ['+ Pledged funds boost (100% ÷ 48 mths)', fmt$(incomePledged) + '/mo'] });
  if (showTotal > 0) rowsIncome.push({ cells: ['+ Show funds boost (30% ÷ 48 mths)', fmt$(incomeShow) + '/mo'] });
  rowsIncome.push({ cells: [{ text: 'Less existing monthly debts' }, { text: '– ' + fmt$(debtsTotal) + '/mo', color: RED }] });
  rowsIncome.push({ cells: [{ text: 'Available for mortgage', font: 'bold' }, { text: fmt$(availForMortgage) + '/mo', font: 'bold' }],
    _highlight: true, _highlightColor: GOLD_TINT });
  y = table(['Component', 'Monthly'], rowsIncome, { y: y, widths: [CW - 50, 50] });
  y += 8;

  doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
  doc.text('Regulatory checks', M, y); y += 6;
  const barRows = [
    ['TDSR · Total Debt Servicing Ratio', r.tdsrUsage, 0.55, '55% cap'],
  ];
  if (r.msrApplies) barRows.push(['MSR · Mortgage Servicing Ratio (HDB/EC)', r.msrUsage, 0.30, '30% cap']);
  barRows.push(['Effective LTV · Loan-to-Value', (r.effectiveLtvPct||r.ltvPct)/100, regulatoryLtvPct, (r.ltvPct||75) + '% cap']);
  barRows.forEach(function(row){
    const lbl = row[0], used = row[1], cap = row[2], capLbl = row[3];
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setColor(INK);
    doc.text(lbl, M, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); setColor(INK_2);
    doc.text((used*100).toFixed(1) + '%  /  ' + capLbl, W - M, y, { align: 'right' });
    y += 2;
    bar(M, y, CW, 4, used, cap);
    y += 8;
  });

  y += 4;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
  doc.text(tdsrFail ? 'Affordability shortfall' : 'Affordability headroom', M, y); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(MUTED);
  const afLine = tdsrFail
    ? 'You\'re asking for $' + fmtN(r.inp.loan) + '. The most you qualify for at this tenure & income is shown below.'
    : 'You\'re asking for $' + fmtN(r.inp.loan) + '. Your headroom shows the most you could borrow before hitting the cap.';
  doc.text(doc.splitTextToSize(afLine, CW), M, y); y += 8;

  const tw = (CW - 4) / 2;
  setFill(SOFT_BG); doc.rect(M, y, tw, 22, 'F'); setDraw(BORDER); doc.rect(M, y, tw, 22);
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(MUTED);
  doc.text(tdsrFail ? 'MAX LOAN AT YOUR INCOME' : 'MAX LOAN HEADROOM', M + 4, y + 6);
  doc.setFont('times','normal'); doc.setFontSize(15); setColor(tdsrFail ? RED : GREEN);
  doc.text(fmt$(r.maxLoanAffordable || 0), M + 4, y + 16);
  setFill(SOFT_BG); doc.rect(M + tw + 4, y, tw, 22, 'F'); setDraw(BORDER); doc.rect(M + tw + 4, y, tw, 22);
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(MUTED);
  doc.text('MAX PROPERTY PRICE  ·  ' + (r.ltvPct||75) + '% LTV', M + tw + 8, y + 6);
  doc.setFont('times','normal'); doc.setFontSize(15); setColor(GREEN);
  doc.text(fmt$(r.maxPurchasePrice || 0), M + tw + 8, y + 16);
  y += 30;

  // ═══════════════════ PAGE 4 — BANK RATE COMPARISON ═══════════════════
  y = pageChrome('Bank Rate Comparison');
  y = sectionHeader(y, 'Bank rates ranked', 'The cheapest 8 packages for your loan tier.',
    'Ranked by total cost over the lock-in period (typically 2 years). Highlight = your selected package. Rates as of ' + dateStr + '.');
  const top8 = r.banks.slice(0, 8);
  const rateRows = top8.map(function(b, i){
    const isSelected = (b._origIdx === selectedRateIdx) || (i === selectedRateIdx);
    return {
      cells: [
        { text: (i===0?'★ ':'') + b.bank, font: 'bold' },
        b.pkg,
        (b.lockInYears ? b.lockInYears + 'y' : 'No lock'),
        b.rate.toFixed(2) + '%',
        fmt$(b.monthly),
        fmt$(b.lockInCost),
      ],
      _highlight: isSelected,
      _highlightColor: GOLD_TINT,
    };
  });
  y = table(['Bank','Package','Lock-in','Rate p.a.','Monthly','Lock-in cost'],
    rateRows, { y: y, widths: [22, 60, 16, 22, 24, 36] });
  y += 8;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(MUTED);
  doc.text(doc.splitTextToSize('Lock-in cost = total monthly payments × lock-in months. After lock-in, the rate typically reverts to the package\'s "thereafter" rate (see your selected package on the next page).', CW), M, y);
  y += 12;

  if (r.banks.length >= 2) {
    setFill(GREEN_SOFT); doc.rect(M, y, CW, 18, 'F');
    setFill(GREEN); doc.rect(M, y, 1.8, 18, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(GREEN_DK);
    doc.text('You save ' + fmt$(r.savingsVsSecond) + ' over lock-in', M + 6, y + 8);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(INK_2);
    doc.text('vs. the next-cheapest package on the market — at no cost to you.', M + 6, y + 14);
    y += 24;
  }

  // ═══════════════════ PAGE 5 — SELECTED PACKAGE ═══════════════════
  y = pageChrome('Selected Package');
  y = sectionHeader(y, 'Selected package', sel.bank + ' · ' + sel.pkg,
    (sel.subCategory || sel.category || '') + '  ·  Year-1 rate ' + sel.rate.toFixed(2) + '% p.a.');

  const yrs = [
    ['Year 1', sel.year1Raw || (sel.year1Rate!=null ? sel.year1Rate.toFixed(2)+'%' : '—'), sel.year1Rate],
    ['Year 2', sel.year2Raw || (sel.year2Rate!=null ? sel.year2Rate.toFixed(2)+'%' : '—'), sel.year2Rate],
    ['Year 3', sel.year3Raw || (sel.year3Rate!=null ? sel.year3Rate.toFixed(2)+'%' : '—'), sel.year3Rate],
    ['Year 4', sel.year4Raw || (sel.year4Rate!=null ? sel.year4Rate.toFixed(2)+'%' : '—'), sel.year4Rate],
    ['Year 5', sel.year5Raw || (sel.year5Rate!=null ? sel.year5Rate.toFixed(2)+'%' : '—'), sel.year5Rate],
    ['Thereafter', sel.thereafterRaw || (sel.thereafterRate!=null ? sel.thereafterRate.toFixed(2)+'%' : '—'), sel.thereafterRate],
  ];
  const yrRows = yrs.map(function(yr){
    const m = yr[2] != null ? pmt(r.inp.loan, yr[2]/100, r.inp.tenure) : null;
    return { cells: [yr[0], yr[1], m != null ? fmt$(m) : '—', m != null ? fmt$(m * 12) : '—'] };
  });
  y = table(['Year','Rate basis','Monthly','Annual cost'], yrRows, { y: y, widths: [22, 90, 32, 36] });
  y += 8;

  doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
  doc.text('Terms & conditions', M, y); y += 5;
  const terms = [
    ['Lock-in period', sel.lockInYears ? sel.lockInYears + ' year' + (sel.lockInYears>1?'s':'') : 'No lock-in'],
    ['Qualifying loan', sel.qualifying || ('Min $' + fmtN(sel.qualifyingMin || 0))],
    ['Rate basis', sel.category || sel.family || '—'],
    ['Lock-in cost (your loan)', fmt$(sel.lockInCost)],
    ['Monthly payment (Year 1)', fmt$(sel.monthly)],
    ['Total interest over ' + r.inp.tenure + 'y', fmt$(r.totalInterest)],
  ];
  const tw2 = (CW - 4) / 2;
  terms.forEach(function(t, i){
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (tw2 + 4);
    const yy = y + row * 14;
    setFill(SURFACE); doc.rect(x, yy, tw2, 12, 'F'); setDraw(BORDER_LT); doc.rect(x, yy, tw2, 12);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(MUTED);
    doc.text(t[0].toUpperCase(), x + 3, yy + 4);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
    doc.text(t[1], x + 3, yy + 9);
  });
  y += Math.ceil(terms.length / 2) * 14 + 8;

  if (sel.lockInYears) {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + sel.lockInYears);
    const refiWindow = new Date(expiry);
    refiWindow.setMonth(refiWindow.getMonth() - 4);
    setFill(GOLD_TINT); doc.rect(M, y, CW, 22, 'F'); setFill(GOLD); doc.rect(M, y, 1.8, 22, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(NAVY);
    doc.text('Lock-in expires around ' + expiry.toLocaleDateString('en-SG', { month:'short', year:'numeric' }), M + 6, y + 8);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(INK_2);
    const reText = 'Start refinance shopping by ' + refiWindow.toLocaleDateString('en-SG', { month:'short', year:'numeric' }) + '. We\'ll reach out 6 weeks before — free service, banks pay our referral.';
    doc.text(doc.splitTextToSize(reText, CW - 12), M + 6, y + 14);
    y += 28;
  }

  // ═══════════════════ PAGE 6 — STRESS TEST + LIFETIME COST ═══════════════════
  y = pageChrome('Stress Test · Lifetime Cost');
  y = sectionHeader(y, 'Stress test', 'If rates rise — what your monthly looks like.',
    'Same loan, same tenure — just a higher rate. MAS already stress-tests you at 4% for affordability; we model up to 6% so you can see the headroom on your own budget.');

  const baseM = r.monthlyBest;
  const stressData = [
    ['Your best rate (today)', r.bestRate*100, baseM],
    ['Mild uptick', 3.0, pmt(r.inp.loan, 0.03, r.inp.tenure)],
    ['MAS stress floor', 4.0, pmt(r.inp.loan, 0.04, r.inp.tenure)],
    ['Severe', 5.0, pmt(r.inp.loan, 0.05, r.inp.tenure)],
    ['Extreme', 6.0, pmt(r.inp.loan, 0.06, r.inp.tenure)],
  ];
  const stressTbl = stressData.map(function(sr, i){
    const delta = i === 0 ? 0 : sr[2] - baseM;
    const dTxt = i === 0 ? '—' : (delta > 0 ? '+' + fmt$(delta) + '/mo' : fmt$(delta) + '/mo');
    const annualInt = r.inp.loan * (sr[1]/100);
    return {
      cells: [
        sr[0],
        sr[1].toFixed(2) + '%',
        fmt$(sr[2]),
        { text: dTxt, color: i === 0 ? MUTED : (delta > 0 ? RED : GREEN) },
        fmt$(annualInt),
      ],
      _highlight: i === 0,
      _highlightColor: GREEN_SOFT,
    };
  });
  y = table(['Scenario','Rate','Monthly','Δ vs best','Y1 interest'], stressTbl,
    { y: y, widths: [50, 22, 32, 36, 40] });
  y += 10;

  y = sectionHeader(y, 'Lifetime cost', 'What you\'ll pay over the full ' + r.inp.tenure + '-year tenure.', '');
  const interest = r.totalInterest;
  const totalPaid = r.inp.loan + interest;
  const intPct = (interest / totalPaid) * 100;
  const lcW = (CW - 8) / 3;
  kpiTile(M, y, lcW, kpiH, 'Principal repaid', fmt$(r.inp.loan), 'The original loan amount.', NAVY);
  kpiTile(M + lcW + 4, y, lcW, kpiH, 'Total interest', fmt$(interest), intPct.toFixed(1) + '% of total outlay', GOLD);
  kpiTile(M + (lcW + 4) * 2, y, lcW, kpiH, 'Total paid back', fmt$(totalPaid), 'Principal + interest, undiscounted', GREEN);
  y += kpiH + 6;

  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setColor(INK);
  doc.text('Where every $1 you pay back goes:', M, y); y += 4;
  const segPrincipal = (r.inp.loan / totalPaid) * CW;
  setFill(NAVY); doc.rect(M, y, segPrincipal, 10, 'F');
  setFill(GOLD); doc.rect(M + segPrincipal, y, CW - segPrincipal, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(CREAM);
  doc.text('Principal · ' + (100-intPct).toFixed(1) + '%', M + 3, y + 6.5);
  doc.text('Interest · ' + intPct.toFixed(1) + '%', M + segPrincipal + 3, y + 6.5);
  y += 16;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(MUTED);
  const lcNote = intPct > 30
    ? 'On a ' + r.inp.tenure + '-year tenure, interest makes up ' + intPct.toFixed(1) + '% of your total outlay. Refinancing every 2–3 years (when your lock-in expires) is the single biggest lever to bring this down.'
    : 'Interest is ' + intPct.toFixed(1) + '% of your total outlay — relatively healthy. Keep an eye on lock-in expiry to ride future rate cuts.';
  doc.text(doc.splitTextToSize(lcNote, CW), M, y);

  // ═══════════════════ PAGE 7 — UPFRONT or REFI ═══════════════════
  if (!isRefi) {
    y = pageChrome('Upfront Costs · Funds');
    y = sectionHeader(y, 'Upfront costs', 'What you need at completion.',
      'Calculated using IRAS BSD/ABSD rates effective 27 Apr 2023 and MAS LTV rules.');
    const upfrontRows = [
      { cells: [
          { text: 'Down payment · ' + ((1-ltvPct)*100).toFixed(1) + '% of price', font: 'bold' },
          { text: fmt$(downPayment), font: 'bold' },
        ]},
      { cells: ['  Min cash (5% of price)', fmt$(minCashRequired)] },
      { cells: ['  Balance via CPF OA or cash', fmt$(cpfPortion)] },
      { cells: ['Buyer\'s Stamp Duty (BSD) · 1–6% tiered', fmt$(bsd)] },
      { cells: ['Additional Buyer\'s Stamp Duty · ' + absdRateLabel + ' (' + buyerDesc + ')', fmt$(absd)] },
      { cells: ['Legal fees', fmt$(legalFee)] },
      { cells: ['Valuation fee', fmt$(valuationFee)] },
      { cells: [
          { text: 'Total upfront required', font: 'bold' },
          { text: fmt$(upfrontTotal), font: 'bold' },
        ], _highlight: true, _highlightColor: GOLD_TINT },
    ];
    y = table(['Cost item', 'Amount'], upfrontRows, { y: y, widths: [CW - 50, 50] });
    y += 8;

    doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
    doc.text('Cash vs CPF allocation', M, y); y += 5;
    setFill(SOFT_BG); doc.rect(M, y, CW, 24, 'F'); setDraw(BORDER); doc.rect(M, y, CW, 24);
    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(MUTED);
    doc.text('CASH NEEDED (MIN)', M + 4, y + 6);
    doc.text('CPF OA NEEDED', M + CW/2 + 4, y + 6);
    doc.setFont('times','normal'); doc.setFontSize(15); setColor(INK);
    doc.text(fmt$(upfrontMinCash), M + 4, y + 18);
    doc.text(fmt$(upfrontMinCPF), M + CW/2 + 4, y + 18);
    setDraw(BORDER); doc.line(M + CW/2, y + 4, M + CW/2, y + 20);
    y += 30;

    if (cpfOA > 0 || cashOnHand > 0) {
      y = sectionHeader(y, 'Your funds position', totalShortfall === 0 ? 'You\'re fully covered.' : 'Shortfall of ' + fmt$(totalShortfall) + '.',
        'Based on the CPF OA & cash on hand you provided.');
      const fundRows = [
        { cells: ['Cash on hand', fmt$(cashOnHand)] },
        { cells: ['Cash needed (min)', '– ' + fmt$(upfrontMinCash)] },
        { cells: [
            { text: cashOnHand >= upfrontMinCash ? 'Cash surplus' : 'Cash shortfall', font: 'bold' },
            { text: (cashOnHand >= upfrontMinCash ? '+ ' : '– ') + fmt$(Math.abs(cashOnHand - upfrontMinCash)), font: 'bold', color: cashOnHand >= upfrontMinCash ? GREEN : RED }
          ]},
        { cells: ['CPF OA available', fmt$(cpfOA)] },
        { cells: ['CPF OA needed', '– ' + fmt$(upfrontMinCPF)] },
        { cells: [
            { text: cpfOA >= upfrontMinCPF ? 'CPF surplus' : 'CPF shortfall', font: 'bold' },
            { text: (cpfOA >= upfrontMinCPF ? '+ ' : '– ') + fmt$(Math.abs(cpfOA - upfrontMinCPF)), font: 'bold', color: cpfOA >= upfrontMinCPF ? GREEN : RED }
          ]},
        { cells: [
            { text: 'TOTAL POSITION', font: 'bold' },
            { text: (totalShortfall === 0 ? 'Fully covered' : 'Need additional ' + fmt$(totalShortfall)), font: 'bold', color: totalShortfall === 0 ? GREEN : RED }
          ], _highlight: true, _highlightColor: totalShortfall === 0 ? GREEN_SOFT : RED_SOFT },
      ];
      y = table(['Item', 'Amount'], fundRows, { y: y, widths: [CW - 60, 60] });
    }
  } else {
    y = pageChrome('Refinance Comparison');
    y = sectionHeader(y, 'Refinance comparison', 'Your current loan vs the cheapest new package.',
      'Savings projected over the new lock-in period.');
    const curMonthly = pmt(r.inp.loan, r.inp.currentRate || 0.04, r.inp.tenure);
    const newMonthly = sel.monthly;
    const monthSave = curMonthly - newMonthly;
    const lockMonths = (sel.lockInYears || 2) * 12;
    const lockSavings = monthSave * lockMonths;
    const refiRows = [
      { cells: ['Outstanding loan', fmt$(r.inp.loan)] },
      { cells: ['Remaining tenure', r.inp.tenure + ' years'] },
      { cells: ['Current rate (your input)', ((r.inp.currentRate||0)*100).toFixed(2) + '%'] },
      { cells: ['Current monthly', fmt$(curMonthly)] },
      { cells: ['New best rate', sel.rate.toFixed(2) + '%'] },
      { cells: ['New monthly', fmt$(newMonthly)] },
      { cells: [
          { text: 'Monthly saving', font: 'bold' },
          { text: fmt$(monthSave) + '/mo', font: 'bold', color: monthSave > 0 ? GREEN : RED }
        ]},
      { cells: [
          { text: 'Total saving over ' + (sel.lockInYears||2) + 'y lock-in', font: 'bold' },
          { text: fmt$(lockSavings), font: 'bold', color: lockSavings > 0 ? GREEN : RED }
        ], _highlight: true, _highlightColor: GREEN_SOFT },
    ];
    y = table(['Item','Amount'], refiRows, { y: y, widths: [CW - 60, 60] });
  }

  // ═══════════════════ PAGE 8 — AMORTISATION ═══════════════════
  y = pageChrome('Amortisation Schedule');
  y = sectionHeader(y, 'Amortisation schedule', 'Year-by-year — at your best rate.',
    'How your loan unwinds. Principal payments grow each year while interest shrinks.');

  const rateY = r.bestRate;
  let bal = r.inp.loan;
  const annMon = pmt(r.inp.loan, rateY, r.inp.tenure);
  const schedule = [];
  for (let yr = 1; yr <= r.inp.tenure; yr++) {
    let yearInt = 0, yearPrin = 0;
    for (let m = 0; m < 12; m++) {
      if (bal <= 0) break;
      const i = bal * (rateY / 12);
      const p = annMon - i;
      yearInt += i; yearPrin += p; bal -= p;
    }
    schedule.push({ yr: yr, payment: annMon * 12, interest: yearInt, principal: yearPrin, balance: Math.max(0, bal) });
  }
  const half = Math.ceil(schedule.length / 2);
  const left = schedule.slice(0, half);
  const right = schedule.slice(half);

  function amortTable(rowsX, x0, w) {
    const widths = [10, w * 0.22, w * 0.22, w * 0.22, w * 0.34 - 10];
    const headers = ['Yr', 'Payment', 'Interest', 'Principal', 'Closing bal'];
    setFill(NAVY); doc.rect(x0, y, w, 6, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(CREAM);
    let cx = x0;
    headers.forEach(function(h, i){
      const align = i === 0 ? 'left' : 'right';
      const tx = align==='right' ? cx + widths[i] - 2 : cx + 2;
      doc.text(h, tx, y + 4, { align: align });
      cx += widths[i];
    });
    let yy = y + 6;
    rowsX.forEach(function(s, ri){
      if (ri % 2 === 1) { setFill(SOFT_BG); doc.rect(x0, yy, w, 5, 'F'); }
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(INK);
      cx = x0;
      const cs = [String(s.yr), fmt$(s.payment), fmt$(s.interest), fmt$(s.principal), fmt$(s.balance)];
      cs.forEach(function(c, i){
        const align = i === 0 ? 'left' : 'right';
        const tx = align==='right' ? cx + widths[i] - 2 : cx + 2;
        doc.text(c, tx, yy + 3.6, { align: align });
        cx += widths[i];
      });
      yy += 5;
    });
    return yy;
  }
  const colW = (CW - 4) / 2;
  const yLeft = amortTable(left, M, colW);
  const yRight = right.length ? amortTable(right, M + colW + 4, colW) : y + 6;
  y = Math.max(yLeft, yRight) + 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(MUTED);
  doc.text('Schedule assumes the best-rate package and constant monthly payments.', M, y);

  // ═══════════════════ PAGE 9 — OPTIMISATION + NEXT STEPS ═══════════════════
  y = pageChrome('Optimisation · Next Steps');
  y = sectionHeader(y, 'Optimisation playbook', 'Concrete levers to lower your monthly or qualify for more.',
    'Each lever is run through the same MAS 4% stress floor.');

  const tips = [];
  const tenureCap = r.propertyTenureCap || (r.inp.propertyType === 'hdb' ? 30 : 35);
  if (r.inp.tenure < tenureCap) {
    const newT = Math.min(tenureCap, r.inp.tenure + 5);
    const newM = pmt(r.inp.loan, r.bestRate, newT);
    tips.push({
      title: 'Stretch tenure to ' + newT + ' years',
      body: 'Drops your monthly to ' + fmt$(newM) + ' (–' + fmt$(r.monthlyBest - newM) + '/mo at ' + (r.bestRate*100).toFixed(2) + '%). Trade-off: more total interest paid.',
    });
  }
  if (r.inp.tenure > 15) {
    const newT = r.inp.tenure - 5;
    const newM = pmt(r.inp.loan, r.bestRate, newT);
    tips.push({
      title: 'Shorten tenure to ' + newT + ' years',
      body: 'Monthly rises to ' + fmt$(newM) + ', but you save substantial total interest. Use this if monthly headroom is comfortable.',
    });
  }
  if (tdsrFail && r.minIncomePass > r.inp.income) {
    const gap = r.minIncomePass - r.inp.income;
    tips.push({
      title: 'Increase qualifying income by ' + fmt$(gap) + '/mo',
      body: 'A pledge of ' + fmt$(Math.ceil(gap*48)) + ' (counted at 100%/48 mths) or show-funds of ' + fmt$(Math.ceil(gap*48/0.30)) + ' (30%/48 mths) gets you there under MAS rules.',
    });
  }
  if (tdsrFail && r.maxLoanAffordable < r.inp.loan) {
    const reduce = r.inp.loan - r.maxLoanAffordable;
    tips.push({
      title: 'Reduce loan by ' + fmt$(reduce),
      body: 'Borrow ' + fmt$(r.maxLoanAffordable) + ' instead — fits inside the ' + (r.msrApplies?'MSR':'TDSR') + ' cap. Top up the difference with cash/CPF.',
    });
  }
  if (tdsrFail && !r.msrApplies && r.inp.debts > 0) {
    tips.push({
      title: 'Pay down existing debts',
      body: 'You\'re carrying ' + fmt$(r.inp.debts) + '/mo. Every $1 of debt cleared = $1 of mortgage capacity gained.',
    });
  }
  if (sel.lockInYears) {
    tips.push({
      title: 'Plan for refinance at year ' + sel.lockInYears,
      body: 'Set a reminder ~4 months before lock-in expiry. Refinancing every 2–3 years is the biggest single lever to lower lifetime interest.',
    });
  }

  if (!tips.length) {
    setFill(GREEN_SOFT); doc.rect(M, y, CW, 22, 'F'); setFill(GREEN); doc.rect(M, y, 1.8, 22, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(11); setColor(GREEN_DK);
    doc.text('You\'re already in a strong position', M + 6, y + 9);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); setColor(INK_2);
    doc.text('No obvious levers — focus on locking in your selected rate and setting a refinance reminder.', M + 6, y + 16);
    y += 28;
  } else {
    tips.slice(0, 6).forEach(function(t, i){
      setFill(SURFACE); doc.rect(M, y, CW, 18, 'F');
      setDraw(BORDER); doc.rect(M, y, CW, 18);
      setFill(GOLD); doc.rect(M, y, 1.5, 18, 'F');
      setFill(GOLD); doc.circle(M + 9, y + 9, 4, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); setColor(CREAM);
      doc.text(String(i+1), M + 9, y + 10.5, { align: 'center' });
      doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
      doc.text(t.title, M + 16, y + 7);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(INK_2);
      doc.text(doc.splitTextToSize(t.body, CW - 22), M + 16, y + 12);
      y += 21;
    });
  }
  y += 4;

  if (y < H - 80) {
    y = sectionHeader(y, 'Next steps', 'Three things to do this week.', '');
    const steps = [
      ['Lock in your rate.', 'WhatsApp us with your preferred package and we handle the bank application end-to-end.'],
      ['Confirm your IPA / OTP timeline.', 'We coordinate with the bank, conveyancing lawyer, and CPF for a smooth completion.'],
      ['Set a refinance reminder.', 'For ' + (sel.lockInYears||2) + ' year' + ((sel.lockInYears||2)>1?'s':'') + ' from completion. We\'ll reach out 6 weeks before — free service.'],
    ];
    steps.forEach(function(s, i){
      doc.setFont('times','normal'); doc.setFontSize(20); setColor(GOLD);
      doc.text(String(i+1), M, y + 5);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(INK);
      doc.text(s[0], M + 10, y + 1);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setColor(INK_2);
      doc.text(doc.splitTextToSize(s[1], CW - 12), M + 10, y + 6);
      y += 14;
    });
  }

  const discY = H - 32;
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(FAINT);
  const disc = 'Indicative figures only as of ' + dateStr + '. Subject to bank credit assessment, valuation, and prevailing IRAS / MAS / HDB rules. Stress-test rate of 4% is the MAS minimum for residential TDSR / MSR. ABSD calculated using IRAS rates effective 27 April 2023: SC 1st prop 0%, SC 2nd 20%, SC 3rd+ 30%, PR 1st 5%, PR 2nd+ 30%, Foreigner 60%. BSD calculated using IRAS tiered rates. Married SC + SC couples buying matrimonial home jointly may qualify for ABSD remission — confirm with us. This report does not constitute financial advice; for personalised guidance speak to a Nexus mortgage broker. Banks pay our referral fee — service is free to you.';
  doc.text(doc.splitTextToSize(disc, CW), M, discY);

  return {
    base64: doc.output('datauristring').split(',')[1],
    filename: 'nexus-mortgage-report-' + new Date().toISOString().slice(0, 10) + '.pdf',
  };
}
