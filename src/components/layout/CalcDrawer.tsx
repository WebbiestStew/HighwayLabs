"use client";

import { X } from "lucide-react";

export interface CalcStep {
  label: string;
  reference?: string; // AASHTO/HCM table/exhibit reference
  formula: string;
  substitution: string;
  result: string;
}

export default function CalcDrawer({
  open,
  onClose,
  title,
  steps,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: CalcStep[];
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border-hairline bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-hairline px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary">Calculation Transparency</div>
            <div className="text-[13px] font-semibold text-cyan">{title}</div>
          </div>
          <button onClick={onClose} className="rounded-sm p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <p className="mb-4 border border-amber/30 bg-amber/5 p-2 text-[10px] leading-relaxed text-amber">
            Design values shown approximate published AASHTO Green Book / HCM / TxDOT RDM empirical
            curves for engineering education and preliminary design use. Verify against the current
            edition exhibits prior to PS&amp;E submittal or PE certification.
          </p>
          <ol className="flex flex-col gap-4">
            {steps.map((s, i) => (
              <li key={i} className="border-l-2 border-cyan/40 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-text-primary">
                    {i + 1}. {s.label}
                  </span>
                  {s.reference && (
                    <span className="shrink-0 text-[9px] text-text-tertiary">{s.reference}</span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-cyan/90">{s.formula}</div>
                <div className="mt-0.5 font-mono text-[10px] text-text-secondary">{s.substitution}</div>
                <div className="mt-1 font-mono text-[12px] font-semibold text-emerald">= {s.result}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
