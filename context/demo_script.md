# Munshi — Judge Demo Script

Two-act demo: **WhatsApp first, Portal second.** The whole point of Act 2 is
that judges already saw the data arrive in Act 1 — the portal isn't a
separate mocked-up screen, it's the *same* backend.

---

## 0. Before judges arrive (setup, ~5 min)

1. **Restart the backend** so it picks up everything built in this session:
   ```bash
   cd backend && source venv/bin/activate
   uvicorn main:app --host 127.0.0.1 --port 8000
   # (run from the backend/ dir, or `uvicorn backend.main:app` from repo root)
   ```
2. **Restart the Twilio/Node server** and re-point ngrok's webhook in the Twilio
   console (Sandbox → Sandbox Settings → "When a message comes in").
   ```bash
   cd twilio && node server.js
   node scripts/update-twilio-webhooks.js   # prints the webhook URL + copies it
   ```
3. **Start the frontend**:
   ```bash
   cd frontendmain && npm run dev
   ```
   `.env` already points at `http://localhost:8000`.
4. **Wire your demo WhatsApp number to a CA client** so live WhatsApp activity
   shows up in the portal. Easiest: create one fresh client for the live
   segment so the dashboard visibly goes from *empty → populated*.
   ```bash
   TOKEN=ca_4831c073b7348899ea3d21e04fb55b4aa3b6b7efa6dbd8a0   # backend/.env CA_ADMIN_TOKEN

   # create a clean client for the live demo
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"Live Demo Kirana","contact_phone":"+91XXXXXXXXXX"}' \
     http://localhost:8000/ca/clients

   # (if reusing an existing seeded client instead, just PATCH its phone)
   curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"contact_phone":"+91XXXXXXXXXX"}' \
     http://localhost:8000/ca/clients/<client_id>
   ```
   Replace `+91XXXXXXXXXX` with the phone you'll demo from (any format with
   the right digits works — it's matched by the last 10 digits).
5. Send "hi" once from that phone to register the WhatsApp session before judges
   arrive, then type "english" so the bot greets in English for the demo (or
   leave it in Hindi/Marathi — your call, switching languages live is itself
   a demo beat, see Act 1 step 1).
6. Log into the portal as CA admin once to confirm it loads:
   `admin@sharma-associates.example` / `admin1234`.
7. Open the Risk Graph page once and click **"Sync from Neo4j"** so the
   graph isn't doing its very first sync live in front of judges (the demo
   will have you sync again after the WhatsApp segment anyway — that second
   sync is the one that matters).

---

## Act 1 — WhatsApp (the trader experience)

**Narrate:** *"A kirana owner doesn't install an app. They already have WhatsApp."*

1. **Multilingual, live.** Send `hi` → bot replies in Hindi by default. Type
   `english` → switches instantly. Type `marathi` → switches again. Say:
   *"Same brain, three languages — and it's chosen by what the trader
   actually typed or said, not a settings menu."*

2. **Send a real invoice photo.** Bot extracts vendor, GSTIN, invoice number,
   date, taxable value, GST rate/amount, HSN — via Gemini Vision, not OCR
   guesswork. If it's confident, it auto-saves ("✅ saved automatically"); if
   any field looks off (bad GSTIN, missing HSN, non-standard rate), it asks
   you to check those specific fields instead of silently trusting a money
   field. Say: *"The AI reads the photo. It never decides the rupee number —
   that's still deterministic code, always."*

3. **Send your GSTR-2B as a PDF** (the actual government-portal download
   format, not a curated CSV). Because a PDF is ambiguous, the bot asks
   *"is this a bill or your GSTR-2B?"* — reply `gstr2b`. Gemini extracts every
   row of the statement into the same structured schema. Say: *"This is the
   Simulation Clause requirement — the trader's own portal export, read
   directly from a PDF."*

