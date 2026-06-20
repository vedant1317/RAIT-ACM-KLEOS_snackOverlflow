"""Business logic for the CA platform: client portfolio, per-client
reconciliation (reusing the compliance brain), and ERP ingestion.

Persistence lives in MongoDB via ``store.py``. Every reconciliation run is
kept (not overwritten) and every flagged issue is upserted into the ITC
recovery tracker (``ca_issues``) keyed by a stable
``client_id|vendor_gstin|invoice_number|issue_type|period`` issue key, so a
status set on one run (open/chasing/resolved/ignored) survives into the next.
"""

from __future__ import annotations

import os
from typing import Any

from ..core.period_utils import current_period
from . import matching, store


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _client_status(summary: dict) -> str:
    if summary["total_invoices"] == 0:
        return "awaiting_data"
    if summary["total_2b_rows"] == 0:
        return "awaiting_2b"
    if summary["total_issues"] == 0:
        return "clean"
    if summary["itc_at_risk"] >= 5000 or summary["missing_in_2b"] > 0:
        return "action_required"
    return "review"


def _persist_issues(client_id: str, rows: list[dict]) -> None:
    """Upsert every flagged issue into the recovery tracker and merge the
    persisted status/note back onto the in-memory row so callers see it."""
    for row in rows:
        for issue in row["issues"]:
            if "issue_key" not in issue:
                continue
            persisted = store.upsert_issue(
                {
                    "issue_key": issue["issue_key"],
                    "client_id": client_id,
                    "vendor_gstin": row.get("vendor_gstin", ""),
                    "vendor_name": row.get("vendor_name", ""),
                    "invoice_number": row.get("invoice_number", ""),
                    "type": issue["type"],
                    "period": issue.get("period", current_period()),
                    "rupee_impact": issue["rupee_impact"],
                    "message": issue["message"],
                    "recommendation": issue["recommendation"],
                    "severity": issue["severity"],
                    "action_card": issue.get("action_card"),
                }
            )
            issue["status"] = persisted["status"]
            issue["note"] = persisted["note"]
            issue["updated_at"] = persisted["updated_at"]


def _merge_issue_status_readonly(rows: list[dict]) -> None:
    """Read-only variant for ``get_reconciliation`` (no upsert, no tracking
    side-effects) — shows whatever status already exists, defaults otherwise."""
    for row in rows:
        for issue in row["issues"]:
            issue_key = issue.get("issue_key")
            if not issue_key:
                continue
            existing = store.get_issue(issue_key)
            issue["status"] = existing["status"] if existing else "open"
            issue["note"] = existing["note"] if existing else ""


# --------------------------------------------------------------------------- #
# clients
# --------------------------------------------------------------------------- #
def _summarise_client(client: dict) -> dict:
    invoices = store.list_invoices(client["id"])
    baseline = store.list_baseline(client["id"])
    summary = matching.build_mapping(invoices, baseline, client_id=client["id"])["summary"]
    last_run = store.latest_reconciliation_run(client["id"])
    return {
        **client,
        "summary": summary,
        "status": _client_status(summary),
        "last_reconciled_at": last_run["run_at"] if last_run else None,
    }


def list_clients() -> list[dict]:
    return [_summarise_client(c) for c in store.list_clients()]


def get_client(client_id: str) -> dict | None:
    client = store.get_client(client_id)
    if client is None:
        return None
    return _summarise_client(client)


def create_client(payload: dict) -> dict:
    client_id = store.new_id("cli")
    client = {
        "id": client_id,
        "firm_id": store.FIRM_ID,
        "name": payload["name"],
        "gstin": payload.get("gstin", ""),
        "industry": payload.get("industry", ""),
        "contact_name": payload.get("contact_name", ""),
        "contact_phone": payload.get("contact_phone", ""),
        "erp_system": payload.get("erp_system", ""),
        "filing_frequency": payload.get("filing_frequency", "monthly"),
        "created_at": store.now(),
    }
    store.insert_client(client)
    raw_erp_key = store.create_erp_key(client_id)
    store.log_activity(client_id, "client_created", f"Onboarded client {client['name']}")
    summary = _summarise_client(store.get_client(client_id))
    return {**summary, "erp_api_key": raw_erp_key}


def delete_client(client_id: str) -> bool:
    if not store.client_exists(client_id):
        return False
    store.soft_delete_client(client_id)
    store.revoke_erp_keys(client_id)
    store.log_activity(client_id, "client_removed", "Client offboarded")
    return True


def export_client_data(client_id: str) -> dict | None:
    """Privacy-compliance export: everything the platform holds for one
    client, in one document, for a data-subject access request."""
    client = store.get_client(client_id)
    if client is None:
        return None
    return {
        "client": client,
        "invoices": store.list_invoices(client_id),
        "gstr2b_baseline": store.list_baseline(client_id),
        "reconciliation_runs": store.list_reconciliation_runs(client_id, limit=10_000),
        "issues": store.list_issues(client_id=client_id),
        "audit_log": store.list_activity(client_id=client_id, limit=10_000),
    }


