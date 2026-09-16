"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { useProjectStore, DESIGN_VEHICLE_LABELS, type DesignVehicle, type DesignStandard } from "@/lib/store";

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { designVehicle, setDesignVehicle, designStandard, setDesignStandard } = useProjectStore();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Project Settings"
        className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
        title="Design vehicle & governing standard"
      >
        <Settings size={12} />
        {designVehicle}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="absolute left-3 top-11 flex w-72 flex-col gap-3 rounded-sm border border-border-hairline bg-surface-1 p-3 text-[11px] shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Project Settings</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
                <X size={14} />
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Design Vehicle (AASHTO)</span>
              <select
                value={designVehicle}
                onChange={(e) => setDesignVehicle(e.target.value as DesignVehicle)}
                className="rounded-sm border border-border-hairline bg-surface-4 px-2 py-1.5 text-text-primary outline-none focus:border-cyan/50"
              >
                {Object.entries(DESIGN_VEHICLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-surface-2">
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-text-tertiary" title="Affects citations in the calc drawer / PDF only — not computed values">
                Governing Standard
              </span>
              <div className="flex overflow-hidden rounded-sm border border-border-hairline">
                <button
                  onClick={() => setDesignStandard("aashto-green-book" as DesignStandard)}
                  className={`flex-1 px-2 py-1.5 ${designStandard === "aashto-green-book" ? "bg-emerald/15 text-emerald" : "bg-surface-4 text-text-tertiary hover:text-text-secondary"}`}
                >
                  AASHTO Green Book
                </button>
                <button
                  onClick={() => setDesignStandard("txdot-rdm" as DesignStandard)}
                  className={`flex-1 px-2 py-1.5 ${designStandard === "txdot-rdm" ? "bg-emerald/15 text-emerald" : "bg-surface-4 text-text-tertiary hover:text-text-secondary"}`}
                >
                  TxDOT RDM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
