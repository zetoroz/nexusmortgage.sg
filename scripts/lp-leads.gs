/**
 * Nexus Mortgage — Landing-Page lead endpoint (Google Apps Script Web App).
 * Appends each LP form submission as a row in the bound "Nexus — Leads" sheet,
 * then sends a server-side Meta Conversions API (CAPI) "Lead" event
 * (deduplicated with the browser Pixel via the shared eventId).
 * No Make, no Notion — the LP form POSTs straight here.
 *
 * DEPLOY (one-time, ~4 min):
 * 1. Open the sheet "Nexus — Leads (Ads + Free Report)" → Extensions → Apps Script.
 * 2. Delete the default code, paste THIS file, Save.
 * 3. (CAPI) Project Settings → Script properties → Add:
 *      META_PIXEL_ID    = 27348447628084102
 *      META_CAPI_TOKEN  = <Conversions API token from Meta Events Manager
 *                          → Settings → Conversions API → Generate access token>
 *    Leaving META_CAPI_TOKEN unset simply skips CAPI (sheet logging still works).
 * 4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 * 5. Authorize (Allow). The /exec URL is unchanged, so the LP forms keep working.
 *    Redeploy as a NEW version each time you paste an update.
 *
 * Columns: A Timestamp | B Name | C Mobile | D Email | E Campaign/Source | F Loan Amount |
 *          G Current Rate (refi) | H Stage | I Page URL | J Status |
 *          K Purpose | L Property Type | M Property Status |
 *          N Lead ID | O Owner | P Priority | Q Status | R Follow-up | S Notes | T Updated
 *             ↑↑↑ ALL owned by the Nexus Lead Desk CRM — doPost leaves N..T blank ↑↑↑
 *          U GCLID | V Other Click IDs | W UTM
 *
 * NOTE (2026-06-13d): the bound sheet is ALSO the Nexus Lead Desk CRM, which owns the
 * 7 columns N..T (Lead ID/Owner/Priority/Status/Follow-up/Notes/Updated) and enriches every
 * new row via a trigger. So LP tracking lives in U/V/W (the empty zone past T): doPost writes
 * 7 blanks for N..T then GCLID/click-ids/UTM in U/V/W. GCLID (col U) is the key one — when a
 * loan FUNDS, import an offline conversion to Google Ads so Smart Bidding optimises to closes,
 * not form-fills. Add headers U1/V1/W1 = GCLID | Other Click IDs | UTM.
 *
 * NOTE (2026-06-13): the home-loan LP qualifier funnel now sends purpose,
 * propertyType and propertyStatus. They are appended as columns 11-13 so the
 * first 10 columns (and every historical row) stay exactly where they were.
 * Add three header cells to the sheet: Purpose | Property Type | Property Status.
 *
 * NOTE (2026-07-30): FREE-REPORT branch. The /free-report calculator now POSTs
 * here too (source "nexusmortgage.sg/free-report"), replacing the Make k85r
 * scenario. Two stages:
 *   - stage "lead-capture": append row (A-M lead + U/V/W tracking + X..AO calc
 *     data, N..T left blank for the CRM) + Telegram + Meta CAPI.
 *   - stage "send-report": update the lead's existing row (stage, selected
 *     package, emailed-at), email the client-side-built PDF (base64 in payload)
 *     via GmailApp from the danler@nexusmortgage.sg alias, Telegram note.
 *     No CAPI (the Lead event already fired at lead-capture).
 * Calc columns X..AO are auto-headered on first free-report submission.
 *
 * ⚠️ REDEPLOY WARNING: GmailApp adds a NEW OAuth scope (mail.google.com).
 * After pasting this update you MUST open any function in the editor → Run →
 * grant the new permission, THEN Deploy → New version. A missing scope fails
 * silently inside try/catch (same trap as the UrlFetchApp/Telegram outage).
 * Also confirm danler@nexusmortgage.sg is a registered "Send mail as" alias in
 * Gmail Settings → Accounts of the deploying account — GmailApp can only send
 * from registered aliases (we fall back to the account's own address if not).
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // avoid two submissions clobbering the same row
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var lead = data.lead || {};
    // tracking fields: lean LPs send top-level, free-report nests under data.tracking
    var trk = function(k){ return (data.tracking && data.tracking[k]) || data[k] || ''; };
    var join = function(parts){ return parts.filter(function(x){return x;}).join(' | '); };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];

    // GBP weekly-post draft (cloud routine) — Telegram delivery only, NO sheet row.
    if (data.type === 'gbp-draft') {
      var delivered = false;
      try { sendTelegramText(String(data.text || '').slice(0, 3900)); delivered = true; }
      catch (gbpErr) { Logger.log('GBP draft TG error: ' + gbpErr); }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, delivered: delivered }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // FREE-REPORT branch — calculator page sends a much richer payload (inputs/summary/PDF).
    if (String(data.source || '').indexOf('free-report') !== -1) {
      var frResult = handleFreeReport(sheet, data, lead, trk, join);
      return ContentService
        .createTextOutput(JSON.stringify(frResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      lead.name || '',
      "'" + (lead.phone || ''),   // leading apostrophe forces TEXT so "+65 ..." isn't read as a formula
      lead.email || '',
      data.source || data.campaign || '',
      data.loanAmount || '',
      data.currentRate || '',
      data.stage || 'lead-capture',
      data.pageUrl || '',
      '',                       // Status — you fill
      data.purpose || '',        // Purpose (New purchase / Refinance)
      data.propertyType || '',   // Property Type (HDB / Condo-EC / Landed / Commercial)
      data.propertyStatus || '', // M Property Status (Resale / BUC)
      '', '', '', '', '', '', '', // N..T — owned by the Nexus Lead Desk CRM (Lead ID/Owner/Priority/Status/Follow-up/Notes/Updated). Leave blank.
      trk('gclid'),              // U GCLID — for Google offline-conversion import on funded loans
      join([trk('gbraid'), trk('wbraid'), trk('msclkid'), trk('fbclid')]),  // V Other click IDs
      join([trk('utmSource'), trk('utmMedium'), trk('utmCampaign'), trk('utmTerm'), trk('utmContent')]), // W UTM
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // X..AO — free-report calc block, blank for plain forms
      data.message || data.notes || '' // AP Message — homepage/contact "notes" field
    ]);
    try { ensureExtraHeaders(sheet); } catch (hErr) { Logger.log('Headers error: ' + hErr); }

    // Instant new-lead alert to Dan (best-effort — never block lead capture).
    try { notifyNewLead(data, lead); } catch (mailErr) { Logger.log('Notify error: ' + mailErr); }

    // Server-side Meta CAPI (best-effort — never block lead capture).
    try { sendMetaCapi(data, lead); } catch (capiErr) { Logger.log('CAPI error: ' + capiErr); }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ===================== FREE-REPORT (calculator) branch ===================== */

