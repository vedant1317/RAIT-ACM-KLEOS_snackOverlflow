"""Proactive reminders / monthly recovery nudges.

This module computes which clients are due a nudge and persists reminder
records. Twilio's own ``/nudge`` route (protected by a shared secret) calls
``GET /ca/reminders/due``, sends the WhatsApp message to each client's
contact number, then calls back to mark it sent — this module never talks
to Twilio directly.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import store
from .auth import require_ca_auth

router = APIRouter()

_NUDGE_THRESHOLD = float(os.environ.get("NUDGE_ITC_AT_RISK_THRESHOLD", "1000"))


def due_candidates() -> list[dict]:
    candidates = []
    for client in store.list_clients():
        if not client.get("contact_phone"):
            continue
        last_run = store.latest_reconciliation_run(client["id"])
        if last_run is None:
            continue
        itc_at_risk = last_run["summary"]["itc_at_risk"]
        if itc_at_risk < _NUDGE_THRESHOLD:
            continue
        already_sent = any(
            r["period"] == last_run["period"] and r["status"] == "sent" and r["type"] == "monthly_recovery_nudge"
            for r in store.list_reminders(client_id=client["id"])
        )
        if already_sent:
            continue
        candidates.append(
            {
                "client_id": client["id"],
                "client_name": client["name"],
                "contact_phone": client["contact_phone"],
                "period": last_run["period"],
                "itc_at_risk": itc_at_risk,
                "issues_open": last_run["summary"]["total_issues"],
                "suggested_message": (
                    f"Rs.{itc_at_risk:,.0f} of ITC is at risk/recoverable this month "
                    f"({last_run['summary']['total_issues']} issue(s)). Reply 'check' on WhatsApp for details."
                ),
            }
        )
    return candidates


@router.get("/reminders/due")
async def reminders_due(_user: dict = Depends(require_ca_auth)) -> list[dict]:
    return due_candidates()


class ReminderCreate(BaseModel):
    period: str
    message: str
    channel: str = "whatsapp"
    invoice_number: str | None = None


@router.post("/clients/{client_id}/reminders")
async def create_reminder(client_id: str, payload: ReminderCreate, _user: dict = Depends(require_ca_auth)) -> dict:
    client = store.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    reminder = store.insert_reminder(
        {
            "client_id": client_id,
            "trader_id": client.get("contact_phone"),
            "type": "monthly_recovery_nudge" if payload.invoice_number is None else "supplier_chase",
            "channel": payload.channel,
            "period": payload.period,
            "invoice_number": payload.invoice_number,
            "message": payload.message,
        }
    )
    store.log_activity(client_id, "reminder_created", f"Reminder drafted for {payload.period}")
    return reminder


@router.get("/clients/{client_id}/reminders")
async def list_client_reminders(client_id: str, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    if not store.client_exists(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return store.list_reminders(client_id=client_id)


@router.post("/reminders/{reminder_id}/sent")
async def mark_reminder_sent(reminder_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    store.mark_reminder_sent(reminder_id)
    return {"reminder_id": reminder_id, "status": "sent"}
