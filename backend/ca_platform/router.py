"""FastAPI router for the CA-firm SaaS platform, mounted under /ca.

Every route except the ERP ingest webhook (which authenticates with the
client's own ERP API key) and the login endpoint itself requires a CA
bearer token — see ``auth.py``.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from ..core.security import generate_password, hash_secret, verify_password
from . import service
from .auth import require_ca_auth
from .seed import ensure_seeded
from .upload_parsing import read_baseline_records, read_invoice_records

router = APIRouter(prefix="/ca", tags=["ca-platform"])

# Seed demo data on first import so the dashboards are never empty.
ensure_seeded()


class ClientCreate(BaseModel):
    name: str
    gstin: str = ""
    industry: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    erp_system: str = ""
    filing_frequency: str = "monthly"


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
    updated_by: str = "ca"


def _paginate(items: list[dict], limit: int | None, offset: int) -> dict:
    """Stable pagination envelope for list endpoints — a consistent
    contract the frontend can rely on rather than a breaking change added
    in later."""
    offset = max(offset, 0)
    page = items[offset : offset + limit] if limit is not None else items[offset:]
    return {"items": page, "total": len(items), "limit": limit, "offset": offset}


# --------------------------------------------------------------------------- #
# CA login — issues a session token usable as a normal CA bearer token
# alongside the static CA_ADMIN_TOKEN (see auth.require_ca_auth).
# --------------------------------------------------------------------------- #
class CALoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
async def ca_login(payload: CALoginIn) -> dict:
    user = service.store.find_user_by_email(payload.email)
    if user is None or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = service.store.create_ca_session(user["id"])
    return {"token": token, "name": user["name"], "role": user["role"], "email": user["email"]}


@router.post("/logout")
async def ca_logout(authorization: str | None = Header(default=None), _user: dict = Depends(require_ca_auth)) -> dict:
    if authorization and authorization.lower().startswith("bearer "):
        service.store.revoke_ca_session(hash_secret(authorization.split(" ", 1)[1].strip()))
    return {"logged_out": True}


# --------------------------------------------------------------------------- #
# firm-wide / admin
# --------------------------------------------------------------------------- #
@router.get("/portfolio")
async def get_portfolio(_user: dict = Depends(require_ca_auth)) -> dict:
    return service.portfolio()


@router.post("/admin/purge-expired")
async def purge_expired(_user: dict = Depends(require_ca_auth)) -> dict:
    return service.purge_expired_data()


# --------------------------------------------------------------------------- #
# clients
# --------------------------------------------------------------------------- #
@router.get("/clients")
async def list_clients(_user: dict = Depends(require_ca_auth)) -> list[dict]:
    return service.list_clients()


@router.post("/clients", status_code=201)
async def create_client(payload: ClientCreate, _user: dict = Depends(require_ca_auth)) -> dict:
    return service.create_client(payload.model_dump())


@router.get("/clients/{client_id}")
async def get_client(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    client = service.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


class PortalAccountIn(BaseModel):
    email: str
    password: str | None = None  # if omitted, a random one is generated and returned once


@router.post("/clients/{client_id}/portal-account")
async def create_portal_account(client_id: str, payload: PortalAccountIn, _user: dict = Depends(require_ca_auth)) -> dict:
    """Give a client self-service login access to their own dashboard at
    /client/*. The CA hands the (email, password) to the client out of
    band — there's no email-sending infra here, same pattern as the
    one-time-shown ERP API key."""
    if not service.store.client_exists(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    raw_password = payload.password or generate_password()
    service.store.create_client_account(client_id, payload.email, raw_password)
    service.store.log_activity(client_id, "portal_account_created", f"Portal login created for {payload.email}")
    return {"client_id": client_id, "email": payload.email.strip().lower(), "password": raw_password}


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    if not service.delete_client(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return {"client_id": client_id, "deleted": True}


@router.get("/clients/{client_id}/export")
async def export_client(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    data = service.export_client_data(client_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return data


@router.get("/clients/{client_id}/periods")
async def get_periods(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    result = service.available_periods(client_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# invoices
# --------------------------------------------------------------------------- #
@router.get("/clients/{client_id}/invoices")
async def list_invoices(
    client_id: str,
    period: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    _user: dict = Depends(require_ca_auth),
) -> dict:
    invoices = service.get_invoices(client_id, period=period)
    if invoices is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return _paginate(invoices, limit, offset)


@router.post("/clients/{client_id}/invoices")
async def add_invoices(client_id: str, batch: InvoiceBatch, _user: dict = Depends(require_ca_auth)) -> dict:
    result = service.add_invoices(client_id, [i.model_dump() for i in batch.invoices])
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.post("/clients/{client_id}/invoices/upload")
async def upload_invoices(client_id: str, file: UploadFile = File(...), _user: dict = Depends(require_ca_auth)) -> dict:
    client = service.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        records = await read_invoice_records(file, client.get("erp_config"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = service.add_invoices(client_id, records, source="import")
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# GSTR-2B baseline
# --------------------------------------------------------------------------- #
@router.post("/clients/{client_id}/baseline")
async def set_baseline(client_id: str, payload: BaselineIn, _user: dict = Depends(require_ca_auth)) -> dict:
    result = service.set_baseline(client_id, [r.model_dump() for r in payload.records], period=payload.period)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.post("/clients/{client_id}/baseline/upload")
async def upload_baseline(
    client_id: str, file: UploadFile = File(...), period: str | None = None, _user: dict = Depends(require_ca_auth)
) -> dict:
    try:
        records = await read_baseline_records(file)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = service.set_baseline(client_id, records, period=period)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# reconciliation
# --------------------------------------------------------------------------- #
@router.get("/clients/{client_id}/reconciliation")
async def get_reconciliation(client_id: str, period: str | None = None, _user: dict = Depends(require_ca_auth)) -> dict:
    result = service.get_reconciliation(client_id, period=period)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.get("/clients/{client_id}/reconciliation/history")
async def get_reconciliation_history(client_id: str, _user: dict = Depends(require_ca_auth)) -> list[dict]:
    history = service.reconciliation_history(client_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return history


@router.post("/clients/{client_id}/reconcile")
async def run_reconcile(
    client_id: str, language: str = "English", period: str | None = None, _user: dict = Depends(require_ca_auth)
) -> dict:
    result = service.run_reconcile(client_id, language=language, period=period)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


# --------------------------------------------------------------------------- #
# ITC recovery tracker
# --------------------------------------------------------------------------- #
@router.get("/issues")
async def list_all_issues(
    status: str | None = None,
    period: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    _user: dict = Depends(require_ca_auth),
) -> dict:
    return _paginate(service.list_issues(status=status, period=period), limit, offset)


@router.get("/clients/{client_id}/issues")
async def list_client_issues(
    client_id: str,
    status: str | None = None,
    period: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    _user: dict = Depends(require_ca_auth),
) -> dict:
    return _paginate(service.list_issues(client_id=client_id, status=status, period=period), limit, offset)


@router.get("/clients/{client_id}/issues/summary")
async def client_issues_summary(client_id: str, _user: dict = Depends(require_ca_auth)) -> dict:
    return service.issues_summary(client_id=client_id)


@router.post("/clients/{client_id}/issues/status")
async def set_issue_status(client_id: str, payload: IssueStatusIn, _user: dict = Depends(require_ca_auth)) -> dict:
    try:
        updated = service.update_issue_status(payload.issue_key, payload.status, payload.note, payload.updated_by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return updated


class DraftMessageIn(BaseModel):
    issue_key: str
    language: str = "en"
    polish: bool = True


@router.post("/clients/{client_id}/issues/draft-message")
async def draft_issue_message(client_id: str, payload: DraftMessageIn, _user: dict = Depends(require_ca_auth)) -> dict:
    from ..core import supplier_message

    issue = service.store.get_issue(payload.issue_key)
    if issue is None or issue["client_id"] != client_id:
        raise HTTPException(status_code=404, detail="Issue not found")
    draft = supplier_message.draft_message(issue, language=payload.language)
    final = await asyncio.to_thread(supplier_message.polish_with_groq, draft, payload.language) if payload.polish else draft
    return {"issue_key": payload.issue_key, "language": payload.language, "draft": final}


# --------------------------------------------------------------------------- #
# ERP integration ("tool on top of the company software")
# --------------------------------------------------------------------------- #
@router.post("/integrations/erp/invoices")
async def erp_ingest(batch: InvoiceBatch, x_api_key: str = Header(...)) -> dict:
    """Endpoint a client's ERP calls to push invoices into the platform.
    Authenticated by the per-client ERP API key issued at onboarding (the
    key is hashed at rest; only its creation response ever shows it raw)."""
    result = service.ingest_from_erp(x_api_key, [i.model_dump() for i in batch.invoices])
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid ERP API key")
    return result


# --------------------------------------------------------------------------- #
# feature sub-routers, composed onto the same /ca prefix
# --------------------------------------------------------------------------- #
from .vendor_scorecard import router as _vendor_router  # noqa: E402
from .alerts import router as _alerts_router  # noqa: E402
from .reminders import router as _reminders_router  # noqa: E402
from .timeline import router as _timeline_router  # noqa: E402
from .reporting import router as _reporting_router  # noqa: E402
from .simulator import router as _simulator_router  # noqa: E402
from .risk_forecast import router as _forecast_router  # noqa: E402
from .knowledge_graph import router as _graph_router  # noqa: E402
from .erp_mapping import router as _erp_mapping_router  # noqa: E402

router.include_router(_vendor_router)
router.include_router(_alerts_router)
router.include_router(_reminders_router)
router.include_router(_timeline_router)
router.include_router(_reporting_router)
router.include_router(_simulator_router)
router.include_router(_forecast_router)
router.include_router(_graph_router)
router.include_router(_erp_mapping_router)