// Calc-data columns start at X (24). N..T (14-20) stay CRM-owned, U/V/W (21-23) = tracking.
var FR_COL_START = 24;                 // X
var FR_COL_STAGE = 8;                  // H
var FR_COL_SELECTED = 40;              // AN Selected Package
var FR_COL_EMAILED = 41;               // AO Report Emailed At
var FR_HEADERS = [
  'Mode', 'Property Price', 'Tenure (yrs)', 'Income (effective)', 'Borrower Incomes',
  'Borrower Ages', 'Monthly Debts', 'CPF OA', 'Cash on Hand', 'Best Rate', 'Best Bank',
  'Best Package', 'Monthly Payment', 'TDSR Usage', 'Max Loan', 'Capped By',
  'Selected Package', 'Report Emailed At',
  'Message' // AP — homepage/contact "notes" field (plain-form rows leave X..AO blank)
];

function handleFreeReport(sheet, data, lead, trk, join) {
  var inp = data.inputs || {};
  var s = data.summary || {};
  var sel = data.selected || null;
  var stage = data.stage || 'lead-capture';
  var selStr = sel
    ? sel.bank + ' — ' + sel.package + ' @ ' + sel.ratePct + '% (S$' + sel.monthly + '/mo)'
    : '';

  // Normalise free-report fields into the flat shape notifyNewLead/sendMetaCapi expect.
  data.purpose = data.purpose || (inp.mode === 'refinance' ? 'Refinance' : 'New purchase');
  data.propertyType = data.propertyType || inp.propertyType || '';
  data.propertyStatus = data.propertyStatus || ''; // undefined survives filter(String) → stray " · " in Telegram
  data.loanAmount = data.loanAmount || (inp.loan ? 'S$' + Number(inp.loan).toLocaleString('en-SG') : '');
  data.currentRate = data.currentRate ||
    (inp.currentRate ? (inp.currentRate * 100).toFixed(2) + '%' : '');

  try { ensureExtraHeaders(sheet); } catch (hErr) { Logger.log('FR headers error: ' + hErr); }

  var emailed = false, emailError = '';
  if (stage === 'send-report') {
    if (!updateFreeReportRow(sheet, lead, selStr)) {
      appendFreeReportRow(sheet, data, lead, trk, join, inp, s, selStr, stage);
    }
    try {
      emailed = sendReportEmail(data, lead, s, sel);
    } catch (mailErr) {
      emailError = String(mailErr);
      Logger.log('Report email error: ' + mailErr);
    }
    try { notifyNewLead(data, lead); } catch (tgErr) { Logger.log('Notify error: ' + tgErr); }
  } else {
    appendFreeReportRow(sheet, data, lead, trk, join, inp, s, selStr, stage);
    try { notifyNewLead(data, lead); } catch (tgErr) { Logger.log('Notify error: ' + tgErr); }
    try { sendMetaCapi(data, lead); } catch (capiErr) { Logger.log('CAPI error: ' + capiErr); }
  }

  var out = { ok: true, stage: stage };
  if (stage === 'send-report') { out.emailed = emailed; if (emailError) out.emailError = emailError; }
  return out;
}