def purge_expired_data() -> dict:
    """Retention-policy sweep: deletes audit-log entries older than
    ``DATA_RETENTION_DAYS`` (default 365). Invoices/baselines/issues are kept
    indefinitely since they're the CA's working records, not raw logs."""
    days = int(os.environ.get("DATA_RETENTION_DAYS", "365"))
    removed = store.purge_audit_logs_older_than(days)
    return {"retention_days": days, "audit_logs_removed": removed}


# --------------------------------------------------------------------------- #
# invoices & baseline
# --------------------------------------------------------------------------- #
def get_invoices(client_id: str, period: str | None = None) -> list[dict] | None:
    if not store.client_exists(client_id):
        return None
    return store.list_invoices(client_id, period)


def add_invoices(client_id: str, records: list[dict], source: str = "manual") -> dict | None:
    if not store.client_exists(client_id):
        return None
    inserted = store.add_invoices(client_id, records, source=source)
    store.log_activity(client_id, "invoices_added", f"{len(inserted)} invoice(s) ingested via {source}")
    return {"client_id": client_id, "added": len(inserted), "total": store.count_invoices(client_id)}


def set_baseline(client_id: str, records: list[dict], period: str | None = None) -> dict | None:
    if not store.client_exists(client_id):
        return None
    resolved_period = period or current_period()
    inserted = store.set_baseline(client_id, records, period=resolved_period)
    store.log_activity(client_id, "baseline_uploaded", f"GSTR-2B uploaded for {resolved_period} ({len(inserted)} rows)")
    return {"client_id": client_id, "period": resolved_period, "rows_loaded": len(inserted)}


def available_periods(client_id: str) -> dict | None:
    if not store.client_exists(client_id):
        return None
    periods = sorted(set(store.list_invoice_periods(client_id)) | set(store.list_baseline_periods(client_id)))
    return {"client_id": client_id, "periods": periods}


# --------------------------------------------------------------------------- #
# reconciliation
# --------------------------------------------------------------------------- #
def get_reconciliation(client_id: str, period: str | None = None) -> dict | None:
    if not store.client_exists(client_id):
        return None
    invoices = store.list_invoices(client_id, period)
    baseline = store.list_baseline(client_id, period)
    mapping = matching.build_mapping(invoices, baseline, client_id=client_id)
    _merge_issue_status_readonly(mapping["rows"])
    return {"client_id": client_id, "period": period or "ALL", **mapping}


def run_reconcile(client_id: str, language: str = "English", period: str | None = None) -> dict | None:
    """Run the mapping and, if a Groq key is configured, add plain-language
    narration for each flagged row. Persists a snapshot (kept forever, not
    overwritten) and upserts every issue into the recovery tracker."""
    if not store.client_exists(client_id):
        return None
    invoices = store.list_invoices(client_id, period)
    baseline = store.list_baseline(client_id, period)
    mapping = matching.build_mapping(invoices, baseline, client_id=client_id)

    explanations = _narrate(mapping["rows"], language)
    _persist_issues(client_id, mapping["rows"])

    resolved_period = period or "ALL"
    snapshot = {
        "client_id": client_id,
        "period": resolved_period,
        "run_at": store.now(),
        "language": language,
        "summary": mapping["summary"],
        "explanations": explanations,
        "rows": mapping["rows"],
    }
    saved = store.save_reconciliation_run(snapshot)
    store.log_activity(
        client_id,
        "reconciled",
        f"Reconciliation run ({resolved_period}): {mapping['summary']['total_issues']} issue(s), "
        f"Rs.{mapping['summary']['itc_at_risk']:,.0f} at risk",
    )
    return {**snapshot, "run_id": saved["id"]}


def reconciliation_history(client_id: str, limit: int = 50) -> list[dict] | None:
    if not store.client_exists(client_id):
        return None
    return store.list_reconciliation_runs(client_id, limit=limit)


