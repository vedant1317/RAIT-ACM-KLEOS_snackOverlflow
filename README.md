# Munshi

**The CA in your pocket.** A WhatsApp bot for Indian MSME traders that reads
their invoices, reconciles them against their GSTR-2B, and tells them in
plain Hindi/English exactly how much Input Tax Credit they're about to lose
and what to do about it — citing the specific bill every time.

See [`context/ps.txt`](context/ps.txt) for the original problem statement,
[`context/solution.txt`](context/solution.txt) for the full product vision,
and [`context/implementation.txt`](context/implementation.txt) for a
detailed log of what was actually built and verified.

## How it works

```
WhatsApp (trader's phone)
        │  Twilio Sandbox
        ▼
twilio/   Node/Express — the WhatsApp channel adapter
  - Twilio webhook, per-trader session state (MongoDB)
  - Downloads media (invoice photos/PDFs, GSTR-2B documents)
  - Groq: WhatsApp voice-note transcription / free-text intent & correction parsing
  - Calls backend/ for everything GST-related
  - Formats Hindi/Marathi/English WhatsApp replies, incl. a tap-to-expand
    interactive list of reconciliation issues
        │  HTTP
        ▼
backend/  Python/FastAPI — the "compliance brain"
  - POST /extract-invoice        Gemini Vision -> structured invoice JSON
  - POST /2b/upload              parses the trader's GSTR-2B baseline
  - POST /invoices/confirm       stores a trader-confirmed invoice
  - POST /reconcile/{trader_id}  pandas matching + HSN lookup + ITC impact
                                  + Groq Hindi/English narration
```

The core design principle: **AI never computes a rupee figure.** Gemini
only reads documents into structured fields; pandas does all matching and
arithmetic deterministically; Groq only narrates facts it's handed. This
keeps every number reproducible and auditable.

## Prerequisites

- Python 3.11+ and Node 18+
- MongoDB running locally (`brew services start mongodb-community`) or an
  Atlas connection string