function appendFreeReportRow(sheet, data, lead, trk, join, inp, s, selStr, stage) {
  sheet.appendRow([
    data.submittedAt || new Date().toISOString(),
    lead.name || '',
    "'" + (lead.phone || ''),
    lead.email || '',
    data.source || 'nexusmortgage.sg/free-report',
    inp.loan || '',
    data.currentRate || '',
    stage,
    data.pageUrl || '',
    '',                        // J Status — you fill
    data.purpose || '',
    data.propertyType || '',
    '',                        // M Property Status — not captured by the calculator
    '', '', '', '', '', '', '', // N..T — CRM-owned, leave blank
    trk('gclid'),
    join([trk('gbraid'), trk('wbraid'), trk('msclkid'), trk('fbclid')]),
    join([trk('utmSource'), trk('utmMedium'), trk('utmCampaign'), trk('utmTerm'), trk('utmContent')]),
    // X..AO — calculator inputs + computed results
    inp.mode || '',
    inp.price || '',
    inp.tenure || '',
    inp.income ? Math.round(inp.income) : '',
    (inp.borrowerIncomes || []).join(' + '),
    (inp.borrowerAges || []).join(' / '),
    inp.debts || '',
    inp.cpfOA || '',
    inp.cashOnHand || '',
    s.bestRate != null ? s.bestRate + '%' : '',
    s.bestBank || '',
    s.bestPackage || '',
    s.monthlyPayment || '',
    s.tdsrUsagePct != null ? s.tdsrUsagePct + '%' : '',
    s.maxLoanAffordable || '',
    s.cappedBy || '',
    selStr,
    stage === 'send-report' ? new Date().toISOString() : '',
    '' // AP Message — free-report has no notes field
  ]);
}

/** Find the lead's lead-capture row (bottom-up, by email + free-report source) and
 *  stamp stage/selected-package/emailed-at on it instead of duplicating a CRM row. */
