/**
 * Nexus Mortgage — Meta Instant-Form lead poller (Google Apps Script).
 * Paste this INTO THE SAME bound Apps Script project as lp-leads.gs
 * (the one attached to the "Nexus — Leads" sheet), so it appends rows in the
 * IDENTICAL A..W schema and can reuse notifyNewLead() for instant Telegram alerts.
 *
 * WHAT IT DOES
 *  Every ~5 min (time trigger) it pulls NEW leads from each Meta Instant Form via the
 *  Graph API and appends them to the sheet exactly like an LP lead. The Nexus Lead Desk
 *  CRM trigger then enriches N..T as usual — Meta leads look native in your CRM.
 *
 * ONE-TIME SETUP (~3 min)
 *  1. Open the "Nexus — Leads" sheet → Extensions → Apps Script.
 *  2. Add a new file (＋ → Script), name it "MetaLeads", paste THIS whole file, Save.
 *  3. Project Settings → Script properties → Add:
 *        META_LEADS_TOKEN = <System User token that INCLUDES the leads_retrieval scope>
 *     (Regenerate the token in Business Settings → System Users if the current one
 *      lacks leads_retrieval — re-tick it, everything else stays the same.)
 *  4. In the editor, select function `metaLeads_installTrigger` → Run once → Allow.
 *     That creates the 5-min trigger. (Grant the UrlFetchApp / Sheets scopes when asked.)
 *  5. Optional test: select `metaLeads_poll` → Run. Check the Execution log + sheet.
 *
 * NOTES
 *  - Dedupe: last-seen created_time per form is stored in Script Properties, so reruns
 *    never double-post. First run backfills only the last 24h.
 *  - Phone is written with a leading apostrophe (TEXT) so "+65 ..." isn't read as a formula.
 *  - Meta Instant Forms give no gclid; col U stays blank, col W carries meta metadata
 *    (campaign + lead id + extra qualifiers) so the LP tracking columns keep their meaning.
 */

// ---- form registry: keep in sync with meta_build.py ----
var META_FORMS = {
  refi: { id: '1202028045386829', source: 'meta-refi', purpose: 'Refinance' },
  home: { id: '1338289938287068', source: 'meta-home', purpose: 'New purchase' }
};
var META_API = 'https://graph.facebook.com/v21.0/';

function metaLeads_token_() {
  var t = PropertiesService.getScriptProperties().getProperty('META_LEADS_TOKEN');
  if (!t) throw new Error('Set Script Property META_LEADS_TOKEN (needs leads_retrieval scope).');
  return t;
}

/** field_data [{name,values:[..]}] -> {name: value} */
function metaLeads_map_(fieldData) {
  var m = {};
  (fieldData || []).forEach(function (f) {
    m[f.name] = (f.values && f.values[0]) || '';
  });
  return m;
}

/** read a custom answer by key, tolerating Meta's label-slug fallback names */
function metaLeads_pick_(m, key, contains) {
  if (m[key]) return m[key];
  for (var k in m) { if (contains && k.indexOf(contains) !== -1) return m[k]; }
  return '';
}

function metaLeads_poll() {
  var token = metaLeads_token_();
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return; }

  try {
    Object.keys(META_FORMS).forEach(function (key) {
      var form = META_FORMS[key];
      var sinceKey = 'META_SINCE_' + key;
      var since = Number(props.getProperty(sinceKey) || 0);
      if (!since) since = Math.floor(Date.now() / 1000) - 86400; // first run: last 24h only

      var url = META_API + form.id + '/leads'
        + '?fields=id,created_time,field_data'
        + '&filtering=' + encodeURIComponent(JSON.stringify(
            [{ field: 'time_created', operator: 'GREATER_THAN', value: since }]))
        + '&limit=100&access_token=' + encodeURIComponent(token);

      var maxSeen = since;
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        Logger.log('Meta leads ' + key + ' HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
        return;
      }
      var rows = (JSON.parse(res.getContentText()).data) || [];
      // oldest first so the sheet keeps chronological order
      rows.sort(function (a, b) { return new Date(a.created_time) - new Date(b.created_time); });

      rows.forEach(function (ld) {
        var ts = Math.floor(new Date(ld.created_time).getTime() / 1000);
        if (ts <= since) return;                 // already processed
        if (ts > maxSeen) maxSeen = ts;
        var m = metaLeads_map_(ld.field_data);

        var name  = m.full_name || m.first_name || '';
        var phone = m.phone_number || '';
        var email = m.email || '';
        var property = metaLeads_pick_(m, 'property', 'property');

        var loanOrPrice, currentRate, stage, extra;
        if (key === 'refi') {
          loanOrPrice = metaLeads_pick_(m, 'loan', 'loan');
          currentRate = metaLeads_pick_(m, 'rate', 'rate');
          stage       = metaLeads_pick_(m, 'situation', 'situation');
          extra       = '';
        } else {
          loanOrPrice = metaLeads_pick_(m, 'price', 'price');
          currentRate = '';
          stage       = metaLeads_pick_(m, 'stage', 'stage');
          extra       = metaLeads_pick_(m, 'citizenship', 'citizen');
        }

        var wMeta = ['meta', form.source, 'leadid=' + ld.id];
        if (extra) wMeta.push('citizenship=' + extra);

        sheet.appendRow([
          ld.created_time,                 // A Timestamp
          name,                            // B Name
          "'" + phone,                     // C Mobile (TEXT)
          email,                           // D Email
          form.source,                     // E Campaign/Source
          loanOrPrice,                     // F Loan Amount / Purchase price
          currentRate,                     // G Current Rate (refi)
          stage || 'meta-lead',            // H Stage
          'instant-form',                  // I Page URL
          '',                              // J Status
          form.purpose,                    // K Purpose
          property,                        // L Property Type
          '',                              // M Property Status
          '', '', '', '', '', '', '',      // N..T — Lead Desk CRM owns these, leave blank
          '',                              // U GCLID (none from Meta)
          '',                              // V Other click IDs
          wMeta.join(' | ')                // W meta metadata
        ]);

        // Instant Telegram alert (reuses notifyNewLead from lp-leads.gs in this project)
        try {
          notifyNewLead(
            { source: form.source, purpose: form.purpose, propertyType: property,
              loanAmount: loanOrPrice, currentRate: currentRate, pageUrl: 'Meta Instant Form' },
            { name: name, phone: phone, email: email });
        } catch (e) { Logger.log('notify skip: ' + e); }
      });

      props.setProperty(sinceKey, String(maxSeen));
    });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Run ONCE to create the recurring 5-minute poll trigger. */
function metaLeads_installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'metaLeads_poll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('metaLeads_poll').timeBased().everyMinutes(5).create();
  Logger.log('Meta lead poller installed — every 5 min.');
}
