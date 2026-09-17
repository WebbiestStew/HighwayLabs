"use client";

// One-click TxDOT/AASHTO starting points: each preset is a full, R >= R_min
// compliant Module 1 (Horizontal Alignment) configuration — not just a
// design speed — so the user lands on a working, conforming curve instead
// of an empty form. Compliance (R >= R_min per AASHTO Green Book Eq. 3-8)
// is checked in presets.test.ts against the same computeHorizontal() engine
// the app itself uses, so a preset can't silently drift out of compliance.

import { createNewProject } from "./projects";
import type { DesignVehicle } from "./store";
import type { HorizontalInputs } from "./engineering/horizontal";

export interface CorridorPreset {
  id: string;
  label: string;
  description: string;
  corridorName: string;
  designSpeedMph: number;
  designVehicle: DesignVehicle;
  designStandard: string;
  stationStart: number;
  stationEnd: number;
  horizontal: HorizontalInputs;
  geometryExtras: {
    deflectionAngleDeg: number;
    turnDirection: "left" | "right";
    leadTangentFt: number;
    startElevationFt: number;
    gradePercent: number;
    actualClearanceFt: number;
  };
}

export const CORRIDOR_PRESETS: CorridorPreset[] = [
  {
    id: "txdot-rural-interstate",
    label: "TxDOT Rural Interstate",
    description: "75 mph · e_max 8% · WB-67 · R = 3,000 ft (R_min ≈ 2,206 ft)",
    corridorName: "TxDOT Rural Interstate — SH-130 Extension",
    designSpeedMph: 75,
    designVehicle: "WB-67",
    designStandard: "txdot-rdm",
    stationStart: 10000,
    stationEnd: 30000,
    horizontal: {
      designSpeedMph: 75,
      designVehicle: "WB-67",
      lanesPerDirection: 2,
      laneWidthFt: 12,
      shoulderInsideFt: 10,
      shoulderOutsideFt: 12,
      eNCPercent: -2,
      eMaxPercent: 8,
      axisOfRotation: "centerline",
      lateralAccelC: 1.2,
      transitionType: "spiral",
      curveRadiusFt: 3000,
    },
    geometryExtras: { deflectionAngleDeg: 30, turnDirection: "right", leadTangentFt: 600, startElevationFt: 650, gradePercent: 0.5, actualClearanceFt: 40 },
  },
  {
    id: "urban-arterial-divided",
    label: "Urban Arterial Divided",
    description: "45 mph · e_max 4% · R = 900 ft (R_min = 675 ft)",
    corridorName: "Urban Arterial Divided — Westheimer Extension",
    designSpeedMph: 45,
    designVehicle: "SU-30",
    designStandard: "aashto-green-book",
    stationStart: 5000,
    stationEnd: 15000,
    horizontal: {
      designSpeedMph: 45,
      designVehicle: "SU-30",
      lanesPerDirection: 2,
      laneWidthFt: 11,
      shoulderInsideFt: 4,
      shoulderOutsideFt: 6,
      eNCPercent: -2,
      eMaxPercent: 4,
      axisOfRotation: "centerline",
      lateralAccelC: 1.8,
      transitionType: "spiral",
      curveRadiusFt: 900,
    },
    geometryExtras: { deflectionAngleDeg: 55, turnDirection: "left", leadTangentFt: 250, startElevationFt: 180, gradePercent: -0.3, actualClearanceFt: 12 },
  },
  {
    id: "mountain-pass-highway",
    label: "Mountain Pass Highway",
    description: "50 mph · e_max 6% · WB-40 · R = 1,100 ft (R_min ≈ 833 ft)",
    corridorName: "Mountain Pass Highway — US-64 Realignment",
    designSpeedMph: 50,
    designVehicle: "WB-40",
    designStandard: "aashto-green-book",
    stationStart: 8000,
    stationEnd: 22000,
    horizontal: {
      designSpeedMph: 50,
      designVehicle: "WB-40",
      lanesPerDirection: 1,
      laneWidthFt: 12,
      shoulderInsideFt: 4,
      shoulderOutsideFt: 8,
      eNCPercent: -2,
      eMaxPercent: 6,
      axisOfRotation: "centerline",
      lateralAccelC: 1.5,
      transitionType: "spiral",
      curveRadiusFt: 1100,
    },
    geometryExtras: { deflectionAngleDeg: 65, turnDirection: "right", leadTangentFt: 350, startElevationFt: 3200, gradePercent: 4.5, actualClearanceFt: 8 },
  },
];

export function loadCorridorPreset(preset: CorridorPreset) {
  createNewProject({
    corridorName: preset.corridorName,
    unitSystem: "us",
    designSpeedMph: preset.designSpeedMph,
    designVehicle: preset.designVehicle,
    designStandard: preset.designStandard,
    stationStart: preset.stationStart,
    stationEnd: preset.stationEnd,
  });
  localStorage.setItem(
    "highwaylab.horizontal-alignment",
    JSON.stringify({ ...preset.horizontal, ...preset.geometryExtras })
  );
  window.location.href = "/horizontal-alignment";
}
