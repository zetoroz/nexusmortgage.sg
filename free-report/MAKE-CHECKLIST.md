# Make Scenario — Build Checklist

This is your sequenced punch list to finish wiring the free-report scenario.
What's already done is at the top; what you need to click through is below it.

---

## Already done

- [x] Make webhook created → `https://hook.us2.make.com/k85r6qpuqd3p3npd9w7xe86jyc8dl7y9`
- [x] Webhook URL pasted into `/free-report/index.html` line 1282
- [x] Notion database `Leads — Free Report` created in Private workspace with all 22 properties:
      Name, Email, Phone, Submitted, Loan amount, Tenure (years), Monthly income,
      Best rate (%), Best bank, Monthly payment, TDSR usage (%), TDSR pass, MSR pass,
      Mode, Property type, Status, Follow-up by, Borrowers, IWAA (years), LTV %,
      Tenure exceeds IWAA, Notes
- [x] Make integration granted access to Notion DB
- [x] Sample payload sent so Make webhook learned the data shape
- [x] **Router added** to scenario with two output branches
- [x] **Path A: Notion Create a Data Source Item — COMPLETE and tested**
      20 of 22 fields mapped: Name, Email, Phone, Submitted, Loan amount, Tenure (years),
      Monthly income, Best rate (%), Best bank, Monthly payment, TDSR usage (%),
      TDSR pass, MSR pass, Mode, Property type, Status='New' (constant),
      Borrowers, IWAA (years), LTV %, Tenure exceeds IWAA. (Notes left blank,
      Follow-up by left empty — see Step A below to add `now+24h` formula.)
      Verified end-to-end: test row "Path A Test" successfully created in Notion DB.
- [x] **Scenario ACTIVATED** — schedule set to "Immediately as data arrives", max 60 runs/min.
      Verified live: webhook POST automatically fires scenario and creates Notion row.
      Lead capture is operational without manual intervention.
- [x] **Path C: Telegram alert — COMPLETE and tested**
      Bot @Nexus_Mortgage_bot, connection "Nexus Mortgage Lead Alerts" in Make.
      Chat ID 439126495 (DANLZQ). Message includes lead.name, phone | email,
      Best: bestBank @ bestRate %, Monthly: S$ monthlyPayment.
      Verified end-to-end: live webhook trigger sends Telegram alert to your phone.
- [x] **Path B: Hostinger SMTP email — COMPLETE (body only) and tested**
      Connection "My Hostinger (SMTP) connection" — smtp.hostinger.com:465 TLS,
      auth as danler@nexusmortgage.sg, sends from alias hello@nexusmortgage.sg.
      Subject: "Your personalised mortgage report from Nexus".
      HTML body includes lead name, best bank/rate, monthly payment, broker
      callback line, WhatsApp number.
      Verified end-to-end: email lands at recipient inbox.

      **PDF attachment NOW WORKING.** Final formula in Data field:
      `toBinary(reportPdfBase64; base64)` — with NO space after the semicolon
      and NO quotes around `base64`. File name field maps `reportPdfFilename`.
      Verified: real PDF base64 in payload arrives at recipient as a valid
      openable PDF.

---

## Step 0 — Two small cleanups in Notion (30 seconds)

The Mode, Property type, and Status columns are Select type but have no options yet.
Open the database and add:

| Column         | Options to add                            |
| -------------- | ----------------------------------------- |
| Mode           | `Purchase`, `Refinance`                   |
| Property type  | `HDB`, `Private`                          |
| Status         | `New` (default), `Contacted`, `Won`, `Lost` |

Click any column header → "Edit property" → type the option names. Or just leave
them — Notion will auto-add options the first time Make writes a value.

---

## Step 1 — Fix webhook name in Make (10 seconds)

The webhook name got mangled when Make auto-attached an existing one.

1. Open the scenario (us2.make.com → Scenarios → "Integration Webhooks")
2. Click the webhook module → click the name dropdown → click "Edit"
3. Rename to: `Nexus Free Report — Lead`
4. Save

---

## Step 2 — Trigger a sample payload (so Make knows the data shape)

Make can't map fields until it has seen one real payload.

1. In the scenario, the webhook module shows "Make is now listening for the data..."
2. In a separate terminal, run:

