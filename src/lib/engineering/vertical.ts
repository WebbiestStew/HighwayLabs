import { kMinCrest, kMinSag, ssdMinFt } from "./tables";

export type CurveClass = "crest" | "sag";

export interface VerticalInputs {
  curveClass: CurveClass;
  designSpeedMph: number;
  pvcStationFt: number;
  pvcElevationFt: number;
  g1Percent: number;
  g2Percent: number;
  lengthMode: "auto" | "manual";
  manualLengthFt: number;
  structure?: {
    stationFt: number;
    girderElevationFt: number;
    widthFt: number;
    requiredClearanceFt: number;
  } | null;
  sagCurbedUrban: boolean; // triggers K<=167 drainage/flatness check
}

export interface VerticalResults {
  A: number;
  kMin: number;
  lengthFt: number;
  K: number;
  pviStationFt: number;
  pviElevationFt: number;
  pvtStationFt: number;
  pvtElevationFt: number;
  extremaStationFt: number | null;
  extremaElevationFt: number | null;
  ssdMinFt: number;
  meetsKMin: boolean;
  meetsDrainageFlatness: boolean;
  structureCheck: {
    nearEdge: { stationFt: number; roadElevFt: number; clearanceFt: number };
    centerline: { stationFt: number; roadElevFt: number; clearanceFt: number };
    farEdge: { stationFt: number; roadElevFt: number; clearanceFt: number };
    governingClearanceFt: number;
    pass: boolean;
  } | null;
  elevationAt: (stationFt: number) => number;
  slopeAt: (stationFt: number) => number;
}

export function computeVertical(inputs: VerticalInputs): VerticalResults {
  const {
    curveClass,
    designSpeedMph,
    pvcStationFt,
    pvcElevationFt,
    g1Percent: g1,
    g2Percent: g2,
    lengthMode,
    manualLengthFt,
    structure,
    sagCurbedUrban,
  } = inputs;

  const A = Math.abs(g1 - g2);
  const kMin = curveClass === "crest" ? kMinCrest(designSpeedMph) : kMinSag(designSpeedMph);
  const autoLength = kMin * A;
  const lengthFt = lengthMode === "auto" ? autoLength : manualLengthFt;
  const K = A > 0 ? lengthFt / A : Infinity;
  const meetsKMin = A === 0 ? true : K >= kMin - 1e-6;
  const meetsDrainageFlatness = curveClass === "sag" && sagCurbedUrban ? K <= 167 : true;

  const pviStationFt = pvcStationFt + lengthFt / 2;
  const pviElevationFt = pvcElevationFt + (g1 / 100) * (lengthFt / 2);
  const pvtStationFt = pvcStationFt + lengthFt;
  const pvtElevationFt = pvcElevationFt + (g1 / 100) * lengthFt + ((g2 - g1) / 100 / (2 * lengthFt)) * lengthFt * lengthFt;

  const elevationAt = (stationFt: number) => {
    const x = stationFt - pvcStationFt;
    if (lengthFt <= 0) return pvcElevationFt;
    return pvcElevationFt + (g1 / 100) * x + ((g2 - g1) / 100 / (2 * lengthFt)) * x * x;
  };
  const slopeAt = (stationFt: number) => {
    const x = stationFt - pvcStationFt;
    if (lengthFt <= 0) return g1;
    return g1 + ((g2 - g1) / lengthFt) * x;
  };

  let extremaStationFt: number | null = null;
  let extremaElevationFt: number | null = null;
  if (g2 !== g1) {
    const xExt = (-g1 * lengthFt) / (g2 - g1);
    if (xExt > 0 && xExt < lengthFt) {
      extremaStationFt = pvcStationFt + xExt;
      extremaElevationFt = elevationAt(extremaStationFt);
    }
  }

  let structureCheck: VerticalResults["structureCheck"] = null;
  if (structure) {
    const mk = (stationFt: number) => {
      const roadElevFt = elevationAt(stationFt);
      return { stationFt, roadElevFt, clearanceFt: structure.girderElevationFt - roadElevFt };
    };
    const nearEdge = mk(structure.stationFt - structure.widthFt / 2);
    const centerline = mk(structure.stationFt);
    const farEdge = mk(structure.stationFt + structure.widthFt / 2);
    const governingClearanceFt = Math.min(nearEdge.clearanceFt, centerline.clearanceFt, farEdge.clearanceFt);
    structureCheck = {
      nearEdge,
      centerline,
      farEdge,
      governingClearanceFt,
      pass: governingClearanceFt >= structure.requiredClearanceFt,
    };
  }

  return {
    A,
    kMin,
    lengthFt,
    K,
    pviStationFt,
    pviElevationFt,
    pvtStationFt,
    pvtElevationFt,
    extremaStationFt,
    extremaElevationFt,
    ssdMinFt: ssdMinFt(designSpeedMph),
    meetsKMin,
    meetsDrainageFlatness,
    structureCheck,
    elevationAt,
    slopeAt,
  };
}