function updateFreeReportRow(sheet, lead, selStr) {
  var email = String(lead.email || '').trim().toLowerCase();
  if (!email) return false;
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var start = Math.max(2, last - 200); // recent rows only — submission pairs are minutes apart
  var vals = sheet.getRange(start, 1, last - start + 1, 5).getValues(); // A..E
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][3]).trim().toLowerCase() === email &&
        String(vals[i][4]).indexOf('free-report') !== -1) {
      var row = start + i;
      sheet.getRange(row, FR_COL_STAGE).setValue('send-report');
      sheet.getRange(row, FR_COL_SELECTED, 1, 2)
        .setValues([[selStr, new Date().toISOString()]]);
      return true;
    }
  }
  return false;
}

/** One-time: write X1..AO1 headers if the calc block is still headerless. */
function ensureExtraHeaders(sheet) {
  var probe = sheet.getRange(1, FR_COL_START).getValue();
  if (probe !== '' && probe != null) return;
  sheet.getRange(1, FR_COL_START, 1, FR_HEADERS.length).setValues([FR_HEADERS]);
}

/**
 * Email the client-built PDF report to the lead, sent from the
 * danler@nexusmortgage.sg alias (falls back to the account's own address if the
 * alias isn't registered in Gmail → Settings → Accounts → "Send mail as").
 */
function sendReportEmail(data, lead, s, sel) {
  if (!lead.email || !data.reportPdfBase64) return false;
  var blob = Utilities.newBlob(
    Utilities.base64Decode(data.reportPdfBase64),
    data.reportPdfMime || 'application/pdf',
    data.reportPdfFilename || 'nexus-mortgage-report.pdf'
  );

  var firstName = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  var bank = (sel && sel.bank) || s.bestBank || '';
  var pkg = (sel && sel.package) || s.bestPackage || '';
  var rate = (sel && sel.ratePct != null) ? sel.ratePct : s.bestRate;
  var monthly = (sel && sel.monthly) || s.monthlyPayment || '';
  var fmt = function (n) { return Number(n).toLocaleString('en-SG'); };

  var subject = 'Your mortgage report' + (bank ? ' — ' + bank + ' from ' + rate + '%' : '') + ' | Nexus Mortgage';

  var rows = [];
  if (bank) rows.push(['Selected package', bank + (pkg ? ' — ' + pkg : '') + (rate != null ? ' @ ' + rate + '%' : '')]);
  if (monthly) rows.push(['Est. monthly repayment', 'S$' + fmt(monthly) + '/mo']);
  if (s.tdsrUsagePct != null) rows.push(['TDSR usage (4% stress test)', s.tdsrUsagePct + '%']);
  if (s.maxLoanAffordable) rows.push(['Max loan you qualify for', 'S$' + fmt(s.maxLoanAffordable)]);
  var tableRows = rows.map(function (r) {
    return '<tr><td style="padding:8px 16px 8px 0;color:#5a6474;font-size:14px;">' + r[0] +
           '</td><td style="padding:8px 0;color:#122843;font-size:14px;font-weight:600;">' + r[1] + '</td></tr>';
  }).join('');

  var htmlBody =
    '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#122843;">' +
      '<p style="font-size:16px;line-height:1.7;">Hi ' + firstName + ',</p>' +
      '<p style="font-size:16px;line-height:1.7;">Thanks for running the numbers with us — your personalised ' +
        'mortgage report is attached as a PDF.</p>' +
      (tableRows ? '<table style="border-collapse:collapse;margin:16px 0;">' + tableRows + '</table>' : '') +
      '<p style="font-size:16px;line-height:1.7;">Rates move weekly and the attached figures are indicative — ' +
        'when you\'re ready, I\'ll confirm the live package and handle the paperwork with the bank. ' +
        'My service is free to you (banks pay our referral fee).</p>' +
      '<p style="font-size:16px;line-height:1.7;"><a href="https://wa.me/6587520859" ' +
        'style="color:#C4973B;font-weight:600;">WhatsApp me at 8752 0859</a> or just reply to this email.</p>' +
      '<p style="font-size:16px;line-height:1.7;">Dan Ler<br>' +
        '<span style="color:#5a6474;font-size:14px;">Nexus Mortgage — nexusmortgage.sg</span></p>' +
    '</div>';

  var plainBody = 'Hi ' + firstName + ',\n\nThanks for running the numbers with us — your personalised ' +
    'mortgage report is attached as a PDF.\n\n' +
    rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') +
    '\n\nRates move weekly and the attached figures are indicative — when you\'re ready, I\'ll confirm the ' +
    'live package and handle the paperwork with the bank. My service is free to you.\n\n' +
    'WhatsApp me at 8752 0859 (https://wa.me/6587520859) or just reply to this email.\n\n' +
    'Dan Ler\nNexus Mortgage — nexusmortgage.sg';

  var opts = {
    name: 'Dan Ler — Nexus Mortgage',
    replyTo: 'danler@nexusmortgage.sg',
    htmlBody: htmlBody,
    attachments: [blob]
  };
  var alias = 'danler@nexusmortgage.sg';
  try {
    if (GmailApp.getAliases().indexOf(alias) !== -1) opts.from = alias;
  } catch (aliasErr) { Logger.log('Alias check error: ' + aliasErr); }
  GmailApp.sendEmail(lead.email, subject, plainBody, opts);
  return true;
}