```bash
curl -X POST https://hook.us2.make.com/k85r6qpuqd3p3npd9w7xe86jyc8dl7y9 \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "source": "nexusmortgage.sg/free-report",
  "submittedAt": "2026-04-30T08:14:22.918Z",
  "lead": { "name": "Test Lead", "phone": "+65 9123 4567", "email": "test@example.com" },
  "inputs": {
    "mode": "purchase", "propertyType": "hdb",
    "price": 800000, "loan": 600000, "tenure": 25,
    "income": 27500, "debts": 0,
    "borrowers": 4,
    "borrowerIncomes": [12000,8000,4500,3000],
    "borrowerAges": [35,32,60,28],
    "iwaa": 37.45
  },
  "summary": {
    "bestRate": 1.45, "bestBank": "DBS", "bestPackage": "Fixed 2Y",
    "monthlyPayment": 2386, "tdsrUsagePct": 11.5, "msrUsagePct": 11.5,
    "tdsrPass": true, "msrPass": true, "msrApplies": true,
    "iwaa": 37.5, "fullLtvTenureCap": 25, "ltvPct": 75,
    "tenureExceedsIwaa": false,
    "totalInterest": 115800, "totalPaid": 715800,
    "annualSavings": null, "lockInSavings": null
  },
  "bankRates": [
    { "bank": "DBS", "package": "Fixed 2Y", "ratePct": 1.45, "monthly": 2386, "lockInCost": 57264 }
  ],
  "reportPdfBase64": "JVBERi0xLjMKJWZha2U=",
  "reportPdfFilename": "test.pdf",
  "reportPdfMime": "application/pdf"
}
JSON
```

Or just submit the live form once at nexusmortgage.sg/free-report after deploy.

Make will show "Successfully determined" — now all the field mappings work.

---

## Step 3 — Router — DONE

Router is already in scenario with two output branches. Path A (Notion) is wired on the 1st branch.
For additional paths (B / C / D), click the empty `+` on a router output and add a new module.

---

## Step A2 — (optional) Add Follow-up by formula

Path A's Notion module has Follow-up by left empty. To set it to "24 hours from now":

1. Open the scenario → click the Notion module
2. Scroll to "Follow-up by" → "Start Time" field
3. Click the field → in the variable picker, click the `()` formula tab (top of picker)
4. Type: `addHours(now; 24)` (Make uses semicolons)
5. Save

---

## Step 4 — Path A: Notion → Create Lead — DONE

Path A is complete and tested end-to-end. The "Path A Test" row appeared in your Notion DB
with all critical fields (Name, Email, Phone, Submitted, Loan amount, Tenure, Monthly income,
Best rate, Best bank, Monthly payment, TDSR usage, TDSR pass, MSR pass, Mode, Property type,
Status='New', Borrowers, IWAA, LTV %, Tenure exceeds IWAA).

Original spec retained below for reference / if you ever need to rebuild:

1. From router output 1, click `+` → search "notion" → **Notion → Create a Database Item**
2. Authenticate Notion (your "Integration Notion" connection should already exist — pick it)
3. Database: select `Leads — Free Report`
4. Map fields (lead.name → Name, etc.):

| Notion property        | Make value                  |
| ---------------------- | --------------------------- |
| Name                   | `{{1.lead.name}}`           |
| Email                  | `{{1.lead.email}}`          |
| Phone                  | `{{1.lead.phone}}`          |
| Submitted              | `{{1.submittedAt}}`         |
| Mode                   | `{{1.inputs.mode}}`         |
| Property type          | `{{1.inputs.propertyType}}` |
| Loan amount            | `{{1.inputs.loan}}`         |
| Tenure (years)         | `{{1.inputs.tenure}}`       |
| Monthly income         | `{{1.inputs.income}}`       |
| Best rate (%)          | `{{1.summary.bestRate}}`    |
| Best bank              | `{{1.summary.bestBank}}`    |
| Monthly payment        | `{{1.summary.monthlyPayment}}` |
| TDSR usage (%)         | `{{1.summary.tdsrUsagePct}}` |
| TDSR pass              | `{{1.summary.tdsrPass}}`    |
| MSR pass               | `{{1.summary.msrPass}}`     |
| Status                 | `New`                       |
| Follow-up by           | `{{addHours(now; 24)}}`     |
| Borrowers              | `{{1.inputs.borrowers}}`    |
| IWAA (years)           | `{{1.summary.iwaa}}`        |
| LTV %                  | `{{1.summary.ltvPct}}`      |
| Tenure exceeds IWAA    | `{{1.summary.tenureExceedsIwaa}}` |
| Notes                  | (leave blank)               |

**Module IMPORTANT:** Save the page ID this module returns — Path D uses it.

---

## Step 5 — Path B: Gmail → Send report to user

1. From router output 2, `+` → search "gmail" → **Gmail → Send an email**
2. Connect Gmail (zetoroz@gmail.com)
3. Configure:
   - **To:** `{{1.lead.email}}`
   - **Subject:** `Your personalised mortgage report from Nexus`
   - **Content type:** HTML
   - **Content:**