def _narrate(rows: list[dict], language: str) -> list[dict]:
    """Optional LLM narration of flagged rows. Always returns a deterministic
    fallback line so the CA sees something even with no Groq key."""
    flagged = [r for r in rows if r["status"] != "matched"]
    out: list[dict] = []
    try:
        from ..core import explanation_service
        from ..models.schemas import Mismatch, MismatchType

        _type_map = {
            "missing_in_2b": MismatchType.MISSING_FROM_2B,
            "missing_in_books": MismatchType.MISSING_FROM_2B,
            "duplicate": MismatchType.DUPLICATE,
            "mismatch": MismatchType.AMOUNT_DIFF,
        }
        for row in flagged:
            primary = row["issues"][0] if row["issues"] else None
            text = None
            if primary is not None:
                m = Mismatch(
                    type=_type_map.get(row["status"], MismatchType.AMOUNT_DIFF),
                    invoice_number=row["invoice_number"],
                    vendor_name=row["vendor_name"],
                    vendor_gstin=row["vendor_gstin"],
                    rupee_impact=row["rupee_impact"],
                    details={"recommendation": primary["recommendation"]},
                )
                text = explanation_service.explain_mismatch(m, language=language)
            out.append(
                {
                    "invoice_number": row["invoice_number"],
                    "vendor_name": row["vendor_name"],
                    "status": row["status"],
                    "rupee_impact": row["rupee_impact"],
                    "text": text or (row["issues"][0]["message"] if row["issues"] else ""),
                }
            )
    except Exception:
        for row in flagged:
            out.append(
                {
                    "invoice_number": row["invoice_number"],
                    "vendor_name": row["vendor_name"],
                    "status": row["status"],
                    "rupee_impact": row["rupee_impact"],
                    "text": row["issues"][0]["message"] if row["issues"] else "",
                }
            )
    return out


# --------------------------------------------------------------------------- #
# issue lifecycle (ITC recovery tracker)
# --------------------------------------------------------------------------- #
def list_issues(client_id: str | None = None, status: str | None = None, period: str | None = None) -> list[dict]:
    return store.list_issues(client_id=client_id, status=status, period=period)


def update_issue_status(issue_key: str, status: str, note: str, updated_by: str) -> dict | None:
    valid = {"open", "chasing", "resolved", "ignored"}
    if status not in valid:
        raise ValueError(f"status must be one of {sorted(valid)}")
    updated = store.set_issue_status(issue_key, status, note, updated_by)
    if updated is not None:
        store.log_activity(
            updated["client_id"], "issue_status_changed",
            f"Issue {issue_key} marked {status}" + (f" — {note}" if note else ""),
            actor=updated_by,
        )
    return updated


def issues_summary(client_id: str | None = None) -> dict:
    issues = store.list_issues(client_id=client_id)
    open_amount = sum(i["rupee_impact"] for i in issues if i["status"] in ("open", "chasing"))
    resolved_amount = sum(i["rupee_impact"] for i in issues if i["status"] == "resolved")
    return {
        "issues_open": sum(1 for i in issues if i["status"] == "open"),
        "issues_chasing": sum(1 for i in issues if i["status"] == "chasing"),
        "issues_resolved": sum(1 for i in issues if i["status"] == "resolved"),
        "issues_ignored": sum(1 for i in issues if i["status"] == "ignored"),
        "itc_still_open": float(round(open_amount, 2)),
        "itc_recovered": float(round(resolved_amount, 2)),
    }


# --------------------------------------------------------------------------- #
# firm-wide portfolio (admin dashboard)
# --------------------------------------------------------------------------- #
def portfolio() -> dict:
    clients = list_clients()

    totals = {
        "clients": len(clients),
        "total_invoices": sum(c["summary"]["total_invoices"] for c in clients),
        "total_issues": sum(c["summary"]["total_issues"] for c in clients),
        "itc_at_risk": float(round(sum(c["summary"]["itc_at_risk"] for c in clients), 2)),
        "itc_blocked": float(round(sum(c["summary"]["itc_blocked"] for c in clients), 2)),
        "action_required": sum(1 for c in clients if c["status"] == "action_required"),
        "clean": sum(1 for c in clients if c["status"] == "clean"),
        "avg_health_score": round(sum(c["summary"]["health_score"] for c in clients) / len(clients))
        if clients
        else 100,
    }

    # Clients ranked by financial exposure (the client-prioritisation novelty).
    ranked = sorted(clients, key=lambda c: c["summary"]["itc_at_risk"], reverse=True)

    return {
        "firm": store.get_firm(),
        "totals": totals,
        "clients": clients,
        "priority_clients": ranked[:5],
        "activity": store.list_activity(limit=15),
    }


# --------------------------------------------------------------------------- #
# ERP integration
# --------------------------------------------------------------------------- #
def ingest_from_erp(api_key: str, records: list[dict]) -> dict | None:
    client_id = store.resolve_erp_key(api_key)
    if client_id is None:
        return None

    existing_keys = store.existing_invoice_keys(client_id)
    fresh: list[dict] = []
    skipped = 0
    for record in records:
        key = (
            str(record.get("vendor_gstin", "")).strip().upper(),
            str(record.get("invoice_number", "")).strip().upper(),
        )
        if key in existing_keys:
            skipped += 1
            continue
        existing_keys.add(key)  # de-dupe within the same push too
        fresh.append(record)

    result = add_invoices(client_id, fresh, source="erp")
    store.insert_erp_sync_log(
        {
            "client_id": client_id,
            "received": len(records),
            "inserted": len(fresh),
            "skipped_duplicates": skipped,
        }
    )
    if result is None:
        return None
    return {**result, "skipped_duplicates": skipped}
