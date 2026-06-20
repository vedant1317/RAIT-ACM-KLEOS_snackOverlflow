"""Trader-facing read endpoints for WhatsApp: a compact 'status' mini-card
summary and a structured facts context for the 'Ask Munshi' Q&A flow. Both
reuse the deterministic reconciliation engine — no new money math, and
Groq (on the Twilio side) only ever narrates the facts returned here.
"""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..core.period_utils import current_period
from ..ca_platform.auth import require_service_token
from ..core.reconciliation_engine import reconcile
from ..db.mongo import get_db

router = APIRouter(prefix="/traders", dependencies=[Depends(require_service_token)])


def _load(trader_id: str) -> tuple[list[dict], list[dict]]:
    db = get_db()
    invoices = (db.invoices.find_one({"trader_id": trader_id}) or {}).get("records", [])
    baseline = (db.baselines.find_one({"trader_id": trader_id}) or {}).get("records", [])
    return invoices, baseline


_TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
)


def _table(rows: list[list[str]], col_widths: list[int] | None = None) -> Table:
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(_TABLE_STYLE)
    return table


def _build_trader_report_pdf(trader_id: str, period: str, invoices: list[dict], baseline: list[dict]) -> bytes:
    result = reconcile(trader_id, invoices, baseline)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Munshi GST Report {period}")
    styles = getSampleStyleSheet()

    story = [
        Paragraph("Munshi GST Reconciliation Report", styles["Title"]),
        Paragraph(f"Trader: {trader_id}", styles["Normal"]),
        Paragraph(f"Period: {period}", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("Summary", styles["Heading2"]),
        _table(
            [
                ["Metric", "Value"],
                ["Invoices uploaded", str(result.total_invoices)],
                ["GSTR-2B rows", str(len(baseline))],
                ["Open issues", str(len(result.mismatches))],
                ["ITC at risk", f"Rs.{result.total_recoverable_or_blocked:,.2f}"],
            ],
            col_widths=[260, 200],
        ),
        Spacer(1, 12),
        Paragraph("Issue Details", styles["Heading2"]),
    ]

    issue_rows = [["Invoice #", "Supplier", "Issue", "Rupee impact", "Action"]]
    for mismatch in result.mismatches:
        issue_rows.append(
            [
                mismatch.invoice_number,
                mismatch.vendor_name,
                mismatch.type.value,
                f"Rs.{mismatch.rupee_impact:,.2f}",
                mismatch.details.get("recommendation", ""),
            ]
        )
    if len(issue_rows) == 1:
        issue_rows.append(["-", "-", "No issues found", "Rs.0.00", "No action needed"])
    story.append(_table(issue_rows, col_widths=[75, 120, 90, 80, 135]))

    story += [Spacer(1, 12), Paragraph("Invoice Annexure", styles["Heading2"])]
    invoice_rows = [["Invoice #", "Supplier", "GSTIN", "GST amount", "HSN/SAC"]]
    for invoice in invoices:
        invoice_rows.append(
            [
                str(invoice.get("invoice_number", "")),
                str(invoice.get("vendor_name", "")),
                str(invoice.get("vendor_gstin", "")),
                f"Rs.{float(invoice.get('gst_amount') or 0):,.2f}",
                str(invoice.get("hsn_code", "")),
            ]
        )
    story.append(_table(invoice_rows, col_widths=[80, 120, 110, 80, 70]))

    doc.build(story)
    return buffer.getvalue()


@router.get("/{trader_id}/summary")
async def trader_summary(trader_id: str) -> dict:
    invoices, baseline = _load(trader_id)
    if not invoices or not baseline:
        return {
            "trader_id": trader_id,
            "invoices_uploaded": len(invoices),
            "has_2b": bool(baseline),
            "itc_at_risk": 0.0,
            "issues_open": 0,
            "top_supplier": None,
            "next_action": (
                "Send your invoices and GSTR-2B file to get started."
                if not invoices
                else "Send your GSTR-2B file to run a check."
            ),
        }

    result = reconcile(trader_id, invoices, baseline)
    by_vendor: dict[str, float] = {}
    for m in result.mismatches:
        by_vendor[m.vendor_name] = by_vendor.get(m.vendor_name, 0.0) + m.rupee_impact
    top_supplier = max(by_vendor.items(), key=lambda kv: kv[1])[0] if by_vendor else None
    top_mismatch = max(result.mismatches, key=lambda m: m.rupee_impact) if result.mismatches else None

    return {
        "trader_id": trader_id,
        "invoices_uploaded": len(invoices),
        "has_2b": True,
        "itc_at_risk": result.total_recoverable_or_blocked,
        "issues_open": len(result.mismatches),
        "top_supplier": top_supplier,
        "next_action": (
            top_mismatch.details.get("recommendation")
            if top_mismatch
            else "No issues found — you're all clear this month."
        ),
    }


@router.get("/{trader_id}/context")
async def trader_context(trader_id: str) -> dict:
    """Structured, already-computed facts for the 'Ask Munshi' Q&A flow —
    Groq narrates from this; it never recalculates a number itself."""
    invoices, baseline = _load(trader_id)
    if not invoices or not baseline:
        return {"trader_id": trader_id, "has_data": False, "mismatches": []}

    result = reconcile(trader_id, invoices, baseline)
    return {
        "trader_id": trader_id,
        "has_data": True,
        "total_invoices": result.total_invoices,
        "total_recoverable_or_blocked": result.total_recoverable_or_blocked,
        "mismatches": [
            {
                "invoice_number": m.invoice_number,
                "vendor_name": m.vendor_name,
                "vendor_gstin": m.vendor_gstin,
                "type": m.type.value,
                "rupee_impact": m.rupee_impact,
                "recommendation": m.details.get("recommendation"),
            }
            for m in result.mismatches
        ],
    }


@router.get("/{trader_id}/report")
async def trader_report(trader_id: str, period: str | None = None) -> Response:
    invoices, baseline = _load(trader_id)
    if not invoices or not baseline:
        raise HTTPException(status_code=404, detail="Send invoices and GSTR-2B before asking for a report.")

    resolved_period = period or current_period()
    pdf_bytes = _build_trader_report_pdf(trader_id, resolved_period, invoices, baseline)
    filename = f"munshi-gst-report-{resolved_period}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
