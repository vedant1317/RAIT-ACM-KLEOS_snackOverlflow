"""Business logic for the CA platform: client portfolio, per-client
reconciliation (reusing the compliance brain), and ERP ingestion."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from . import matching, store


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _log(state: dict, client_id: str | None, kind: str, message: str) -> None:
    state.setdefault("activity", []).insert(
        0,
        {"id": _new_id("act"), "client_id": client_id, "kind": kind, "message": message, "at": _now()},
    )
    del state["activity"][200:]  # keep the log bounded


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


# --------------------------------------------------------------------------- #
# clients
# --------------------------------------------------------------------------- #
def _summarise_client(state: dict, client: dict) -> dict:
    invoices = state["invoices"].get(client["id"], [])
    baseline = state["baselines"].get(client["id"], [])
    summary = matching.build_mapping(invoices, baseline)["summary"]
    recon = state["reconciliations"].get(client["id"], {})
    return {
        **client,
        "summary": summary,
        "status": _client_status(summary),
        "last_reconciled_at": recon.get("run_at"),
    }


def list_clients() -> list[dict]:
    state = store.read()
    return [_summarise_client(state, c) for c in state["clients"]]


def get_client(client_id: str) -> dict | None:
    state = store.read()
    client = next((c for c in state["clients"] if c["id"] == client_id), None)
    if client is None:
        return None
    return _summarise_client(state, client)


def create_client(payload: dict) -> dict:
    def _do(state: dict) -> dict:
        client = {
            "id": _new_id("cli"),
            "name": payload["name"],
            "gstin": payload.get("gstin", ""),
            "industry": payload.get("industry", ""),
            "contact_name": payload.get("contact_name", ""),
            "contact_phone": payload.get("contact_phone", ""),
            "erp_system": payload.get("erp_system", ""),
            "filing_frequency": payload.get("filing_frequency", "monthly"),
            "created_at": _now(),
            "erp_api_key": f"erp_{secrets.token_hex(16)}",
        }
        state["clients"].append(client)
        state["invoices"].setdefault(client["id"], [])
        state["baselines"].setdefault(client["id"], [])
        state["erp_keys"][client["erp_api_key"]] = client["id"]
        _log(state, client["id"], "client_created", f"Onboarded client {client['name']}")
        return _summarise_client(state, client)

    return store.mutate(_do)


# --------------------------------------------------------------------------- #
# invoices & baseline
# --------------------------------------------------------------------------- #
def get_invoices(client_id: str) -> list[dict] | None:
    state = store.read()
    if not any(c["id"] == client_id for c in state["clients"]):
        return None
    return state["invoices"].get(client_id, [])


def add_invoices(client_id: str, records: list[dict], source: str = "manual") -> dict | None:
    def _do(state: dict) -> dict | None:
        if not any(c["id"] == client_id for c in state["clients"]):
            return None
        bucket = state["invoices"].setdefault(client_id, [])
        for record in records:
            record = dict(record)
            record.setdefault("id", _new_id("inv"))
            record["source"] = source
            record["added_at"] = _now()
            bucket.append(record)
        _log(state, client_id, "invoices_added", f"{len(records)} invoice(s) ingested via {source}")
        return {"client_id": client_id, "added": len(records), "total": len(bucket)}

    return store.mutate(_do)


def set_baseline(client_id: str, records: list[dict]) -> dict | None:
    def _do(state: dict) -> dict | None:
        if not any(c["id"] == client_id for c in state["clients"]):
            return None
        state["baselines"][client_id] = list(records)
        _log(state, client_id, "baseline_uploaded", f"GSTR-2B uploaded ({len(records)} rows)")
        return {"client_id": client_id, "rows_loaded": len(records)}

    return store.mutate(_do)


# --------------------------------------------------------------------------- #
# reconciliation
# --------------------------------------------------------------------------- #
def get_reconciliation(client_id: str) -> dict | None:
    state = store.read()
    if not any(c["id"] == client_id for c in state["clients"]):
        return None
    invoices = state["invoices"].get(client_id, [])
    baseline = state["baselines"].get(client_id, [])
    mapping = matching.build_mapping(invoices, baseline)
    return {"client_id": client_id, **mapping}


def run_reconcile(client_id: str, language: str = "English") -> dict | None:
    """Run the mapping and, if a Groq key is configured, add plain-language
    narration for each flagged row. Persists a snapshot for the dashboards."""
    state = store.read()
    if not any(c["id"] == client_id for c in state["clients"]):
        return None
    invoices = state["invoices"].get(client_id, [])
    baseline = state["baselines"].get(client_id, [])
    mapping = matching.build_mapping(invoices, baseline)

    explanations = _narrate(mapping["rows"], language)

    snapshot = {
        "client_id": client_id,
        "run_at": _now(),
        "language": language,
        "summary": mapping["summary"],
        "explanations": explanations,
    }

    def _do(s: dict) -> None:
        s["reconciliations"][client_id] = snapshot
        _log(
            s,
            client_id,
            "reconciled",
            f"Reconciliation run: {mapping['summary']['total_issues']} issue(s), "
            f"Rs.{mapping['summary']['itc_at_risk']:,.0f} at risk",
        )

    store.mutate(_do)
    return {**snapshot, "rows": mapping["rows"]}


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
# firm-wide portfolio (admin dashboard)
# --------------------------------------------------------------------------- #
def portfolio() -> dict:
    state = store.read()
    clients = [_summarise_client(state, c) for c in state["clients"]]

    totals = {
        "clients": len(clients),
        "total_invoices": sum(c["summary"]["total_invoices"] for c in clients),
        "total_issues": sum(c["summary"]["total_issues"] for c in clients),
        "itc_at_risk": float(round(sum(c["summary"]["itc_at_risk"] for c in clients), 2)),
        "itc_blocked": float(round(sum(c["summary"]["itc_blocked"] for c in clients), 2)),
        "action_required": sum(1 for c in clients if c["status"] == "action_required"),
        "clean": sum(1 for c in clients if c["status"] == "clean"),
        "avg_health_score": round(
            sum(c["summary"]["health_score"] for c in clients) / len(clients)
        )
        if clients
        else 100,
    }

    # Clients ranked by financial exposure (the client-prioritisation novelty).
    ranked = sorted(clients, key=lambda c: c["summary"]["itc_at_risk"], reverse=True)

    return {
        "firm": state["firm"],
        "totals": totals,
        "clients": clients,
        "priority_clients": ranked[:5],
        "activity": state.get("activity", [])[:15],
    }


# --------------------------------------------------------------------------- #
# ERP integration
# --------------------------------------------------------------------------- #
def ingest_from_erp(api_key: str, records: list[dict]) -> dict | None:
    state = store.read()
    client_id = state.get("erp_keys", {}).get(api_key)
    if client_id is None:
        return None
    return add_invoices(client_id, records, source="erp")
