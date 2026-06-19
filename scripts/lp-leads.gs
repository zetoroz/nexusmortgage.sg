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
      join([trk('utmSource'), trk('utmMedium'), trk('utmCampaign'), trk('utmTerm'), trk('utmContent')]) // W UTM
    ]);

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

  var lines = [];
  lines.push('🔔 <b>New lead — ' + esc(name) + '</b>');
  lines.push('<i>via ' + esc(source) + ' · call within the hour</i>');
  lines.push('');
  if (phone)             lines.push('📱 ' + esc(phone));
  if (email)             lines.push('✉️ ' + esc(email));
  if (data.purpose)      lines.push('🎯 ' + esc(data.purpose));
  var prop = [data.propertyType, data.propertyStatus].filter(String).join(' · ');
  if (prop)              lines.push('🏠 ' + esc(prop));
  if (data.loanAmount)   lines.push('💰 Loan: ' + esc(data.loanAmount));
  if (data.currentRate)  lines.push('📉 Current rate: ' + esc(data.currentRate));
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
