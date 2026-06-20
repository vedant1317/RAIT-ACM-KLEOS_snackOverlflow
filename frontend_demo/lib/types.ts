// Shapes returned by the FastAPI CA-platform endpoints (/ca/*).

export interface ClientSummary {
  total_invoices: number;
  total_2b_rows: number;
  matched: number;
  mismatches: number;
  duplicates: number;
  missing_in_2b: number;
  missing_in_books: number;
  hsn_issues: number;
  total_issues: number;
  itc_at_risk: number;
  itc_blocked: number;
  health_score: number;
}

export type ClientStatus =
  | "clean"
  | "review"
  | "action_required"
  | "awaiting_data"
  | "awaiting_2b";

export interface Client {
  id: string;
  name: string;
  gstin: string;
  industry: string;
  contact_name: string;
  contact_phone: string;
  erp_system: string;
  filing_frequency: string;
  created_at: string;
  erp_api_key: string;
  summary: ClientSummary;
  status: ClientStatus;
  last_reconciled_at: string | null;
}

export interface Invoice {
  id?: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_number: string;
  invoice_date: string;
  taxable_value: number;
  gst_rate: number;
  gst_amount: number;
  hsn_code: string;
  source?: string;
}

export interface FieldDiff {
  field: string;
  book: string | number;
  gstr2b: string | number;
}

export interface RowIssue {
  type: string;
  rupee_impact: number;
  message: string;
  recommendation: string;
  severity: "high" | "medium" | "low";
  official_rate?: number | null;
  official_description?: string | null;
}

export type RowStatus =
  | "matched"
  | "mismatch"
  | "duplicate"
  | "missing_in_2b"
  | "missing_in_books";

export interface MappingRow {
  invoice_number: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_date: string | null;
  status: RowStatus;
  book: Invoice | null;
  gstr2b: Invoice | null;
  field_diffs: FieldDiff[];
  issues: RowIssue[];
  rupee_impact: number;
}

export interface Reconciliation {
  client_id: string;
  rows: MappingRow[];
  summary: ClientSummary;
}

export interface Activity {
  id: string;
  client_id: string | null;
  kind: string;
  message: string;
  at: string;
}

export interface Portfolio {
  firm: { id: string; name: string; plan: string; seats: number };
  totals: {
    clients: number;
    total_invoices: number;
    total_issues: number;
    itc_at_risk: number;
    itc_blocked: number;
    action_required: number;
    clean: number;
    avg_health_score: number;
  };
  clients: Client[];
  priority_clients: Client[];
  activity: Activity[];
}
