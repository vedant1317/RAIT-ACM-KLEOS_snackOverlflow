# Munshi

**The CA in your pocket.** Munshi is now a three-part GST compliance demo:
a multilingual WhatsApp bot for MSME traders, a CA admin dashboard, and a
client self-service portal. All three use the same FastAPI compliance brain
so uploaded invoices, GSTR-2B baselines, reconciliation issues, ITC impact,
reports, reminders, and supplier follow-ups stay consistent across channels.

See [context/ps.txt](context/ps.txt) for the original problem statement,
[context/solution.txt](context/solution.txt) for the product vision, and
[context/implementation.txt](context/implementation.txt) for the current
implementation and verification log.

## Architecture

```text
frontendmain/  Vite React SPA
  - Admin Mode for CA firms
  - Client Mode for a single CA client
  - Separate CA/client bearer-token scopes in localStorage
        |
        | HTTP JSON / file upload / PDF download
        v
backend/  FastAPI compliance brain
  - Invoice extraction, GSTR-2B ingestion, reconciliation, ITC math
  - CA platform APIs under /ca
  - Client portal APIs under /client
  - Trader/WhatsApp APIs for extraction, baseline upload, confirmation,
    reconciliation, health checks, rate limiting, auth, audit, retention
        |
        v
MongoDB
  - Trader sessions and uploaded data
  - CA firms, users, clients, invoices, baselines, issues, alerts,
    reminders, sessions, audit logs, suppliers, ERP keys

twilio/  Node/Express WhatsApp adapter
  - Twilio webhook, media download, voice transcription, language handling
  - Calls backend/ for all GST and reconciliation logic
  - Sends WhatsApp text, interactive issue lists, nudges, optional TTS media
```

The core design principle still holds: **AI never computes money.** Gemini
and Groq are used for document reading, transcription, narration, and message
polish. Matching, classifications, HSN/SAC checks, ITC impact, reports, and
simulations are deterministic backend code.

## Current Feature Set

- Invoice extraction from image/PDF inputs with confidence and review flags.
- GSTR-2B ingestion from CSV, XLSX, and PDF paths.
- Deterministic reconciliation across invoices and GSTR-2B records.
- ITC-at-risk calculation, recovery tracking, action cards, and status
  lifecycle for issues.
- HSN/SAC categorisation with service/product segregation support from the
  local HSN master data.
- Anomaly detection and recommendation generation.
- Multi-period reconciliation history.
- Supplier reminder drafts and optional Groq-polished supplier messages.
- Vendor compliance scorecard and supplier risk forecasting.
- Alerts, due reminders, and GST compliance timeline.
- Monthly PDF report generation for clients.
- Financial impact simulator for "what if these issues are resolved?"
- CA knowledge graph views for client/supplier/issue/HSN relationships.
- ERP import mapping for common exports, generic ERP invoice ingest, and
  hashed ERP API keys.
- CA admin login, client portal login, session revocation, rate limiting,
  hashed secrets, bcrypt passwords, soft delete, export, audit logs, and
  retention purge.
- WhatsApp multilingual flow in English, Hindi, and Marathi.
- WhatsApp voice-note input through Groq transcription.
- WhatsApp status, remind, Q&A/help, review, batch-upload, nudge, and
  optional TTS voice-reply flows.

## Setup

### Backend

Run from the repo root so `backend` imports as a package.

```bash
cd /path/to/RAIT-ACM-KLEOS_snackOverlflow
python3 -m venv backend/venv
backend/venv/bin/pip install -r backend/requirements.txt
backend/venv/bin/python -m uvicorn backend.main:app --port 8000
```

Backend environment variables:

```text
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=munshi
GEMINI_API_KEY=...
GROQ_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
GROQ_EXPLAIN_MODEL=llama-3.3-70b-versatile
SERVICE_TOKEN=optional-shared-token-for-service-calls
CA_ADMIN_TOKEN=optional-static-ca-bearer-token
CA_ADMIN_PASSWORD=admin1234
DEMO_CLIENT_PASSWORD=demo1234
SECURITY_PEPPER=change-this-outside-demo
DATA_RETENTION_DAYS=365
RATE_LIMIT_PER_MINUTE=120
ALERT_ITC_AT_RISK_THRESHOLD=5000
NUDGE_ITC_AT_RISK_THRESHOLD=1000
```

