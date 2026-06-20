"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { Card, Spinner, SectionTitle } from "@/components/ui";
import ClientTable from "@/components/ClientTable";

export default function ClientsPage() {
  const { data, loading, error, reload } = useFetch(() => api.clients(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    gstin: "",
    industry: "",
    contact_name: "",
    erp_system: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createClient(form);
      setForm({ name: "", gstin: "", industry: "", contact_name: "", erp_system: "" });
      setOpen(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Clients
          </h1>
          <p className="text-sm text-muted">
            Every business this firm files for, with live compliance status.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn btn-primary">
          {open ? "Cancel" : "+ Onboard client"}
        </button>
      </header>

      {open && (
        <Card className="p-5">
          <SectionTitle title="Onboard a new client" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["name", "Business name *"],
              ["gstin", "GSTIN"],
              ["industry", "Industry"],
              ["contact_name", "Contact person"],
              ["erp_system", "ERP system (Tally, Zoho…)"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block font-medium text-muted">{label}</span>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={submit}
              disabled={saving || !form.name.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create client"}
            </button>
          </div>
        </Card>
      )}

      {loading && <Spinner label="Loading clients…" />}
      {error && (
        <Card className="p-6 text-sm text-rose-600">Couldn’t load clients. {error}</Card>
      )}
      {data && <ClientTable clients={data} />}
    </div>
  );
}
