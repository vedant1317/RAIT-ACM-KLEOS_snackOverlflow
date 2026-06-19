"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api, API_BASE } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { inr, ago, STATUS_META } from "@/lib/format";
import { Card, StatCard, HealthRing, Spinner, Badge, SectionTitle } from "@/components/ui";

export default function ClientOverviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: c, loading, error } = useFetch(() => api.client(id), [id]);

  if (loading)
    return (
      <div className="py-20">
        <Spinner label="Loading client…" />
      </div>
    );
  if (error || !c)
    return <Card className="p-6 text-sm text-rose-600">Couldn’t load client. {error}</Card>;

  const s = c.summary;
  const meta = STATUS_META[c.status] ?? STATUS_META.review;
  const breakdown = [
    { label: "Matched", value: s.matched, tone: "bg-emerald-500" },
    { label: "Wrong details", value: s.mismatches, tone: "bg-amber-500" },
    { label: "Duplicates", value: s.duplicates, tone: "bg-rose-500" },
    { label: "Missing from 2B", value: s.missing_in_2b, tone: "bg-rose-400" },
    { label: "Missing in books", value: s.missing_in_books, tone: "bg-indigo-500" },
  ];
  const totalBars = breakdown.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/clients" className="hover:text-brand">Clients</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{c.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <HealthRing score={s.health_score} size={68} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {c.name}
              </h1>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <p className="text-sm text-muted">
              {c.industry} · GSTIN {c.gstin} · {c.contact_name}
            </p>
            <p className="text-xs text-muted">
              Last reconciled {ago(c.last_reconciled_at)}
            </p>
          </div>
        </div>
        <Link href={`/clients/${id}/invoices`} className="btn btn-primary">
          Open invoice manager
          <span aria-hidden>→</span>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invoices" value={s.total_invoices} sub={`${s.total_2b_rows} rows in GSTR-2B`} icon="🧾" />
        <StatCard label="Open issues" value={s.total_issues} tone="amber" icon="⚠" />
        <StatCard label="ITC at risk" value={inr(s.itc_at_risk)} tone="red" icon="₹" sub={`${inr(s.itc_blocked)} blocked`} />
        <StatCard label="HSN issues" value={s.hsn_issues} tone="indigo" icon="#" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Reconciliation breakdown" subtitle="How this client's invoices map against GSTR-2B." />
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {breakdown.map((b) =>
              b.value > 0 ? (
                <div
                  key={b.label}
                  className={b.tone}
                  style={{ width: `${(b.value / totalBars) * 100}%` }}
                  title={`${b.label}: ${b.value}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {breakdown.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${b.tone}`} />
                <span className="text-muted">{b.label}</span>
                <span className="ml-auto font-medium text-foreground tabular-nums">{b.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="ERP integration" subtitle="Push invoices straight from the client's software." />
          <p className="text-xs font-medium text-muted">ERP system</p>
          <p className="mb-3 text-sm text-foreground">{c.erp_system || "Not connected"}</p>
          <p className="text-xs font-medium text-muted">API key</p>
          <code className="mb-3 block truncate rounded-md bg-slate-900 px-2 py-1.5 text-xs text-emerald-300">
            {c.erp_api_key}
          </code>
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground">POST</span>{" "}
            {API_BASE}/ca/integrations/erp/invoices with header{" "}
            <code className="text-foreground">X-API-Key</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
