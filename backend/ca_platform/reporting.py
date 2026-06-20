"""Backend-generated monthly client report (PDF): summary, ITC at risk vs
recovered, supplier-wise issues, invoice annexure, action checklist, and
issue statuses. Generated on demand from already-persisted reconciliation
data — no AI involved in any of the numbers.
"""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..core.period_utils import current_period
from . import service, store
from .auth import require_ca_auth

router = APIRouter()

_HEADER_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
)


def _table(data: list[list[str]], col_widths: list[int] | None = None) -> Table:
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(_HEADER_STYLE)
    return t


def build_monthly_report_pdf(client_id: str, period: str) -> bytes:
    client = store.get_client(client_id)
    if client is None:
        raise ValueError("Client not found")

    run = store.latest_reconciliation_run(client_id, period=period)
    if run is None:
        run = service.run_reconcile(client_id, period=period)
    summary = run["summary"]
    rows = run["rows"]
    issues_summary = service.issues_summary(client_id=client_id)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"{client['name']} GST Compliance Report {period}")
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"GST Compliance Report — {client['name']}", styles["Title"]),
        Paragraph(f"Period: {period} | GSTIN: {client.get('gstin', '-')}", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("Summary", styles["Heading2"]),
        _table(
            [
                ["Metric", "Value"],
                ["Total invoices", str(summary["total_invoices"])],
                ["Total GSTR-2B rows", str(summary["total_2b_rows"])],
                ["ITC at risk", f"Rs.{summary['itc_at_risk']:,.2f}"],
                ["ITC blocked (missing from 2B)", f"Rs.{summary['itc_blocked']:,.2f}"],
                ["ITC recovered (resolved issues)", f"Rs.{issues_summary['itc_recovered']:,.2f}"],
                ["ITC still open", f"Rs.{issues_summary['itc_still_open']:,.2f}"],
                ["Health score", f"{summary['health_score']}/100"],
            ],
            col_widths=[260, 200],
        ),
        Spacer(1, 12),
        Paragraph("Supplier-wise issues", styles["Heading2"]),
    ]

    by_vendor: dict[str, list[dict]] = {}
    for row in rows:
        for issue in row["issues"]:
            by_vendor.setdefault(row["vendor_name"], []).append(issue)
    vendor_table = [["Supplier", "Issues", "Rupee impact"]]
    for vendor, issues in sorted(by_vendor.items(), key=lambda kv: -sum(i["rupee_impact"] for i in kv[1])):
        vendor_table.append([vendor, str(len(issues)), f"Rs.{sum(i['rupee_impact'] for i in issues):,.2f}"])
    story.append(_table(vendor_table, col_widths=[220, 80, 160]))

    story += [Spacer(1, 12), Paragraph("Invoice annexure", styles["Heading2"])]
    annexure = [["Invoice #", "Vendor", "Status", "Rupee impact"]]
    for row in rows:
        annexure.append([row["invoice_number"], row["vendor_name"], row["status"], f"Rs.{row['rupee_impact']:,.2f}"])
    story.append(_table(annexure, col_widths=[100, 180, 90, 90]))

    story += [Spacer(1, 12), Paragraph("Action checklist", styles["Heading2"])]
    checklist = [["Invoice #", "Action", "Status"]]
    for row in rows:
        for issue in row["issues"]:
            checklist.append([row["invoice_number"], issue["recommendation"], issue.get("status", "open")])
    story.append(_table(checklist, col_widths=[80, 300, 80]))

    doc.build(story)
    return buffer.getvalue()


async def _render(client_id: str, period: str | None) -> Response:
    resolved_period = period or current_period()
    try:
        pdf_bytes = build_monthly_report_pdf(client_id, resolved_period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    store.log_activity(client_id, "report_generated", f"Monthly report generated for {resolved_period}")
    filename = f"gst-report-{client_id}-{resolved_period}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/clients/{client_id}/reports/monthly")
async def get_monthly_report(client_id: str, period: str | None = None, _user: dict = Depends(require_ca_auth)) -> Response:
    return await _render(client_id, period)


@router.post("/clients/{client_id}/reports/monthly")
async def post_monthly_report(client_id: str, period: str | None = None, _user: dict = Depends(require_ca_auth)) -> Response:
    return await _render(client_id, period)
