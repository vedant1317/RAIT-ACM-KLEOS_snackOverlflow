"use client";

import Link from "next/link";
import type { Client } from "@/lib/types";
import { inr, STATUS_META } from "@/lib/format";
import { Badge } from "@/components/ui";

function healthDot(score: number) {
  const color = score >= 80 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  );
}

export default function ClientTable({ clients }: { clients: Client[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Invoices</th>
            <th className="px-4 py-3 text-right font-medium">Open issues</th>
            <th className="px-4 py-3 text-right font-medium">ITC at risk</th>
            <th className="px-4 py-3 text-right font-medium">Health</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.review;
            return (
              <tr
                key={c.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-elevated"
              >
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="group block">
                    <span className="font-medium transition-colors group-hover:text-brand">
                      {c.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {c.industry} · {c.gstin}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.summary.total_invoices}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.summary.total_issues > 0 ? (
                    <span className="font-medium" style={{ color: "var(--red)" }}>
                      {c.summary.total_issues}
                    </span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {inr(c.summary.itc_at_risk)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2 tabular-nums">
                    {healthDot(c.summary.health_score)}
                    {c.summary.health_score}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
