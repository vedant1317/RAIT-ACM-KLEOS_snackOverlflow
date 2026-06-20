import type {
  Client,
  Invoice,
  Portfolio,
  Reconciliation,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  portfolio: () => get<Portfolio>("/ca/portfolio"),
  clients: () => get<Client[]>("/ca/clients"),
  client: (id: string) => get<Client>(`/ca/clients/${id}`),
  invoices: (id: string) => get<Invoice[]>(`/ca/clients/${id}/invoices`),
  reconciliation: (id: string) =>
    get<Reconciliation>(`/ca/clients/${id}/reconciliation`),
  reconcile: (id: string, language = "English") =>
    post<Reconciliation & { run_at: string; explanations: unknown[] }>(
      `/ca/clients/${id}/reconcile?language=${encodeURIComponent(language)}`,
    ),
  addInvoices: (id: string, invoices: Invoice[]) =>
    post(`/ca/clients/${id}/invoices`, { invoices }),
  createClient: (payload: Partial<Client>) => post<Client>("/ca/clients", payload),
  uploadBaseline: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `${API_BASE}/ca/clients/${id}/baseline/upload`,
      { method: "POST", body: form },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  uploadInvoices: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `${API_BASE}/ca/clients/${id}/invoices/upload`,
      { method: "POST", body: form },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
