"""Smart-alert API: list/ack persisted alerts and trigger evaluation.

There's no cron/scheduler in this hackathon stack, so ``POST /ca/alerts/evaluate``
is the explicit trigger Twilio's nudge job (or a manual call) uses to run the
rule engine in ``backend/core/alert_engine.py`` and persist anything new.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from . import store
from .auth import require_ca_auth

router = APIRouter()


@router.get("/alerts")
async def list_alerts(client_id: str | None = None, acked: bool | None = None, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    return store.list_alerts(client_id=client_id, acked=acked, firm_id=store.FIRM_ID)


@router.post("/alerts/evaluate")
async def evaluate_alerts(_user: dict = Depends(require_ca_auth)) -> dict:
    from ..core import alert_engine

    raised = alert_engine.evaluate_all()
    return {"raised": len(raised), "alerts": raised}


@router.post("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: str, acked_by: str = "ca", _user: dict = Depends(require_ca_auth)) -> dict:
    updated = store.ack_alert(alert_id, acked_by)
    if updated is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return updated
