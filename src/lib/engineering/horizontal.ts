import { fMax, deltaMax, wL, DESIGN_VEHICLE_GEOMETRY } from "./tables";

export interface HorizontalInputs {
  designSpeedMph: number;
  designVehicle: string;
  lanesPerDirection: number; // 1-6
  laneWidthFt: number; // 10, 11, 12
  shoulderInsideFt: number;
  shoulderOutsideFt: number;
  eNCPercent: number; // normal crown, negative e.g. -2.0
  eMaxPercent: number; // 4,6,8,10,12
  axisOfRotation: "centerline" | "inside-edge" | "outside-edge";
  lateralAccelC: number; // 1-3 ft/s^3, spiral comfort
  transitionType: "spiral" | "linear";
  curveRadiusFt: number; // selected/actual radius
  sightObstructionSSDFt?: number; // for HSO / middle ordinate, optional override
}

export interface HorizontalResults {
  fMax: number;
  deltaMaxPct: number;
  rMinFt: number;
  meetsRMin: boolean;
  lanesRotated: number;
  wRotatedFt: number; // width rotated about axis
  wl: number;
  eDesignPercent: number;
  tangentRunoutFt: number;
  superelevationRunoffFt: number;
  totalTransitionFt: number;
  spiralLengthMinFt: number;
  spiralParameterA: number;
  ssdFt: number;
  middleOrdinateFt: number;
  widening: {
    wheelbaseFt: number;
    z: number;
    trackShiftFt: number;
    wcFt: number;
    applicable: boolean;
  };
  stationControlPoints: {
    label: string;
    offsetFromTSFt: number;
    eLeft: number;
    eRight: number;
  }[];
}

const LANE_CLEARANCE_C_FT = 2.0; // simplified lateral clearance constant, AASHTO widening formula

