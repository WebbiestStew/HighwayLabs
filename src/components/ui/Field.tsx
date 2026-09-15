"use client";

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  accent = "text-text-primary",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  accent?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <div className="flex items-center gap-1 rounded-sm border border-border-hairline bg-surface-4 px-2 py-1.5 focus-within:border-cyan/50">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full min-w-0 bg-transparent text-[12px] tabular-nums outline-none ${accent}`}
        />
        {unit && <span className="shrink-0 text-[10px] text-text-tertiary">{unit}</span>}
      </div>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-sm border border-border-hairline bg-surface-4 px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-cyan/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-2">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <div className="flex overflow-hidden rounded-sm border border-border-hairline">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${
              value === o.value
                ? "bg-cyan/15 text-cyan"
                : "bg-surface-4 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary first:mt-0">
      <span className="h-px flex-1 bg-border-hairline" />
      {children}
      <span className="h-px flex-1 bg-border-hairline" />
    </div>
  );
}