- [ngrok](https://ngrok.com) (for exposing the bot to Twilio's webhook)
- API keys: a Twilio account with WhatsApp Sandbox enabled, a
  [Google AI Studio](https://aistudio.google.com/apikey) key for Gemini, and
  a [Groq](https://console.groq.com) key

## Setup

### 1. Backend (compliance brain)

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in GEMINI_API_KEY and GROQ_API_KEY
./venv/bin/python -m uvicorn backend.main:app --port 8000   # run from repo root, not backend/
```

Run from the **repo root**, since `backend` is imported as a package:

```bash
cd /path/to/repo
backend/venv/bin/python -m uvicorn backend.main:app --port 8000
```

Sanity-check the deterministic reconciliation engine on its own (no API
keys, no network needed):

```bash
backend/venv/bin/python -m pytest backend/tests -v
```

### 2. WhatsApp bot

```bash
cd twilio
npm install
cp .env.example .env   # fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, GROQ_API_KEY
npm start               # listens on PORT (default 3002)
```

### 3. Expose it and connect the Twilio Sandbox

In a second terminal:

```bash
ngrok http 3002
cd twilio && node scripts/update-twilio-webhooks.js
```

The script writes the live tunnel URL into `twilio/.env` as `NGROK_URL`,
prints the exact webhook URL, and copies it to your clipboard. Twilio's
WhatsApp **Sandbox** has no public API for setting its inbound webhook
(unlike a purchased number), so the last step is manual:

> Twilio Console → Messaging → Try it out → Send a WhatsApp message →
> Sandbox Settings → paste the URL into **"WHEN A MESSAGE COMES IN"**
> (method `POST`) → Save.

Re-run `node scripts/update-twilio-webhooks.js` every time you restart
ngrok — the free tier issues a new URL each time.

Make sure your phone has joined the sandbox once (`join <code>`, found on
the same Sandbox Settings page), then message it.

## Using it

1. Send `hi` — get a Hindi-first menu.
2. Send a photo/PDF of an invoice — the bot extracts the 8 key fields via
   Gemini Vision and asks you to confirm or correct them.
3. Send your GSTR-2B export as a document (CSV or Excel).
4. Send or say `check` in a WhatsApp voice note — the bot runs reconciliation
   and sends back a tappable list of issues found, each with its rupee impact.
   Tap a row for the full explanation, citing that specific bill.
5. Send or say `english` / `hindi` / `marathi` any time to switch language.

## Demo data

`backend/data/` ships a seeded demo dataset — `demo_gstr2b.csv` plus five
fixtures under `demo_invoices/` — with one deliberate mismatch of each type
(missing from 2B, wrong HSN code, amount mismatch, duplicate invoice) so the
reconciliation engine always has something concrete to catch. See
`context/implementation.txt` for exactly which invoice maps to which issue
and the expected rupee amounts.

## Project layout

```
backend/
  main.py                       FastAPI app
  core/                         extraction, reconciliation, ITC, explanation
  ca_platform/                  CA SaaS API, matching, JSON persistence
  routers/                      HTTP endpoints
  data/                         HSN master list + seeded demo dataset
  tests/                        pytest for the reconciliation engine

frontend/
  app/                          Next.js CA platform dashboard
  components/                   dashboard UI components
  lib/                          typed API client and formatting helpers

twilio/
  server.js                     Express app
  routes/sms.js                 Twilio webhook
  services/                     Twilio media, backend client, Groq, replies
  scripts/update-twilio-webhooks.js

context/
  ps.txt, solution.txt          original problem statement & product vision
  implementation.txt            build log: what was done, in what order, verified how
```

## CA Platform (Mode 3 — the B2B SaaS for CA firms)

The same compliance brain now also powers a **multi-tenant web app for CA
firms** — `solution.txt`'s "Mode 3 — CA Platform". Where the WhatsApp bot
serves one trader, the CA platform lets a firm manage *many* clients from one
console and drops on top of each client's existing ERP.

```
frontend/  Next.js 16 — the CA SaaS dashboard
  /dashboard            firm-wide admin view (portfolio, ITC at risk, health)
  /clients              every client with live compliance status
  /clients/[id]         per-client overview + ERP integration key
  /clients/[id]/invoices  the Invoice Manager (full reconciliation mapping)
        │  HTTP (fetch)
        ▼
backend/ca_platform/   FastAPI router mounted at /ca
  matching.py   invoice<->2B AND invoice<->invoice mapping (pure Python),
                reusing core/itc_engine + core/hsn_lookup + recommendation_engine
  service.py    firm portfolio, per-client reconcile, ERP ingestion, health score
  store.py      JSON-file persistence (no MongoDB needed — runs out of the box)
  seed.py       a demo firm with 4 clients exercising every mapping outcome
  router.py     /ca/* REST endpoints + /ca/integrations/erp/invoices
```

The Invoice Manager is the headline feature: it takes all of a client's
invoices plus their GSTR-2B and maps them against each other to surface
**duplicates**, **missing invoices** (both *missing-from-2B* — ITC blocked —
and the reverse *missing-in-books*), and **wrong details** (field-by-field
amount/tax/HSN/date diffs), each with its exact rupee ITC impact. All money
math is the deterministic `core` engine; no AI computes a figure.

ERP integration is the "tool on top of company software" path: each client is
issued an API key at onboarding, and their ERP pushes invoices via
`POST /ca/integrations/erp/invoices` (header `X-API-Key`).

### Run the CA platform

```bash
# backend (from repo root) — auto-seeds the demo firm on first request
python -m uvicorn backend.main:app --port 8000
# the CA platform itself needs no Gemini/Groq/Mongo; those stay optional and
# are only used by the WhatsApp pipeline and (optionally) reconcile narration.

# frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Tests for the new mapping engine live in `backend/tests/test_ca_matching.py`
and run with the existing suite (`python -m pytest backend/tests -v`).

## What's deliberately not built

Live GST portal integration, auto-filing of corrections, generated voice
output/TTS replies, and the trader-facing MSME dashboard are out of scope for
this prototype (see `context/solution.txt`'s "what to deliberately NOT
build" section for the original scope notes). WhatsApp voice-note input is
implemented through Groq transcription. The CA platform is no longer future
scope: a demo B2B dashboard now exists in `frontend/` and is backed by the
`backend/ca_platform/` API.

The production GST-portal path would need authorized GST/GSP-style API
access, taxpayer consent, and human approval for filing actions. This
prototype deliberately uses uploaded GSTR-2B files instead of live portal
sync, and it recommends fixes rather than filing anything automatically.
