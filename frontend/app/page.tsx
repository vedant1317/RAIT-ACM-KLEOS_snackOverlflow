import Link from "next/link";
import LandingNav from "@/components/LandingNav";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";

const SERVICES = [
  {
    icon: "scan",
    title: "AI invoice extraction",
    body: "Gemini Vision reads photos, scans and PDFs into eight structured GST fields — rotated, blurry or handwritten.",
  },
  {
    icon: "map",
    title: "Invoice manager",
    body: "Every invoice mapped to GSTR-2B and to each other in one reconciliation table you can filter and drill into.",
  },
  {
    icon: "copy",
    title: "Duplicate & missing detection",
    body: "Catches duplicate entries, invoices missing from 2B, and the reverse — filings missing from the books.",
  },
  {
    icon: "diff",
    title: "Wrong-detail comparison",
    body: "Field-by-field diffs on taxable value, tax, HSN and dates — see exactly what was entered wrong, and where.",
  },
  {
    icon: "rupee",
    title: "ITC recovery engine",
    body: "Deterministic rupee impact on every issue. No AI ever computes a figure — every number is auditable.",
  },
  {
    icon: "chat",
    title: "Plain-language advisory",
    body: "Each issue narrated in simple English or Hindi with a recommended fix, ready to send to the client.",
  },
  {
    icon: "grid",
    title: "Firm-wide portfolio",
    body: "Track every client from one console, ranked by financial exposure, with a live GST health score each.",
  },
  {
    icon: "plug",
    title: "ERP integration",
    body: "A tool on top of the client's software. Their ERP pushes invoices in via a per-client API key.",
  },
];

const STEPS = [
  { n: "01", title: "Ingest", body: "Invoices flow in from the client's ERP, a CSV import, or a photo through WhatsApp." },
  { n: "02", title: "Map", body: "The engine matches invoices to GSTR-2B and to one another on GSTIN + invoice number." },
  { n: "03", title: "Diagnose", body: "Duplicates, missing entries and wrong details are flagged with their exact ITC impact." },
  { n: "04", title: "Act", body: "Plain-language advice per issue, tracked to resolution across the whole client book." },
];

