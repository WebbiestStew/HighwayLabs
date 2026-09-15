"use client";

import { create } from "zustand";
import type { UnitSystem } from "@/lib/units";

export type DesignVehicle = "P" | "SU-30" | "WB-40" | "WB-62" | "WB-67";

export const DESIGN_VEHICLE_LABELS: Record<DesignVehicle, string> = {
  P: "P — Passenger Car",
  "SU-30": "SU-30 — Single Unit Truck",
  "WB-40": "WB-40 — Interstate Semi",
  "WB-62": "WB-62 — Interstate Semi (62' Wheelbase)",
  "WB-67": "WB-67 — Interstate Semi-Trailer (67' Wheelbase)",
};

interface ProjectState {
  corridorName: string;
  unitSystem: UnitSystem;
  designSpeedMph: number; // canonical, US mph
  designVehicle: DesignVehicle;
  stationStart: number; // canonical feet
  stationEnd: number; // canonical feet
  setCorridorName: (v: string) => void;
  setUnitSystem: (v: UnitSystem) => void;
  setDesignSpeedMph: (v: number) => void;
  setDesignVehicle: (v: DesignVehicle) => void;
  setStationRange: (start: number, end: number) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  corridorName: "SH-99 / SEC A — STA 10+00 TO 150+00",
  unitSystem: "us",
  designSpeedMph: 60,
  designVehicle: "WB-62",
  stationStart: 1000,
  stationEnd: 15000,
  setCorridorName: (v) => set({ corridorName: v }),
  setUnitSystem: (v) => set({ unitSystem: v }),
  setDesignSpeedMph: (v) => set({ designSpeedMph: v }),
  setDesignVehicle: (v) => set({ designVehicle: v }),
  setStationRange: (start, end) => set({ stationStart: start, stationEnd: end }),
}));
