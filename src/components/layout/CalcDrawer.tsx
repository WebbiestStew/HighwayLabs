"use client";

import { X } from "lucide-react";
import { useProjectStore, DESIGN_STANDARD_LABELS, designStandardCitation } from "@/lib/store";

export interface CalcStep {
  label: string;
  reference?: string; // AASHTO/HCM table/exhibit reference
  formula: string;
  /** LaTeX source for the formula, rendered as real typeset math in the exported PE memorandum (falls back to the plain-text `formula` string if omitted or if rendering fails). Not used in the on-screen drawer, which always shows the plain-text form. */
  formulaLatex?: string;
  substitution: string;
  result: string;
  /**
   * "approximated" flags a step whose formula/coefficients are a curve-fit
   * representative model (e.g. AASHTO Method 5's shape, HCM merge/weave
   * speed models) rather than a closed-form equation or a digitized table
   * value taken directly from the governing document. Leave unset for
   * standard closed-form physics/algebra (SSD, parabola equations, Webster's
   * cycle formula, D/D/1 queue theory, the AASHTO 1993 SN equation, etc.) —
   * those are the published formulas themselves, not approximations of them.
   */
  confidence?: "approximated";
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
  const designStandard = useProjectStore((s) => s.designStandard);

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
          <button onClick={onClose} aria-label="Close" className="rounded-sm p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div tabIndex={0} className="flex-1 overflow-auto p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            Governing Standard: {DESIGN_STANDARD_LABELS[designStandard]}
          </div>
          <p className="mb-4 border border-amber/30 bg-amber/5 p-2 text-[10px] leading-relaxed text-amber">
            Design values shown approximate published AASHTO Green Book / HCM / TxDOT RDM empirical
            curves {designStandardCitation(designStandard)}, for engineering education and preliminary
            design use. Verify against the current edition exhibits prior to PS&amp;E submittal or PE
            certification.
          </p>
          <ol className="flex flex-col gap-4">
            {steps.map((s, i) => (
              <li key={i} className="border-l-2 border-cyan/40 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-primary">
                    {i + 1}. {s.label}
                    {s.confidence === "approximated" && (
                      <span
                        title="Curve-fit representative model, not a digitized table value from the governing document — verify independently."
                        className="cursor-help rounded-sm border border-amber/40 bg-amber/10 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber"
                      >
                        ≈ approx.
                      </span>
                    )}
                  </span>
                  {s.reference && (
                    <span className="shrink-0 text-[10px] text-text-tertiary">{s.reference}</span>
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
