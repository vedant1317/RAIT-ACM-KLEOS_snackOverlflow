"""Self-service MSME/trader portal — a CA client logs in directly (separate
from the CA's own login) and sees only their own data. Mounted at /client,
not nested under /ca. Every route after login delegates to the exact same
``service.py`` functions the CA router uses, just with the client_id taken
from the authenticated session instead of a URL path param — so there is
exactly one reconciliation/issue-tracking/etc. implementation, not two.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Header, HTTPException, Response, UploadFile
from pydantic import BaseModel

from ..core.security import hash_secret, verify_password
from . import reporting, service, simulator, store, vendor_scorecard
from .auth import require_client_auth
from .upload_parsing import read_baseline_records, read_invoice_records

router = APIRouter(prefix="/client", tags=["client-portal"])


class ClientLoginIn(BaseModel):
    email: str
    password: str


class InvoiceIn(BaseModel):
    vendor_name: str
    vendor_gstin: str
    invoice_number: str
    invoice_date: str
    taxable_value: float
    gst_rate: float
    gst_amount: float
    hsn_code: str


class InvoiceBatch(BaseModel):
    invoices: list[InvoiceIn]


class BaselineIn(BaseModel):
    records: list[InvoiceIn]
    period: str | None = None


class IssueStatusIn(BaseModel):
    issue_key: str
    status: str
    note: str = ""


class DraftMessageIn(BaseModel):
    issue_key: str
    language: str = "en"
    polish: bool = True


class SimulateIn(BaseModel):
    issue_keys: list[str]


def _paginate(items: list[dict], limit: int | None, offset: int) -> dict:
    offset = max(offset, 0)
    page = items[offset : offset + limit] if limit is not None else items[offset:]
    return {"items": page, "total": len(items), "limit": limit, "offset": offset}


# --------------------------------------------------------------------------- #
# login
# --------------------------------------------------------------------------- #
@router.post("/login")
async def client_login(payload: ClientLoginIn) -> dict:
    account = store.find_client_account_by_email(payload.email)
    if account is None or not verify_password(payload.password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    client = store.get_client(account["client_id"])
    if client is None:
        raise HTTPException(status_code=401, detail="Account is no longer linked to an active client")
    token = store.create_client_session(account["client_id"])
    return {"token": token, "client_id": client["id"], "client_name": client["name"]}


@router.post("/logout")
async def client_logout(authorization: str | None = Header(default=None), _client: dict = Depends(require_client_auth)) -> dict:
    if authorization and authorization.lower().startswith("bearer "):
        store.revoke_client_session(hash_secret(authorization.split(" ", 1)[1].strip()))
    return {"logged_out": True}


# --------------------------------------------------------------------------- #
# profile / summary
# --------------------------------------------------------------------------- #
@router.get("/me")
async def get_me(client: dict = Depends(require_client_auth)) -> dict:
    return service.get_client(client["id"])


# --------------------------------------------------------------------------- #
# invoices
# --------------------------------------------------------------------------- #
@router.get("/invoices")
async def list_invoices(
    period: str | None = None, limit: int | None = None, offset: int = 0, client: dict = Depends(require_client_auth)
) -> dict:
    return _paginate(service.get_invoices(client["id"], period=period) or [], limit, offset)


@router.post("/invoices")
async def add_invoices(batch: InvoiceBatch, client: dict = Depends(require_client_auth)) -> dict:
    return service.add_invoices(client["id"], [i.model_dump() for i in batch.invoices], source="manual")


@router.post("/invoices/upload")
async def upload_invoices(file: UploadFile = File(...), client: dict = Depends(require_client_auth)) -> dict:
    fresh = service.get_client(client["id"])
    try:
        records = await read_invoice_records(file, fresh.get("erp_config"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.add_invoices(client["id"], records, source="import")


# --------------------------------------------------------------------------- #
# GSTR-2B baseline
# --------------------------------------------------------------------------- #
@router.post("/baseline")
async def set_baseline(payload: BaselineIn, client: dict = Depends(require_client_auth)) -> dict:
    return service.set_baseline(client["id"], [r.model_dump() for r in payload.records], period=payload.period)


@router.post("/baseline/upload")
async def upload_baseline(
    file: UploadFile = File(...), period: str | None = None, client: dict = Depends(require_client_auth)
) -> dict:
    try:
        records = await read_baseline_records(file)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return service.set_baseline(client["id"], records, period=period)


# --------------------------------------------------------------------------- #
# reconciliation
# --------------------------------------------------------------------------- #
@router.get("/reconciliation")
async def get_reconciliation(period: str | None = None, client: dict = Depends(require_client_auth)) -> dict:
    return service.get_reconciliation(client["id"], period=period)


@router.get("/reconciliation/history")
async def get_reconciliation_history(client: dict = Depends(require_client_auth)) -> list[dict]:
    return service.reconciliation_history(client["id"])


@router.post("/reconcile")
async def run_reconcile(language: str = "English", period: str | None = None, client: dict = Depends(require_client_auth)) -> dict:
    return service.run_reconcile(client["id"], language=language, period=period)


# --------------------------------------------------------------------------- #
# issues
# --------------------------------------------------------------------------- #
@router.get("/issues")
async def list_issues(
    status: str | None = None,
    period: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    client: dict = Depends(require_client_auth),
) -> dict:
    return _paginate(service.list_issues(client_id=client["id"], status=status, period=period), limit, offset)


@router.get("/issues/summary")
async def issues_summary(client: dict = Depends(require_client_auth)) -> dict:
    return service.issues_summary(client_id=client["id"])


@router.post("/issues/status")
async def set_issue_status(payload: IssueStatusIn, client: dict = Depends(require_client_auth)) -> dict:
    existing = store.get_issue(payload.issue_key)
    if existing is None or existing["client_id"] != client["id"]:
        raise HTTPException(status_code=404, detail="Issue not found")
    try:
        updated = service.update_issue_status(payload.issue_key, payload.status, payload.note, client["name"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return updated


@router.post("/issues/draft-message")
async def draft_issue_message(payload: DraftMessageIn, client: dict = Depends(require_client_auth)) -> dict:
    from ..core import supplier_message

    issue = store.get_issue(payload.issue_key)
    if issue is None or issue["client_id"] != client["id"]:
        raise HTTPException(status_code=404, detail="Issue not found")
    draft = supplier_message.draft_message(issue, language=payload.language)
    final = await asyncio.to_thread(supplier_message.polish_with_groq, draft, payload.language) if payload.polish else draft
    return {"issue_key": payload.issue_key, "language": payload.language, "draft": final}


# --------------------------------------------------------------------------- #
# timeline / vendors / simulator / reports
# --------------------------------------------------------------------------- #
@router.get("/timeline")
async def get_timeline(period: str | None = None, client: dict = Depends(require_client_auth)) -> dict:
    from ..core import gst_timeline
    from ..core.period_utils import current_period

    resolved_period = period or current_period()
    events = gst_timeline.upcoming_events(resolved_period, client.get("filing_frequency", "monthly"))
    return {"client_id": client["id"], "period": resolved_period, "events": events}


@router.get("/vendors")
async def get_vendor_scorecard(client: dict = Depends(require_client_auth)) -> list[dict]:
    return vendor_scorecard.scorecard_for_client(client["id"])


@router.post("/simulate")
async def simulate(payload: SimulateIn, client: dict = Depends(require_client_auth)) -> dict:
    return simulator.simulate(client["id"], payload.issue_keys)


@router.get("/reports/monthly")
async def get_monthly_report(period: str | None = None, client: dict = Depends(require_client_auth)) -> Response:
    from ..core.period_utils import current_period

    resolved_period = period or current_period()
    try:
        pdf_bytes = reporting.build_monthly_report_pdf(client["id"], resolved_period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    filename = f"gst-report-{client['id']}-{resolved_period}.pdf"
    return Response(
        content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
