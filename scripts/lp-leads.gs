/**
 * Nexus Mortgage — Landing-Page lead endpoint (Google Apps Script Web App).
 * Appends each LP form submission as a row in the bound "Nexus — Leads" sheet.
 * No Make, no Notion — the LP form POSTs straight here.
 *
 * DEPLOY (one-time, ~3 min):
 * 1. Open the sheet "Nexus — Leads (Ads + Free Report)" → Extensions → Apps Script.
 * 2. Delete the default code, paste THIS file, Save.
 * 3. Deploy → New deployment → gear icon → type: Web app.
 *    - Description: "Nexus LP leads"
 *    - Execute as: Me
 *    - Who has access: Anyone        ← important (lets the form post without login)
 * 4. Deploy → Authorize access (sign in, Allow). Copy the Web app URL
 *    (looks like https://script.google.com/macros/s/AKfyc.../exec).
 * 5. Send Claude that /exec URL — it wires the 3 LP forms + the CSP allowance.
 *
 * Columns expected (row 1 headers already set):
 * Timestamp | Name | Mobile | Email | Campaign / Source | Loan Amount | Current Rate (refi) | Stage | Page URL | Status
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // avoid two submissions clobbering the same row
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var lead = data.lead || {};
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
      ''  // Status — you fill
    ]);
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

// Health check — visit the /exec URL in a browser; should say "OK".
function doGet() {
  return ContentService.createTextOutput('Nexus LP lead endpoint — OK');
}