```html
<p>Hi {{1.lead.name}},</p>
<p>Thanks for using Nexus Mortgage — your full report is attached as a PDF.</p>
<p><strong>Best rate found:</strong> {{1.summary.bestBank}} at {{1.summary.bestRate}}% p.a.<br>
<strong>Estimated monthly payment:</strong> S${{1.summary.monthlyPayment}}<br>
<strong>TDSR usage:</strong> {{1.summary.tdsrUsagePct}}% (cap is 55%)</p>
<p>A Nexus broker will reach out within 24 hours via WhatsApp. There's no
obligation — banks pay our referral fee, so the service is free to you.</p>
<p>Talk soon,<br>The Nexus team<br>WhatsApp: +65 8752 0859</p>
```

4. **Attachments → + Add attachment:**

| Field             | Value                                |
| ----------------- | ------------------------------------ |
| File name         | `{{1.reportPdfFilename}}`            |
| Data              | Toggle "Map" ON → `{{1.reportPdfBase64}}` |
| Encoding          | `Base64`                             |
| Content type      | `application/pdf`                    |

The base64 → PDF decode is done by Make automatically. The user receives a real
~20 KB PDF.

---

## Step 6 — Path C: Telegram alert (BotFather setup needed first)

You don't have a Telegram bot yet. One-time setup:

1. Open Telegram → search `@BotFather` → `/newbot`
2. Name it: `Nexus Lead Alerts`
3. Username: anything ending in `bot` (e.g. `nexus_lead_alerts_bot`)
4. **Copy the token** BotFather gives you (looks like `7234567890:AAH...`)
5. Send any message to your new bot from your personal Telegram
6. In a browser, visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Look for `"chat":{"id":12345...}` — that's YOUR chat ID

In Make:

1. Router output 3 → `+` → search "telegram" → **Telegram Bot → Send a Text Message or Reply**
2. Add connection → paste your bot token
3. **Chat ID:** your personal chat ID from step 6
4. **Text:**

```
🔔 New Nexus lead

{{1.lead.name}}
{{1.lead.phone}} | {{1.lead.email}}

{{1.inputs.mode}} | {{1.inputs.propertyType}}
Loan: S${{1.inputs.loan}} over {{1.inputs.tenure}}y
Income: S${{1.inputs.income}}/mo

Best: {{1.summary.bestBank}} @ {{1.summary.bestRate}}%
Monthly: S${{1.summary.monthlyPayment}}
TDSR: {{1.summary.tdsrUsagePct}}% ({{if(1.summary.tdsrPass; "PASS"; "FAIL")}})
```

---

## Step 7 — Path D: Notion follow-up task

1. Router output 4 → `+` → **Notion → Create a Database Item**
2. Database: pick your existing tasks DB (e.g. "My Tasks" or whatever you use)
3. Properties:

| Property      | Value                                              |
| ------------- | -------------------------------------------------- |
| Title (Name)  | `Follow up: {{1.lead.name}} ({{1.summary.bestBank}})` |
| Due           | `{{addHours(now; 24)}}`                            |
| Status        | `To do`                                            |
| Linked lead   | (optional) Relation → use the page ID from Path A  |

If you don't have a tasks DB yet, skip Path D for now — the Notion lead row in Path A
already has a "Follow-up by" date you can filter on.

---

## Step 8 — Spam filter (between webhook and router)

1. Click the line connecting webhook → router
2. Click the wrench → **Set up a filter**
3. Name: `Real lead?`
4. Conditions (ALL must match):
   - `{{1.lead.name}}` — text operator: **Exists** AND **Not equal to** `""`
   - `{{1.lead.email}}` — text operator: **Contains** `@`
5. Optional extras:
   - `{{1.lead.email}}` — **Does not end with** `.ru`
   - `{{1.lead.email}}` — **Does not end with** `.cn`

The honeypot in `index.html` already blocks most bots before POST. This is layer 2.

---

## Step 9 — Activate and test

1. Top of scenario → **Save** (Cmd+S)
2. Toggle **Scheduling** to ON (left of "Run once") — set to "Immediately as data arrives"
3. Submit a real test from the live form (your own email/phone)
4. Verify:
   - [ ] Notion `Leads — Free Report` row appears
   - [ ] Email arrives at your inbox with PDF attached
   - [ ] Telegram pings you
   - [ ] Follow-up task is in your tasks DB (if you wired Path D)
5. If anything fails: **Scenario history → click the red bubble** to see the exact error per module.

---

## Free plan note

You're on Make's free tier with ~225 ops/month left this cycle. Each submission
uses 5 ops (1 webhook + 4 module runs through the router). That's ~45 leads/month
before you hit the cap. If you start getting more, the Make Core plan is $9/mo for
10,000 ops.

---

## Updating bank rates later

Bank rates are hardcoded in `index.html` around line 1285:

```js
const BANK_RATES = [
  { bank: 'DBS', pkg: 'Fixed 2Y', rate: 1.45 },
  // ...
];
```

Edit values → save → push → live within 1-2 min.
