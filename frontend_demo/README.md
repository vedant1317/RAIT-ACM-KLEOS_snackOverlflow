# Munshi — CA Platform (frontend)

A B2B SaaS dashboard for **CA firms**, built on the same Munshi compliance
brain that powers the WhatsApp MSME bot. It's a "tool on top of the company
software": a firm's clients push invoices in from their ERP, and the firm
reconciles every client's books against GSTR-2B from one console.

## What's here

- **Firm Overview** (`/dashboard`) — admin view across the whole client book:
  total invoices managed, firm-wide ITC at risk, average GST health, clients
  ranked by financial exposure, and a live activity feed.
- **Clients** (`/clients`) — every client with live status, open issues, ITC
  at risk and a health score; onboard new clients inline.
- **Client overview** (`/clients/[id]`) — per-client health, reconciliation
  breakdown, and the ERP integration key/endpoint.
- **Invoice Manager** (`/clients/[id]/invoices`) — the core feature. Maps every
  invoice to GSTR-2B **and** to the other invoices, flagging:
  duplicates, missing-from-2B, **missing-in-books**, and wrong details
  (field-by-field), each with its rupee ITC impact and a recommended fix.
  Upload a GSTR-2B / invoice CSV and run reconciliation right here.

## Stack

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. Pages are client
components that fetch from the FastAPI backend, so no Next.js server secrets or
SSR data plumbing are involved.

## Run

```bash
# 1. start the backend (from the repo root) — seeds a demo firm automatically
python -m uvicorn backend.main:app --port 8000

# 2. start the frontend
cd frontend
npm install
npm run dev          # http://localhost:3000  -> redirects to /dashboard
```

The API base defaults to `http://localhost:8000`; override with
`NEXT_PUBLIC_API_BASE` in `.env.local`.
