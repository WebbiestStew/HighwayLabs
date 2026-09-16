"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Shared "control point" summaries each module publishes on every recompute.
// This is what lets the Project Overview page show one coherent corridor
// picture instead of six disconnected calculators — it does not attempt a
// full 3D corridor model (no shared cross-section templates or true
// station-by-station elevation handoff), but it does give every module a
// live, persisted view of what every other module currently has designed.

export interface HorizontalSummary {
  curveRadiusFt: number;
  tsStationFt: number;
  scStationFt: number;
  eDesignPercent: number;
  meetsRMin: boolean;
  designSpeedMph: number;
  /** lanesPerDirection * laneWidthFt — a reference figure for other modules (e.g. Earthwork cross-section estimation). */
  pavementWidthFt: number;
  updatedAt: number;
}
export interface VerticalSummary {
  curveClass: "crest" | "sag";
  pvcStationFt: number;
  pviStationFt: number;
  pvtStationFt: number;
  highLowStationFt: number | null;
  meetsKMin: boolean;
  structurePass: boolean | null;
  updatedAt: number;
}
export interface InterchangeSummary {
  stationFt: number;
  topologyLabel: string;
  mergeLOS: string;
  weaveLOS: string;
  rampSignalLOS: string;
  updatedAt: number;
}
export interface EarthworkSummary {
  startStationFt: number;
  endStationFt: number;
  netEndOrdinateCy: number;
  borrowRequiredCy: number;
  wasteRequiredCy: number;
  grandTotalCost: number;
  updatedAt: number;
}
export interface PavementSummary {
  snRequired: number;
  snProvided: number;
  pass: boolean;
  updatedAt: number;
}
export interface NetworkSummary {
  totalMiles: number;
  interchangeCount: number;
  estimatedCost: number;
  updatedAt: number;
}

interface CorridorState {
  horizontal: HorizontalSummary | null;
  vertical: VerticalSummary | null;
  interchange: InterchangeSummary | null;
  earthwork: EarthworkSummary | null;
  pavement: PavementSummary | null;
  network: NetworkSummary | null;
  publishHorizontal: (s: Omit<HorizontalSummary, "updatedAt">) => void;
  publishVertical: (s: Omit<VerticalSummary, "updatedAt">) => void;
  publishInterchange: (s: Omit<InterchangeSummary, "updatedAt">) => void;
  publishEarthwork: (s: Omit<EarthworkSummary, "updatedAt">) => void;
  publishPavement: (s: Omit<PavementSummary, "updatedAt">) => void;
  publishNetwork: (s: Omit<NetworkSummary, "updatedAt">) => void;
  clearAll: () => void;
}

export const useCorridorStore = create<CorridorState>()(
  persist(
    (set) => ({
      horizontal: null,
      vertical: null,
      interchange: null,
      earthwork: null,
      pavement: null,
      network: null,
      publishHorizontal: (s) => set({ horizontal: { ...s, updatedAt: Date.now() } }),
      publishVertical: (s) => set({ vertical: { ...s, updatedAt: Date.now() } }),
      publishInterchange: (s) => set({ interchange: { ...s, updatedAt: Date.now() } }),
      publishEarthwork: (s) => set({ earthwork: { ...s, updatedAt: Date.now() } }),
      publishPavement: (s) => set({ pavement: { ...s, updatedAt: Date.now() } }),
      publishNetwork: (s) => set({ network: { ...s, updatedAt: Date.now() } }),
      clearAll: () => set({ horizontal: null, vertical: null, interchange: null, earthwork: null, pavement: null, network: null }),
    }),
    {
      name: "highwaylab.corridor",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