/**
 * Instant Telegram alert to Dan the moment a lead lands. Speed-to-contact is the #1
 * mortgage conversion lever — this stops leads sitting unseen in the sheet.
 * Uses UrlFetchApp (already authorized for CAPI) → NO new OAuth scope, no re-auth.
 *
 * SETUP (one-time):
 *  1. Telegram → @BotFather → /newbot → copy the bot token.
 *  2. Send any message to your new bot (so it can DM you), then get your chat id:
 *     message @userinfobot, or open https://api.telegram.org/bot<TOKEN>/getUpdates
 *     and read result[].message.chat.id. For a group: add the bot, post a msg, same getUpdates.
 *  3. Apps Script → Project Settings → Script properties → add:
 *       TELEGRAM_BOT_TOKEN = <token from BotFather>
 *       TELEGRAM_CHAT_ID   = <your chat id>  (comma-separate for multiple recipients)
 *  Leaving either unset simply skips the alert (sheet logging still works).
 */
function notifyNewLead(data, lead) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chats = props.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chats) return; // not configured — skip silently.

  var name   = lead.name  || '(no name)';
  var phone  = lead.phone || '';
  var email  = lead.email || '';
  var source = data.source || data.campaign || 'lp';
  var waNum  = String(phone).replace(/\D/g, '');
  var esc = function (s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

  var isReportSent = data.stage === 'send-report';
  var lines = [];
  lines.push(isReportSent
    ? '📄 <b>Report emailed — ' + esc(name) + '</b>'
    : '🔔 <b>New lead — ' + esc(name) + '</b>');
  lines.push(isReportSent
    ? '<i>via ' + esc(source) + ' · picked a package — hot, call now</i>'
    : '<i>via ' + esc(source) + ' · call within the hour</i>');
  lines.push('');
  if (phone)             lines.push('📱 ' + esc(phone));
  if (email)             lines.push('✉️ ' + esc(email));
  if (data.purpose)      lines.push('🎯 ' + esc(data.purpose));
  var prop = [data.propertyType, data.propertyStatus].filter(String).join(' · ');
  if (prop)              lines.push('🏠 ' + esc(prop));
  if (data.loanAmount)   lines.push('💰 Loan: ' + esc(data.loanAmount));
  if (data.currentRate)  lines.push('📉 Current rate: ' + esc(data.currentRate));
  var msg = data.message || data.notes || '';
  if (msg)               lines.push('📝 ' + esc(String(msg).slice(0, 300)));
  // Free-report extras: what the calculator showed them / what they picked.
  var s = data.summary || {};
  if (data.selected && data.selected.bank) {
    lines.push('✅ Chose: ' + esc(data.selected.bank +
      (data.selected.package ? ' — ' + data.selected.package : '') +
      (data.selected.ratePct != null ? ' @ ' + data.selected.ratePct + '%' : '') +
      (data.selected.monthly ? ' · S$' + data.selected.monthly + '/mo' : '')));
  } else if (s.bestBank) {
    lines.push('🏆 Best shown: ' + esc(s.bestBank +
      (s.bestRate != null ? ' @ ' + s.bestRate + '%' : '') +
      (s.monthlyPayment ? ' · S$' + s.monthlyPayment + '/mo' : '')));
  }
  if (s.tdsrUsagePct != null) {
    lines.push('📊 TDSR ' + esc(String(s.tdsrUsagePct)) + '%' +
      (s.maxLoanAffordable ? ' · max loan S$' + esc(String(s.maxLoanAffordable)) : ''));
  }
  if (data.pageUrl)      lines.push('🔗 ' + esc(data.pageUrl));
  var actionLinks = [];
  if (waNum)  actionLinks.push('<a href="https://wa.me/' + waNum + '">WhatsApp now</a>');
  var crmUrl = props.getProperty('CRM_URL') ||
    'https://script.google.com/macros/s/AKfycbzFKa9CrkQRV_P1RdtlvpJ3sDzoi6lw8Q66N4DBUyIHYKcxfJDohSHDIvKTzYnv3N8B/exec';
  if (crmUrl) actionLinks.push('<a href="' + crmUrl + '">Open Lead Desk CRM</a>');
  if (actionLinks.length) lines.push('\n👉 ' + actionLinks.join('  ·  '));

  var text = lines.join('\n');
  String(chats).split(',').forEach(function (chatId) {
    chatId = chatId.trim(); if (!chatId) return;
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId, text: text,
          parse_mode: 'HTML', disable_web_page_preview: true
        }),
        muteHttpExceptions: true
      });
    } catch (e) { Logger.log('Telegram send error: ' + e); }
  });
}

