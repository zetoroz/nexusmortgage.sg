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
 * Columns: Timestamp | Name | Mobile | Email | Campaign/Source | Loan Amount |
 *          Current Rate (refi) | Stage | Page URL | Status |
 *          Purpose | Property Type | Property Status |
 *          GCLID | Other Click IDs | UTM
 *
 * NOTE (2026-06-13b): added cols N/O/P. GCLID (col N) is the key one — store it so
 * when a loan FUNDS you can import an offline conversion back to Google Ads and let
 * Smart Bidding optimise to closes, not just form-fills. Add headers N1/O1/P1 =
 * GCLID | Other Click IDs | UTM.
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
      data.propertyStatus || '', // Property Status (Resale / BUC)
      trk('gclid'),              // GCLID — for Google offline-conversion import on funded loans
      join([trk('gbraid'), trk('wbraid'), trk('msclkid'), trk('fbclid')]),  // Other click IDs
      join([trk('utmSource'), trk('utmMedium'), trk('utmCampaign'), trk('utmTerm'), trk('utmContent')]) // UTM
    ]);

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