4. **Type `check`.** Reconciliation runs and replies with a tappable list
   (WhatsApp List Picker) headed by the rupee headline ("Recover ₹X this
   month"). Tap a row → full plain-language explanation citing that exact
   bill.

5. **Type `remind <invoice-number>`.** Bot drafts a ready-to-forward supplier
   correction message — polite language, the exact invoice number, the exact
   rupee amount. Say: *"Generated entirely from already-computed issue data.
   It cannot invent an amount — there's no AI in that number anywhere in the
   pipeline."*

6. **Type `status`.** A mini dashboard card appears inside WhatsApp itself —
   invoices uploaded, GSTR-2B status, ITC at risk, open issues, next action.

7. **Ask a free-text question in Hindi or Marathi** — e.g. *"kiti paise atakle
   aahet?"* or *"kaunsa bill chase karna hai?"*. The bot answers using ONLY
   the already-computed facts (no recalculation) — this is "Ask Munshi."

8. **Type `report`.** Bot generates and sends an actual PDF report as a
   WhatsApp attachment, right there in the chat.

9. *(If time allows)* send a voice note instead of typing `check` — bot
   transcribes (Groq Whisper) and responds exactly as if you'd typed it.

---

## Act 2 — Portal (the CA platform)

**Narrate:** *"A CA can manage multiple clients from one dashboard instead of
reconciling each business manually in spreadsheets."*

1. **Log in** at the CA Firm login (`admin@sharma-associates.example` /
   `admin1234`). Land on the portfolio view. Point out: total clients, total
   invoices, firm-wide ITC at risk, Money Unlocked hero, Compliance Health
   Score.

2. **Switch the client selector to "Live Demo Kirana"** (the client tied to
   your WhatsApp number) — **the dashboard populates with exactly what you
   just sent over WhatsApp seconds ago.** This is the single best beat of the
   demo: same backend, two channels, zero manual re-entry.

3. **Open Invoice Manager**, click the invoice that came in from WhatsApp.
   The comparison card shows:
   - **Books vs GSTR-2B side by side**, with mismatched fields highlighted in
     red.
   - A big **"Fixing this = +₹X ITC this month"** banner.
   - A **Samjhao** plain-language explanation of what's wrong and why it
     costs money.
   - Three actions: **Send Correction Request** (drafts the supplier
     message), **Mark Sent / Following Up**, **Mark Fixed**. Click *Mark
     Fixed* — watch the Health Score and Money Unlocked numbers move live.

4. **Open the Issue Mix popup.** Read the subtitle aloud — it's the exact
   distinction they care about: *"Missing from GSTR-2B = supplier hasn't
   filed it (chase the supplier). Missing in books = filed by the supplier
   but not recorded by you (a bookkeeping gap to verify)."* Say: *"We don't
   treat every missing invoice the same — supplier-side problems and
   client-side bookkeeping gaps get different treatment and different
   recommended actions."*

5. **Open Alerts & Reminders.** Show real generated alerts (red-rated
   repeat-offender vendor, filing deadline approaching) and clients due a
   recovery nudge — ack one alert live.

6. **Click "Download Report (PDF)"** and open it — a real, properly
   formatted monthly report, not a screenshot.

7. **Switch the client selector to a different (seeded) client** — the whole
   dashboard re-scopes instantly: different invoices, different issues,
   different health score. Proves real multi-tenancy, not a single
   hard-coded view with a relabeled header.

8. **Click "🌐 Risk Graph" in the navbar (the USP moment).** A full-screen 3D
   force-directed graph opens — every client and every supplier across the
   firm as nodes, every transacting relationship as an edge. Click
   **"Sync from Neo4j"** once to rebuild it from the latest data (including
   whatever you just sent over WhatsApp in Act 1). Then:
   - Rotate/zoom the graph — it's real Three.js/WebGL, not an image.
   - Point out the legend: red/yellow/green node color = supplier risk
     rating, node size = exposure, edge thickness = ₹ at risk, **flowing red
     particles along an edge = money currently at risk on that
     relationship** — self-explanatory without narration.
   - Click a red supplier node → the side panel shows its risk score, risk
     level, clients affected, and total/unresolved ITC at risk — computed by
     the rule-based forecasting engine, not hard-coded.
   - Switch the client dropdown to scope the graph to one client's own
     supplier neighborhood.
   - Say: *"This is a real Neo4j graph database, synced from MongoDB on
     demand — not a static diagram. The same vendor-risk data the portfolio
     summarizes in a table, here you can explore as a network — which is how
     a CA actually thinks about supplier risk across a whole portfolio."*

9. *(Optional, if time remains)* **Log out, log back in as "Vendor" mode**
   with `cli_verma@demo.munshi.local` / `demo1234` — show the *same client*
   now sees only their own data through a completely separate self-service
   login. Say: *"The CA's clients don't have to wait for their accountant to
   check WhatsApp — they can log in themselves."*

---

## Judging-criteria cheat sheet (say these lines somewhere in the demo)

| Criteria | What to say |
|---|---|
| **Innovation** | "One compliance brain, three surfaces — WhatsApp, a CA portfolio dashboard, and a client self-service portal — all reading and writing the same reconciliation engine, plus a 3D graph-database view of supplier risk no other GST tool shows." |
| **Technical complexity** | "Gemini Vision for extraction with deterministic confidence scoring, Groq for multilingual narration/voice/Q&A, a pandas-free deterministic reconciliation engine, rule-based vendor risk forecasting synced into a real Neo4j graph database and rendered in 3D WebGL, two independent auth systems, and a live bridge that mirrors WhatsApp activity into the CA platform in real time." |
| **Execution & functionality** | "Everything you just saw is a real Mongo-backed API call — there's no mocked happy path. The invoice you photographed on WhatsApp is the same document object the portal just rendered." |
| **UX** | "WhatsApp-first because that's where a kirana owner already lives — Hindi by default, tap targets instead of typing, voice notes instead of forms. The portal is money-first: the rupee impact is the biggest thing on every card." |
| **Presentation** | Lead with the WhatsApp→Portal live sync moment — it's the one beat that proves this isn't a demo of two unrelated screens. |
| **Impact** | "1.4 crore GST-registered MSMEs pay ₹15,000–40,000 a month for what is mostly data entry. We don't replace the CA's judgment — we replace the data entry, and we show the CA exactly where the money is." |

---

## What's live vs. what's pitch-only (say this confidently, don't overclaim)

**Live and real today:**
WhatsApp invoice/GSTR-2B capture (image *and* PDF), Hindi/English/Marathi
text + voice, deterministic reconciliation + ITC impact + HSN validation,
issue lifecycle (open → chasing → resolved), supplier correction drafts, PDF
reports (WhatsApp *and* portal), CA multi-client portfolio with a live
WhatsApp↔portal bridge, a separate client self-service login, vendor
scorecards + rule-based risk forecasting, a real Neo4j-backed 3D
supplier-risk graph synced from MongoDB on demand, smart alerts,
reminders-due, compliance health score, "money unlocked" tracking, a static
GST compliance timeline.

**Frame as roadmap, not "watch me click it":**
- One-tap *sending* the correction message straight to the supplier's
  WhatsApp (today: generates the message, you copy/forward it — deliberately
  keeps a human in the loop before anything goes to a third party).
- A literal Sent → Replied → Fixed three-state pipeline (today: open →
  chasing → resolved tells the same story).
- Side-by-side with the *actual scanned photo* next to the GSTR-2B row
  (today: the structured Books-vs-2B field table, with mismatches
  highlighted — the data, not the bitmap).
- A specific "supplier gets X% wrong" statistic (today: real repeat-offender
  and multi-client-impact flags on the vendor scorecard, just not phrased as
  a percentage).
- Anonymized cross-firm "traders like you" community intelligence (no real
  second firm's data exists in a single-firm demo — this is explicitly a
  roadmap line, not a deferred bug).
