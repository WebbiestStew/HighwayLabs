"use client";

export type LedgerStatus = "ok" | "warn" | "fail" | "neutral";

const STATUS_STYLE: Record<LedgerStatus, string> = {
  ok: "text-emerald",
  warn: "text-amber",
  fail: "text-crimson",
  neutral: "text-text-primary",
};

export function LedgerRow({
  label,
  formula,
  value,
  unit,
  status = "neutral",
  approx,
}: {
  label: string;
  formula?: string;
  value: string;
  unit?: string;
  status?: LedgerStatus;
  /** When set, flags this value as an engineering approximation (curve-fit, not a digitized table) with the given tooltip explanation. */
  approx?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-hairline/60 py-1.5 last:border-0">
      <div className="min-w-0">
        <div className="truncate text-[11px] text-text-secondary">
          {approx ? (
            <span
              title={approx}
              className="cursor-help underline decoration-dotted decoration-amber/60 underline-offset-2"
            >
              {label}
            </span>
          ) : (
            label
          )}
        </div>
        {formula && <div className="truncate font-mono text-[10px] text-text-tertiary">{formula}</div>}
      </div>
      <div
        data-testid={`ledger-value-${slugify(label)}`}
        className={`shrink-0 tabular-nums text-[12px] font-medium ${STATUS_STYLE[status]}`}
      >
        {value}
        {unit && <span className="ml-1 text-[10px] text-text-tertiary">{unit}</span>}
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function StatusPill({ status, label }: { status: LedgerStatus; label: string }) {
  const styles: Record<LedgerStatus, string> = {
    ok: "bg-emerald/10 text-emerald border-emerald/30",
    warn: "bg-amber/10 text-amber border-amber/30",
    fail: "bg-crimson/10 text-crimson border-crimson/30 animate-flash-crimson",
    neutral: "bg-surface-4 text-text-secondary border-border-hairline",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ValidationBanner({ errors }: { errors: Record<string, string> }) {
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-sm border border-crimson/40 bg-crimson/10 px-2.5 py-2 text-[10px] text-crimson">
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
      <div>
        <div className="font-semibold uppercase tracking-wide">
          {count} input{count > 1 ? "s" : ""} outside policy bounds
        </div>
        <div className="mt-0.5 text-crimson/80">Values below are still computed live, but flagged fields should be corrected before this is treated as a compliant design.</div>
      </div>
    </div>
  );
}

const HERO_STATUS_STYLE: Record<LedgerStatus, { text: string; glow: string; border: string }> = {
  ok: { text: "text-emerald", glow: "shadow-[0_0_24px_-8px_var(--accent-compliance)]", border: "border-emerald/30" },
  warn: { text: "text-amber", glow: "shadow-[0_0_24px_-8px_var(--accent-warning)]", border: "border-amber/30" },
  fail: { text: "text-crimson", glow: "shadow-[0_0_24px_-8px_var(--accent-critical)]", border: "border-crimson/30" },
  neutral: { text: "text-cyan", glow: "shadow-[0_0_24px_-8px_var(--accent-geometry)]", border: "border-cyan/30" },
};

/**
 * The single most decision-critical number for a module, promoted above the
 * full ledger table so it reads at a glance instead of competing equally
 * with a dozen secondary values.
 */
export function HeroMetric({
  label,
  value,
  unit,
  status = "neutral",
  comparison,
}: {
  label: string;
  value: string;
  unit?: string;
  status?: LedgerStatus;
  /** Short sub-line, e.g. "vs R_min = 1,333.3 ft" */
  comparison?: string;
}) {
  const style = HERO_STATUS_STYLE[status];
  return (
    <div className={`animate-panel-in rounded-sm border bg-surface-1 px-4 py-3 transition-colors duration-300 ${style.border} ${style.glow}`}>
      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">{label}</div>
      <div key={value} className={`animate-value-pulse mt-1 flex items-baseline gap-1.5 rounded-sm tabular-nums ${style.text}`}>
        <span className="text-[28px] font-semibold leading-none">{value}</span>
        {unit && <span className="text-[13px] text-text-tertiary">{unit}</span>}
      </div>
      {comparison && <div className="mt-1 font-mono text-[10px] text-text-tertiary">{comparison}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`animate-panel-in flex flex-col rounded-sm border border-border-hairline bg-surface-1 ${className}`}>
      <div className="flex items-center justify-between border-b border-border-hairline px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{title}</h3>
        {actions}
      </div>
      <div tabIndex={0} className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