### Frontend

`frontendmain/` is the active frontend. The older `frontend/` directory is
legacy and is not the current app.

```bash
cd frontendmain
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Frontend environment variables:

```text
VITE_API_URL=http://localhost:8000
```

### WhatsApp Bot

```bash
cd twilio
npm install
npm start
```

Expose the local bot to Twilio when testing WhatsApp:

```bash
ngrok http 3002
cd twilio
node scripts/update-twilio-webhooks.js
```

Paste the generated webhook URL into Twilio Sandbox Settings as the inbound
WhatsApp webhook with method `POST`.

Twilio environment variables:

```text
PORT=3002
MONGODB_URI=mongodb://localhost:27017/munshi_whatsapp
BACKEND_URL=http://localhost:8000
SERVICE_TOKEN=optional-shared-token-matching-backend
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
GROQ_API_KEY=...
GROQ_INTENT_MODEL=llama-3.3-70b-versatile
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
ENABLE_TTS=false
NGROK_URL=https://your-ngrok-url.ngrok-free.app
GROQ_TTS_MODEL=playai-tts
GROQ_TTS_VOICE=Fritz-PlayAI
NUDGE_SECRET=...
CA_ADMIN_TOKEN=...
NUDGE_TEMPLATE_SID=optional-twilio-template
```

## Demo Credentials

The backend seeds demo CA and client accounts when the CA platform imports.

```text
CA admin email:    admin@sharma-associates.example
CA admin password: admin1234, unless CA_ADMIN_PASSWORD overrides it

Client email:      <client_id>@demo.munshi.local
Client password:   demo1234, unless DEMO_CLIENT_PASSWORD overrides it
Example:           cli_lakshmi@demo.munshi.local
```

## Verification

Commands:

```bash
backend/venv/bin/python -m pytest backend/tests -v
cd frontendmain && npm run build
cd frontendmain && npm run lint
node -e "require('./twilio/routes/sms'); require('./twilio/services/nudgeService'); require('./twilio/services/voiceReplyService'); console.log('ok')"
```

Latest smoke-test notes from 2026-06-20:

- Backend tests: `41 passed in 3.61s`.
- Backend health on the current app at `127.0.0.1:8001`: `status=ok`,
  Mongo reachable, Gemini configured, Groq configured.
- Authenticated CA API smoke passed for login, portfolio, clients,
  reconciliation get/run/history, issue listing, issue status update,
  supplier draft, vendors, vendor forecast, alerts, due reminders, timeline,
  simulator, and monthly PDF report.
- Authenticated client API smoke passed for login, `/client/me`,
  reconciliation, issues, timeline, and monthly PDF report.
- Frontend build: passed with Vite.
- Frontend dev server: served the Vite app shell at `127.0.0.1:5173` against
  the live backend URL.
- Twilio import check: passed.
- Twilio server health: passed on temporary port `3012`; default port `3002`
  was already occupied by an existing process.
- Frontend lint: not clean yet. Current ESLint failures are in
  `frontendmain/scratch.js`, `frontendmain/src/App.jsx`,
  `frontendmain/src/components/ui/Dashboard.jsx`,
  `frontendmain/src/components/ui/horizontal-bars.jsx`, and
  `frontendmain/src/components/ui/vertical-bars.jsx`.
- Browser click-through automation was not run because Playwright/Puppeteer
  are not installed in this workspace. The live frontend/backend smoke was
  verified through Vite serving plus authenticated backend API calls.

## Scope Boundaries

Munshi still does **not** do live GST portal/GSTN/GSP auto-fetch, auto-filing
of corrections, e-invoice/IRN/e-way bill workflows, or IMS/pre-14th portal
operations. Uploaded GSTR-2B files remain the baseline for reconciliation.

The app can recommend actions, draft supplier messages, generate reports,
and track statuses, but a human must review and execute GST portal actions.
Production deployment hardening beyond this local demo has not been verified.
