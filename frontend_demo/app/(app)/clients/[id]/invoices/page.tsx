"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { inr, STATUS_META } from "@/lib/format";
import { Card, Spinner, Badge, SectionTitle } from "@/components/ui";
import type { MappingRow } from "@/lib/types";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mismatch", label: "Wrong details" },
  { key: "duplicate", label: "Duplicates" },
  { key: "missing_in_2b", label: "Missing from 2B" },
  { key: "missing_in_books", label: "Missing in books" },
  { key: "matched", label: "Matched" },
];

const FIELD_LABEL: Record<string, string> = {
  taxable_value: "Taxable value",
  gst_rate: "GST rate",
  gst_amount: "GST amount",
  hsn_code: "HSN code",
  invoice_date: "Invoice date",
  vendor_name: "Vendor name",
};

export default function InvoiceManagerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const client = useFetch(() => api.client(id), [id]);
  const recon = useFetch(() => api.reconciliation(id), [id]);

  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const baselineInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);

  const rows = recon.data?.rows ?? [];
  const summary = recon.data?.summary;

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  async function refresh() {
    await Promise.all([client.reload(), recon.reload()]);
  }

  async function onUpload(kind: "2b" | "inv", file?: File) {
    if (!file) return;
    setBusy(kind);
    try {
      if (kind === "2b") await api.uploadBaseline(id, file);
      else await api.uploadInvoices(id, file);
      await refresh();
    } catch (e) {
      alert(`Upload failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  async function runReconcile() {
    setBusy("reconcile");
    try {
      await api.reconcile(id);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (client.loading || recon.loading)
    return (
      <div className="py-20">
        <Spinner label="Loading invoice manager…" />
      </div>
    );

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/clients" className="hover:text-brand">Clients</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/clients/${id}`} className="hover:text-brand">
          {client.data?.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Invoice Manager</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Invoice Manager
          </h1>
          <p className="text-sm text-muted">
            Every invoice mapped to GSTR-2B — duplicates, missing entries and
            wrong details flagged with their ITC impact.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={invoiceInput}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => onUpload("inv", e.target.files?.[0])}
          />
          <input
            ref={baselineInput}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => onUpload("2b", e.target.files?.[0])}
          />
          <button
            onClick={() => invoiceInput.current?.click()}
            disabled={!!busy}
            className="btn btn-ghost disabled:opacity-50"
          >
            {busy === "inv" ? "Uploading…" : "Import invoices"}
          </button>
          <button
            onClick={() => baselineInput.current?.click()}
            disabled={!!busy}
            className="btn btn-ghost disabled:opacity-50"
          >
            {busy === "2b" ? "Uploading…" : "Upload GSTR-2B"}
          </button>
          <button
            onClick={runReconcile}
            disabled={!!busy}
            className="btn btn-primary disabled:opacity-50"
          >
            {busy === "reconcile" ? "Reconciling…" : "Run reconciliation"}
          </button>
        </div>
      </header>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Chip label="Total" value={summary.total_invoices} />
          <Chip label="Matched" value={summary.matched} tone="green" />
          <Chip label="Wrong details" value={summary.mismatches} tone="amber" />
          <Chip label="Duplicates" value={summary.duplicates} tone="red" />
          <Chip label="Missing 2B" value={summary.missing_in_2b} tone="red" />
          <Chip label="Missing books" value={summary.missing_in_books} tone="indigo" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-brand text-white shadow-[0_6px_18px_-8px_var(--ring)]"
                : "border border-border bg-surface text-muted hover:bg-elevated hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted">
          ITC at risk:{" "}
          <span className="font-semibold" style={{ color: "var(--red)" }}>
            {inr(summary?.itc_at_risk ?? 0)}
          </span>
        </span>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          No invoices yet. Import invoices and upload this client’s GSTR-2B to
          start mapping.
        </Card>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Taxable</th>
                <th className="px-4 py-3 text-right font-medium">GST</th>
                <th className="px-4 py-3 font-medium">HSN</th>
                <th className="px-4 py-3 text-right font-medium">ITC impact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <Row
                  key={`${row.invoice_number}-${i}`}
                  row={row}
                  open={expanded === `${row.invoice_number}-${i}`}
                  onToggle={() =>
                    setExpanded(
                      expanded === `${row.invoice_number}-${i}`
                        ? null
                        : `${row.invoice_number}-${i}`,
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  const color: Record<string, string> = {
    green: "var(--green)",
    amber: "var(--amber)",
    red: "var(--red)",
    indigo: "var(--indigo)",
    slate: "var(--foreground)",
  };
  return (
    <Card hover className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums" style={{ color: color[tone] ?? "var(--foreground)" }}>
        {value}
      </p>
    </Card>
  );
}

function val(row: MappingRow, field: "taxable_value" | "gst_amount" | "hsn_code") {
  const src = row.book ?? row.gstr2b;
  return src ? src[field] : "—";
}

function Row({
  row,
  open,
  onToggle,
}: {
  row: MappingRow;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[row.status] ?? STATUS_META.matched;
  const diffFields = new Set(row.field_diffs.map((d) => d.field));
  const hsnIssue = row.issues.some((x) => x.type === "hsn_mismatch");

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-elevated"
      >
        <td className="px-4 py-3">
          <p className="font-medium text-foreground">{row.invoice_number}</p>
          <p className="text-xs text-muted">{row.vendor_name}</p>
        </td>
        <td className="px-4 py-3">
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {typeof val(row, "taxable_value") === "number"
            ? inr(val(row, "taxable_value") as number)
            : "—"}
        </td>
        <td
          className={`px-4 py-3 text-right tabular-nums ${
            diffFields.has("gst_amount") ? "font-semibold text-[color:var(--amber)]" : ""
          }`}
        >
          {typeof val(row, "gst_amount") === "number"
            ? inr(val(row, "gst_amount") as number)
            : "—"}
        </td>
        <td className={`px-4 py-3 tabular-nums ${hsnIssue ? "text-[color:var(--amber)]" : ""}`}>
          {val(row, "hsn_code")}
          {hsnIssue && " ⚠"}
        </td>
        <td className="px-4 py-3 text-right font-medium tabular-nums">
          {row.rupee_impact > 0 ? (
            <span className="text-[color:var(--red)]">{inr(row.rupee_impact)}</span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-muted">{open ? "▲" : "▼"}</td>
      </tr>

      {open && (
        <tr className="bg-elevated/60">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-pop">
              {/* book vs 2B comparison */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Books vs GSTR-2B
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 font-medium">Field</th>
                      <th className="py-1 font-medium">In books</th>
                      <th className="py-1 font-medium">In GSTR-2B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["vendor_name", "taxable_value", "gst_rate", "gst_amount", "hsn_code", "invoice_date"] as const).map(
                      (f) => {
                        const changed = diffFields.has(f);
                        return (
                          <tr key={f} className="border-t border-border/70">
                            <td className="py-1.5 text-muted">{FIELD_LABEL[f]}</td>
                            <td className={`py-1.5 ${changed ? "font-semibold text-[color:var(--amber)]" : "text-foreground"}`}>
                              {row.book ? String(row.book[f]) : "—"}
                            </td>
                            <td className={`py-1.5 ${changed ? "font-semibold text-[color:var(--amber)]" : "text-foreground"}`}>
                              {row.gstr2b ? String(row.gstr2b[f]) : "—"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* issues + recommendations */}
              <div className="space-y-2">
                {row.issues.length === 0 && (
                  <div
                    className="rounded-lg p-3 text-sm"
                    style={{ background: "var(--green-bg)", color: "var(--green)" }}
                  >
                    This invoice matches GSTR-2B exactly — no action needed.
                  </div>
                )}
                {row.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        tone={
                          issue.severity === "high"
                            ? "red"
                            : issue.severity === "medium"
                              ? "amber"
                              : "slate"
                        }
                      >
                        {issue.type.replace(/_/g, " ")}
                      </Badge>
                      {issue.rupee_impact > 0 && (
                        <span className="text-sm font-semibold text-[color:var(--red)]">
                          {inr(issue.rupee_impact)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-foreground">{issue.message}</p>
                    <p className="mt-1.5 text-sm text-muted">
                      <span className="font-medium text-foreground">Recommended: </span>
                      {issue.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
