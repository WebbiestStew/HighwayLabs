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
}: {
  label: string;
  formula?: string;
  value: string;
  unit?: string;
  status?: LedgerStatus;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-hairline/60 py-1.5 last:border-0">
      <div className="min-w-0">
        <div className="truncate text-[11px] text-text-secondary">{label}</div>
        {formula && <div className="truncate font-mono text-[10px] text-text-tertiary">{formula}</div>}
      </div>
      <div className={`shrink-0 tabular-nums text-[12px] font-medium ${STATUS_STYLE[status]}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-text-tertiary">{unit}</span>}
      </div>
    </div>
  );
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
    <div className={`flex flex-col rounded-sm border border-border-hairline bg-surface-1 ${className}`}>
      <div className="flex items-center justify-between border-b border-border-hairline px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{title}</h3>
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