/** Plain-text Telegram broadcast to the configured chat(s) — used by the GBP
 *  weekly-post routine. No parse_mode so pasted drafts can't break on < > &. */
function sendTelegramText(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chats = props.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chats || !text) return;
  String(chats).split(',').forEach(function (chatId) {
    chatId = chatId.trim(); if (!chatId) return;
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
  });
}

/** SHA-256 -> lowercase hex (Meta requires hashed em/ph). */
function sha256hex(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Send a "Lead" event to Meta Conversions API, deduped via eventId. */
function sendMetaCapi(data, lead) {
  var props = PropertiesService.getScriptProperties();
  var pixelId = props.getProperty('META_PIXEL_ID') || '27348447628084102';
  var token = props.getProperty('META_CAPI_TOKEN');
  if (!token) return; // CAPI not configured yet — skip silently.

  var email = (lead.email || '').trim().toLowerCase();
  var phoneDigits = String(lead.phone || '').replace(/\D/g, ''); // e.g. "6512345678"

  var userData = {};
  if (email) userData.em = [sha256hex(email)];
  if (phoneDigits) userData.ph = [sha256hex(phoneDigits)];
  if (data.fbp) userData.fbp = data.fbp;
  if (data.fbc) userData.fbc = data.fbc;
  if (data.userAgent) userData.client_user_agent = data.userAgent;

  var payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.eventId || undefined,          // dedup with browser Pixel
      action_source: 'website',
      event_source_url: data.pageUrl || 'https://nexusmortgage.sg/',
      user_data: userData,
      custom_data: {
        currency: 'SGD', value: 50,
        lead_source: data.source || data.campaign || 'lp',
        lead_purpose: data.purpose || '',
        property_type: data.propertyType || '',
        loan_amount_band: data.loanAmount || ''
      }
    }]
  };

  var url = 'https://graph.facebook.com/v21.0/' + pixelId + '/events?access_token=' + encodeURIComponent(token);
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  Logger.log('CAPI ' + res.getResponseCode() + ': ' + res.getContentText());
}

// Health check — visit the /exec URL in a browser; should say "OK".
function doGet() {
  return ContentService.createTextOutput('Nexus LP lead endpoint — OK');
}
