import type { ReactNode } from "react";

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>
  );
}

const ICON_TONE: Record<string, string> = {
  slate: "badge-slate",
  green: "badge-green",
  amber: "badge-amber",
  red: "badge-red",
  indigo: "badge-indigo",
};

export function StatCard({
  label,
  value,
  sub,
  tone = "slate",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
              ICON_TONE[tone] ?? ICON_TONE.slate
            }`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function HealthRing({
  score,
  size = 64,
  animate = true,
}: {
  score: number;
  size?: number;
  animate?: boolean;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--elevated)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          style={animate ? { transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" } : undefined}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold"
        style={{ fontSize: size * 0.28 }}
      >
        {pct}
      </span>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span
        className="h-4 w-4 rounded-full border-2 border-border-strong"
        style={{ borderTopColor: "var(--brand)", animation: "spin 0.7s linear infinite" }}
      />
      {label}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