export function computeHorizontal(inputs: HorizontalInputs): HorizontalResults {
  const {
    designSpeedMph: V,
    lanesPerDirection,
    laneWidthFt: W,
    shoulderOutsideFt,
    eNCPercent,
    eMaxPercent,
    axisOfRotation,
    lateralAccelC,
    curveRadiusFt: R,
  } = inputs;

  const f = fMax(V);
  const dMax = deltaMax(V);

  // R_min = V^2 / [15 (0.01 emax + fmax)]
  const rMinFt = (V * V) / (15 * (0.01 * eMaxPercent + f));
  const meetsRMin = R >= rMinFt && R > 0;

  // Pavement width rotated depends on axis of rotation: centerline rotates half-width per side effectively,
  // edge-of-pavement rotation rotates the full cross-section width about that edge.
  const lanesRotated =
    axisOfRotation === "centerline" ? lanesPerDirection : lanesPerDirection;
  const wl = wL(lanesRotated);
  const wRotatedFt =
    axisOfRotation === "centerline"
      ? lanesPerDirection * W
      : lanesPerDirection * W + shoulderOutsideFt;

  // Method-5-style empirical distribution approximation (see engine docs):
  // bounded, monotonic curve between R_max(e≈0) and R_min(e_max), matching
  // AASHTO's qualitative "friction develops first, superelevation catches up" shape.
  const rMax0 = (V * V) / (15 * f); // radius at which e≈0 suffices (friction alone)
  let eDesignPercent: number;
  if (!Number.isFinite(R) || R <= 0) {
    eDesignPercent = 0;
  } else if (R >= rMax0) {
    eDesignPercent = Math.max(eNCPercent, 0) * 0; // normal crown governs, no positive superelevation demand
  } else if (R <= rMinFt) {
    eDesignPercent = eMaxPercent;
  } else {
    const t =
      (1 / R - 1 / rMax0) / (1 / rMinFt - 1 / rMax0 || 1);
    const tClamped = Math.min(1, Math.max(0, t));
    eDesignPercent = eMaxPercent * Math.pow(tClamped, 1.5);
  }
  eDesignPercent = Math.round(eDesignPercent * 10) / 10;

  // Tangent runout: L_t = (W_rotated * |e_NC|) / Delta_max
  const tangentRunoutFt = (wRotatedFt * Math.abs(eNCPercent)) / dMax;

  // Superelevation runoff: L_r = (w_l * W_rotated * e_design) / Delta_max
  const superelevationRunoffFt = (wl * wRotatedFt * eDesignPercent) / dMax;

  const totalTransitionFt = tangentRunoutFt + superelevationRunoffFt;

  // Spiral: Barnett L_s_min = 1.6 V^3 / (R * C)
  const spiralLengthMinFt =
    R > 0 ? (1.6 * Math.pow(V, 3)) / (R * lateralAccelC) : 0;
  const spiralLengthUsedFt =
    inputs.transitionType === "spiral"
      ? Math.max(spiralLengthMinFt, superelevationRunoffFt)
      : superelevationRunoffFt;
  const spiralParameterA =
    inputs.transitionType === "spiral" && R > 0
      ? Math.sqrt(spiralLengthUsedFt * R)
      : 0;

  // SSD (level grade)
  const t_pr = 2.5;
  const a = 11.2;
  const ssdFt = 1.47 * V * t_pr + (V * V) / (30 * (a / 32.2));
  const ssdUsed = inputs.sightObstructionSSDFt ?? ssdFt;

  // Middle ordinate / HSO: M = R[1 - cos(28.65 * SSD / R)]
  const middleOrdinateFt =
    R > 0 ? R * (1 - Math.cos((28.65 * ssdUsed) / R * (Math.PI / 180))) : 0;

  // Widening
  const veh = DESIGN_VEHICLE_GEOMETRY[inputs.designVehicle] ?? DESIGN_VEHICLE_GEOMETRY.P;
  const applicable = R > 0 && R < 2500 && veh.wheelbaseFt > 15;
  const z = R > 0 ? V / (9.5 * Math.sqrt(R)) : 0;
  const trackShiftFt =
    R > veh.wheelbaseFt ? R - Math.sqrt(R * R - veh.wheelbaseFt * veh.wheelbaseFt) : 0;
  const wcFt = applicable
    ? lanesPerDirection * W + LANE_CLEARANCE_C_FT + trackShiftFt + z
    : lanesPerDirection * W;

  // Station control points along transition (TS -> SC -> CS -> ST equivalent for linear runoff)
  const stationControlPoints = buildControlPoints({
    tangentRunoutFt,
    superelevationRunoffFt,
    eNCPercent,
    eDesignPercent,
    axisOfRotation,
  });

  return {
    fMax: f,
    deltaMaxPct: dMax,
    rMinFt,
    meetsRMin,
    lanesRotated,
    wRotatedFt,
    wl,
    eDesignPercent,
    tangentRunoutFt,
    superelevationRunoffFt,
    totalTransitionFt,
    spiralLengthMinFt,
    spiralParameterA,
    ssdFt,
    middleOrdinateFt,
    widening: { wheelbaseFt: veh.wheelbaseFt, z, trackShiftFt, wcFt, applicable },
    stationControlPoints,
  };
}

function buildControlPoints(args: {
  tangentRunoutFt: number;
  superelevationRunoffFt: number;
  eNCPercent: number;
  eDesignPercent: number;
  axisOfRotation: HorizontalInputs["axisOfRotation"];
}) {
  const { tangentRunoutFt, superelevationRunoffFt, eNCPercent, eDesignPercent } = args;
  // Normal crown -> adverse crown removed (level outer) -> reverse crown (matches inner) -> full super
  return [
    { label: "Normal Crown (NC)", offsetFromTSFt: -tangentRunoutFt, eLeft: eNCPercent, eRight: eNCPercent },
    { label: "Level Section (Adverse Crown Removed)", offsetFromTSFt: 0, eLeft: 0, eRight: eNCPercent },
    {
      label: "Reverse Crown",
      offsetFromTSFt: superelevationRunoffFt * (Math.abs(eNCPercent) / Math.max(eDesignPercent, 0.01)),
      eLeft: eNCPercent,
      eRight: eNCPercent,
    },
    { label: "Full Superelevation (FS)", offsetFromTSFt: superelevationRunoffFt, eLeft: eDesignPercent, eRight: eDesignPercent },
  ];
}
