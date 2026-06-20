"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  {
    href: "/dashboard",
    label: "Firm Overview",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 6a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5" />
      </>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-[0_6px_18px_-8px_var(--ring)]">
          M
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Munshi</span>
          <span className="block text-[11px] text-muted">CA Platform</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-elevated hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
              )}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:scale-110"
              >
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between rounded-lg bg-elevated px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Sharma &amp; Associates</p>
            <p className="text-[11px] text-muted">Professional · 8 seats</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
