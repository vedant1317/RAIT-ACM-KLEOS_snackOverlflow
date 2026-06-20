export function inr(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function num(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export const STATUS_META: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" | "slate" | "indigo" }
> = {
  clean: { label: "Clean", tone: "green" },
  review: { label: "Needs review", tone: "amber" },
  action_required: { label: "Action required", tone: "red" },
  awaiting_data: { label: "Awaiting data", tone: "slate" },
  awaiting_2b: { label: "Awaiting GSTR-2B", tone: "slate" },
  matched: { label: "Matched", tone: "green" },
  mismatch: { label: "Wrong details", tone: "amber" },
  duplicate: { label: "Duplicate", tone: "red" },
  missing_in_2b: { label: "Missing from 2B", tone: "red" },
  missing_in_books: { label: "Missing in books", tone: "indigo" },
};
