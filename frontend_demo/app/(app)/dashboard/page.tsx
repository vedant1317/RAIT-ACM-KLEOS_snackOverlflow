"use client";

import { api } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { inr, ago } from "@/lib/format";
import { Card, StatCard, HealthRing, Skeleton, SectionTitle } from "@/components/ui";
import ClientTable from "@/components/ClientTable";

export default function DashboardPage() {
  const { data, loading, error } = useFetch(() => api.portfolio(), []);

  if (loading)
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  if (error || !data)
    return (
      <Card className="p-6 text-sm" >
        <p style={{ color: "var(--red)" }} className="font-medium">
          Couldn’t reach the API at{" "}
          <code>{`${process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"}`}</code>.
        </p>
        <p className="mt-1 text-muted">
          Start the backend with{" "}
          <code className="rounded bg-elevated px-1 py-0.5">uvicorn backend.main:app --port 8000</code>.
        </p>
        <p className="mt-2 text-xs text-faint">{error}</p>
      </Card>
    );

  const t = data.totals;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{data.firm.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Firm Overview
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <HealthRing score={t.avg_health_score} size={56} />
          <div className="text-right">
            <p className="text-xs text-muted">Avg. portfolio health</p>
            <p className="text-sm font-medium text-foreground">
              across {t.clients} clients
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 animate-pop lg:grid-cols-4">
        <StatCard label="Clients" value={t.clients} icon="👥"
          sub={`${t.clean} clean · ${t.action_required} need action`} />
        <StatCard label="Invoices managed" value={t.total_invoices} icon="🧾" tone="indigo" />
        <StatCard label="Open issues" value={t.total_issues} tone="amber" icon="⚠"
          sub="duplicates, missing & wrong entries" />
        <StatCard label="ITC at risk (firm-wide)" value={inr(t.itc_at_risk)} tone="red" icon="₹"
          sub={`${inr(t.itc_blocked)} fully blocked`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <SectionTitle
            title="Priority clients"
            subtitle="Ranked by financial exposure — work the top of the list first."
          />
          <ClientTable clients={data.priority_clients} />
        </div>

        <div className="space-y-3">
          <SectionTitle title="Recent activity" />
          <Card className="divide-y divide-border">
            {data.activity.length === 0 && (
              <p className="p-4 text-sm text-muted">No activity yet.</p>
            )}
            {data.activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3.5">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{a.message}</p>
                  <p className="text-xs text-muted">{ago(a.at)}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