const MODES = [
  { tag: "WhatsApp", who: "Traders & kirana owners", line: "Upload → Detect → Fix → Track", tone: "var(--green)" },
  { tag: "MSME dashboard", who: "Business owners", line: "Monitor → Analyse → Predict → Optimise", tone: "var(--brand)" },
  { tag: "CA platform", who: "Firms & consultants", line: "Review → Prioritise → Delegate → Scale", tone: "var(--accent)" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <LandingNav />

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative isolate overflow-hidden px-6 pt-36 pb-24">
        {/* animated glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="grid-bg absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div
            className="animate-float absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full blur-[110px]"
            style={{ background: "var(--hero-glow-2)" }}
          />
          <div
            className="animate-float absolute -right-24 top-20 h-[24rem] w-[24rem] rounded-full blur-[110px] [animation-delay:1.5s]"
            style={{ background: "var(--hero-glow-1)" }}
          />
          <div
            className="animate-float absolute -left-24 top-40 h-[22rem] w-[22rem] rounded-full blur-[110px] [animation-delay:3s]"
            style={{ background: "var(--hero-glow-3)" }}
          />
        </div>

        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="badge badge-indigo mx-auto mb-6">
              One compliance brain · WhatsApp · MSME · CA firms
            </span>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The CA in your pocket,
              <br />
              <span className="text-gradient animate-gradient">now a console for the firm.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted">
              Munshi reconciles every client&rsquo;s invoices against GSTR-2B, finds the
              duplicates, the missing bills and the wrong entries, and tells you exactly
              how much Input Tax Credit is on the line — citing the bill every time.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard" className="btn btn-primary px-5 py-3 text-[15px]">
                Open the console
                <span aria-hidden>→</span>
              </Link>
              <a href="#services" className="btn btn-ghost px-5 py-3 text-[15px]">
                Explore the platform
              </a>
            </div>
          </Reveal>

          {/* hero product mock */}
          <Reveal delay={150} className="mx-auto mt-16 max-w-4xl">
            <HeroMock />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- STATS */}
      <section className="border-y border-border bg-surface/40 px-6 py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { v: <CountUp to={2400} prefix="₹" suffix="+" />, l: "ITC recoverable, per client/mo" },
            { v: <CountUp to={2000} suffix="" />, l: "Invoices handled monthly" },
            { v: <><CountUp to={100} suffix="%" /></>, l: "Deterministic money math" },
            { v: <CountUp to={4} />, l: "Mismatch types caught" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="text-3xl font-semibold tracking-tight sm:text-4xl">{s.v}</div>
              <div className="mt-1.5 text-sm text-muted">{s.l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- SERVICES */}
      <section id="services" className="scroll-mt-20 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              Everything in one brain
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              The services that power the platform
            </h2>
            <p className="mt-4 text-lg text-muted">
              The same engine that runs the WhatsApp bot runs the firm console — extraction,
              reconciliation and ITC math, exposed as a workflow for CAs.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={(i % 4) * 70}>
                <div className="group h-full bg-surface p-6 transition-colors hover:bg-elevated">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand transition-transform duration-300 group-hover:-translate-y-0.5">
                    <Icon name={s.icon} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              The pipeline
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              From a messy bill to a recovered rupee
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="relative h-full">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute right-[-1.1rem] top-6 hidden h-px w-8 bg-border-strong md:block"
                    />
                  )}
                  <div className="text-sm font-mono font-semibold text-brand">{s.n}</div>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- MODES */}
      <section id="modes" className="scroll-mt-20 border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              One brain, three surfaces
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              A trader on WhatsApp. An MSME on a dashboard. A firm at scale.
            </h2>
            <p className="mt-4 text-lg text-muted">
              Every mode feeds the same reconciliation pipeline and consumes its output differently.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            {MODES.map((m, i) => (
              <Reveal key={m.tag} delay={i * 90}>
                <div className="card card-hover h-full p-6">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: m.tone }}
                  />
                  <h3 className="mt-4 text-lg font-semibold">{m.tag}</h3>
                  <p className="text-sm text-muted">{m.who}</p>
                  <p className="mt-5 font-mono text-sm" style={{ color: m.tone }}>
                    {m.line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA */}
      <section className="px-6 pb-24 pt-8">
        <Reveal className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl border border-border px-8 py-16 text-center sm:px-16">
            <div
              aria-hidden
              className="animate-gradient absolute inset-0 -z-10 opacity-[0.16]"
              style={{
                background:
                  "linear-gradient(120deg, var(--brand), var(--accent), var(--cyan))",
                backgroundSize: "200% 200%",
              }}
            />
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Run a whole firm from one console.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Most GST tools help you file returns. Munshi helps you recover money,
              prevent losses and automate compliance — across every client.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn btn-primary px-6 py-3 text-[15px]">
                Open the firm overview
                <span aria-hidden>→</span>
              </Link>
              <Link href="/clients" className="btn btn-ghost px-6 py-3 text-[15px]">
                Browse clients
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------- FOOTER */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-xs font-bold text-white">
              M
            </span>
            <span className="font-medium text-foreground">Munshi</span>
            <span className="text-faint">· GST intelligence for CA firms</span>
          </div>
          <p className="text-faint">
            AI reads documents. Code computes the rupees. Every figure is auditable.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero product mock — a static slice of the real invoice manager      */
/* ------------------------------------------------------------------ */
function HeroMock() {
  const rows = [
    { inv: "LT-201", v: "Surat Mills", status: "Wrong details", tone: "amber", impact: "₹3,500" },
    { inv: "LT-203", v: "Dye Works", status: "Missing from 2B", tone: "red", impact: "₹3,600" },
    { inv: "LT-202", v: "Cotton House", status: "Wrong details", tone: "amber", impact: "₹150" },
    { inv: "LT-299", v: "Velvet Traders", status: "Missing in books", tone: "indigo", impact: "₹750" },
    { inv: "TN-401", v: "Dell India", status: "Matched", tone: "green", impact: "—" },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--red)" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--amber)" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--green)" }} />
          <span className="ml-3 text-sm font-medium">Invoice Manager · Lakshmi Textiles</span>
        </div>
        <span className="badge badge-red">ITC at risk ₹14,000</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.inv} className="flex items-center gap-4 px-5 py-3 text-sm">
            <div className="w-20 font-medium">{r.inv}</div>
            <div className="flex-1 text-muted">{r.v}</div>
            <span className={`badge badge-${r.tone}`}>{r.status}</span>
            <div className="w-16 text-right font-semibold" style={{ color: r.impact === "—" ? "var(--faint)" : "var(--red)" }}>
              {r.impact}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline icon set (stroke style)                                      */
/* ------------------------------------------------------------------ */
function Icon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<string, React.ReactNode> = {
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
    map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    diff: <><path d="M12 3v18" /><path d="M5 8h6M5 16h6M14 6h5M14 18h5M16.5 4.5v3M16.5 16.5v3" /></>,
    rupee: <><path d="M6 4h12M6 8h12M16 4c0 5-4 6-8 6h2l6 8" /></>,
    chat: <><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    plug: <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
