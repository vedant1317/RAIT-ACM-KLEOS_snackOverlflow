"""GST compliance timeline endpoints — a calendar of GST work, no portal
integration. Wraps ``backend.core.gst_timeline``'s static due-date logic
per client (using each client's filing frequency) and firm-wide.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..core import gst_timeline
from ..core.period_utils import current_period
from . import store
from .auth import require_ca_auth

router = APIRouter()


@router.get("/clients/{client_id}/timeline")
async def client_timeline(client_id: str, period: str | None = None, _user: dict = Depends(require_ca_auth)) -> dict:
    client = store.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    resolved_period = period or current_period()
    events = gst_timeline.upcoming_events(resolved_period, client.get("filing_frequency", "monthly"))
    return {"client_id": client_id, "period": resolved_period, "events": events}


@router.get("/timeline")
async def firm_timeline(period: str | None = None, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    resolved_period = period or current_period()
    out = []
    for client in store.list_clients():
        events = gst_timeline.upcoming_events(resolved_period, client.get("filing_frequency", "monthly"))
        out.append(
            {"client_id": client["id"], "client_name": client["name"], "period": resolved_period, "events": events}
        )
    return out
