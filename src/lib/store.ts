"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UnitSystem } from "@/lib/units";

export type DesignVehicle = "P" | "SU-30" | "WB-40" | "WB-62" | "WB-67";

export const DESIGN_VEHICLE_LABELS: Record<DesignVehicle, string> = {
  P: "P — Passenger Car",
  "SU-30": "SU-30 — Single Unit Truck",
  "WB-40": "WB-40 — Interstate Semi",
  "WB-62": "WB-62 — Interstate Semi (62' Wheelbase)",
  "WB-67": "WB-67 — Interstate Semi-Trailer (67' Wheelbase)",
};

// A citation-level policy selector only: it changes which governing document
// is referenced in the calculation transparency drawer and exported PE
// memorandum. It intentionally does NOT swap in a separate, unverified set
// of TxDOT-specific numeric coefficient tables — only the published AASHTO
// Green Book / HCM curves already implemented are used for computation.
export type DesignStandard = "aashto-green-book" | "txdot-rdm";

export const DESIGN_STANDARD_LABELS: Record<DesignStandard, string> = {
  "aashto-green-book": "AASHTO Green Book (7th/8th Ed.)",
  "txdot-rdm": "TxDOT Roadway Design Manual",
};

export function designStandardCitation(standard: DesignStandard): string {
  return standard === "txdot-rdm"
    ? "per the TxDOT Roadway Design Manual, which incorporates AASHTO Green Book / HCM design values"
    : "per the AASHTO Green Book / HCM design values";
}

interface ProjectState {
  corridorName: string;
  unitSystem: UnitSystem;
  designSpeedMph: number; // canonical, US mph
  designVehicle: DesignVehicle;
  designStandard: DesignStandard;
  stationStart: number; // canonical feet
  stationEnd: number; // canonical feet
  setCorridorName: (v: string) => void;
  setUnitSystem: (v: UnitSystem) => void;
  setDesignSpeedMph: (v: number) => void;
  setDesignVehicle: (v: DesignVehicle) => void;
  setDesignStandard: (v: DesignStandard) => void;
  setStationRange: (start: number, end: number) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      corridorName: "SH-99 / SEC A — STA 10+00 TO 150+00",
      unitSystem: "us",
      designSpeedMph: 60,
      designVehicle: "WB-62",
      designStandard: "aashto-green-book",
      stationStart: 1000,
      stationEnd: 15000,
      setCorridorName: (v) => set({ corridorName: v }),
      setUnitSystem: (v) => set({ unitSystem: v }),
      setDesignSpeedMph: (v) => set({ designSpeedMph: v }),
      setDesignVehicle: (v) => set({ designVehicle: v }),
      setDesignStandard: (v) => set({ designStandard: v }),
      setStationRange: (start, end) => set({ stationStart: start, stationEnd: end }),
    }),
    {
      name: "highwaylab.project",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        corridorName: state.corridorName,
        unitSystem: state.unitSystem,
        designSpeedMph: state.designSpeedMph,
        designVehicle: state.designVehicle,
        designStandard: state.designStandard,
        stationStart: state.stationStart,
        stationEnd: state.stationEnd,
      }),
    }
  )
);
