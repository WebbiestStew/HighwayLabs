// HCM 6th/7th Edition freeway operations — merge/diverge influence area,
// weaving, and signalized ramp-terminal analysis. Density-LOS thresholds and
// speed-flow relationships are simplified, clearly-labeled representative
// models of the published HCM methodology (which relies on multi-page
// regression tables); verify against the current HCM edition worksheets
// before design-level use.

export type LOSGrade = "A" | "B" | "C" | "D" | "E" | "F";

const RAMP_DENSITY_THRESHOLDS: [number, LOSGrade][] = [
  [10, "A"], [20, "B"], [28, "C"], [35, "D"], [43, "E"],
];
export function densityToLOS(densityPcMiLn: number): LOSGrade {
  for (const [max, grade] of RAMP_DENSITY_THRESHOLDS) {
    if (densityPcMiLn <= max) return grade;
  }
  return "F";
}

export function losColor(grade: LOSGrade): string {
  return { A: "#10b981", B: "#34d399", C: "#f59e0b", D: "#f97316", E: "#ef4444", F: "#ef4444" }[grade];
}

export interface FlowRateInputs {
  volumeVph: number;
  phf: number;
  lanes: number;
  heavyVehiclePercent: number;
  passengerCarEquivalent: number;
  driverPopulationFactor?: number;
}
export function flowRatePcPhPl(inputs: FlowRateInputs): number {
  const { volumeVph, phf, lanes, heavyVehiclePercent, passengerCarEquivalent } = inputs;
  const fp = inputs.driverPopulationFactor ?? 1.0;
  const fHV = 1 / (1 + (heavyVehiclePercent / 100) * (passengerCarEquivalent - 1));
  return volumeVph / (phf * Math.max(lanes, 1) * fHV * fp);
}

export interface MergeInputs {
  rampDemandVph: number;
  freewayUpstreamVph: number;
  freewayLanes: number;
  accelDecelLaneLengthFt: number;
  phf: number;
  heavyVehiclePercent: number;
  passengerCarEquivalent: number;
  /** Optional — when both are given, a large ramp/mainline speed differential adds a turbulence penalty to density. */
  rampFfsMph?: number;
  mainlineFfsMph?: number;
}
export interface MergeResults {
  vR: number;
  v12: number;
  densityPcMiLn: number;
  speedDifferentialMph: number;
  los: LOSGrade;
}
export function computeMergeDiverge(inputs: MergeInputs, type: "merge" | "diverge"): MergeResults {
  const common = { phf: inputs.phf, heavyVehiclePercent: inputs.heavyVehiclePercent, passengerCarEquivalent: inputs.passengerCarEquivalent };
  const vR = flowRatePcPhPl({ volumeVph: inputs.rampDemandVph, lanes: 1, ...common });
  const v12 = flowRatePcPhPl({ volumeVph: inputs.freewayUpstreamVph, lanes: Math.min(inputs.freewayLanes, 2), ...common });
  const La = inputs.accelDecelLaneLengthFt;
  const density =
    type === "merge"
      ? 5.475 + 0.00734 * vR + 0.0078 * v12 - 0.00627 * La
      : 4.252 + 0.0086 * vR + 0.009 * v12 - 0.009 * La;

  // Speed-differential turbulence adjustment: a ramp running much slower than the
  // mainline forces harder braking/weaving at the gore, which the base regression
  // (fit for a "typical" differential) doesn't otherwise capture.
  const speedDifferentialMph =
    inputs.rampFfsMph != null && inputs.mainlineFfsMph != null ? Math.max(0, inputs.mainlineFfsMph - inputs.rampFfsMph) : 0;
  const turbulencePenalty = Math.max(0, speedDifferentialMph - 10) * 0.06;

  const densityClamped = Math.max(0, density + turbulencePenalty);
  return { vR, v12, densityPcMiLn: densityClamped, speedDifferentialMph, los: densityToLOS(densityClamped) };
}

export interface WeavingInputs {
  weavingVolumeVph: number;
  nonWeavingVolumeVph: number;
  weavingSegmentLengthFt: number;
  minWeavingLanes: number;
  totalLanes: number;
  freewayFfsMph: number;
  phf: number;
  heavyVehiclePercent: number;
  passengerCarEquivalent: number;
}
export interface WeavingResults {
  vW: number;
  vNW: number;
  vTotal: number;
  VR: number;
  sW: number;
  sNW: number;
  compositeSpeedMph: number;
  compositeDensityPcMiLn: number;
  los: LOSGrade;
}
export function computeWeaving(inputs: WeavingInputs): WeavingResults {
  const common = { phf: inputs.phf, heavyVehiclePercent: inputs.heavyVehiclePercent, passengerCarEquivalent: inputs.passengerCarEquivalent };
  const vW = flowRatePcPhPl({ volumeVph: inputs.weavingVolumeVph, lanes: inputs.minWeavingLanes, ...common });
  const vNW = flowRatePcPhPl({ volumeVph: inputs.nonWeavingVolumeVph, lanes: Math.max(inputs.totalLanes - inputs.minWeavingLanes, 1), ...common });
  const vTotal = vW + vNW;
  const VR = vTotal > 0 ? vW / vTotal : 0;

  const minSpeed = 15;
  const FFS = inputs.freewayFfsMph;
  const turbulence = Math.min(1, (5280 / Math.max(inputs.weavingSegmentLengthFt, 500)) * (1 + VR));
  const sW = Math.max(minSpeed, FFS - (FFS - minSpeed) * Math.min(1, 0.55 * turbulence + 0.15 * VR));
  const sNW = Math.max(minSpeed + 5, FFS - (FFS - minSpeed) * Math.min(0.85, 0.25 * turbulence));

  const compositeSpeedMph = vTotal > 0 ? vTotal / (vW / sW + vNW / sNW) : FFS;
  const compositeDensityPcMiLn = vTotal / (Math.max(inputs.totalLanes, 1) * Math.max(compositeSpeedMph, 1));

  return { vW, vNW, vTotal, VR, sW, sNW, compositeSpeedMph, compositeDensityPcMiLn, los: densityToLOS(compositeDensityPcMiLn) };
}

export interface RampTerminalMovement {
  name: string;
  volumeVph: number;
  saturationFlowVphpl: number;
}
export interface RampTerminalInputs {
  criticalMovements: RampTerminalMovement[];
  numberOfPhases: number;
  lostTimePerPhaseSec: number;
}
export interface RampTerminalResults {
  criticalFlowRatios: { name: string; y: number }[];
  Y: number;
  totalLostTimeSec: number;
  optimalCycleLengthSec: number;
  degreeOfSaturation: number;
  los: LOSGrade;
}
export function computeRampTerminal(inputs: RampTerminalInputs): RampTerminalResults {
  const criticalFlowRatios = inputs.criticalMovements.map((m) => ({
    name: m.name,
    y: m.volumeVph / Math.max(m.saturationFlowVphpl, 1),
  }));
  const Y = criticalFlowRatios.reduce((s, m) => s + m.y, 0);
  const L = inputs.numberOfPhases * inputs.lostTimePerPhaseSec;
  const optimalCycleLengthSec = Y < 1 ? (1.5 * L + 5) / (1 - Y) : Infinity;
  const degreeOfSaturation =
    Y < 1 && Number.isFinite(optimalCycleLengthSec)
      ? Y * optimalCycleLengthSec / Math.max(optimalCycleLengthSec - L, 1)
      : 1.5;
  const los: LOSGrade =
    degreeOfSaturation <= 0.6 ? "A" : degreeOfSaturation <= 0.7 ? "B" : degreeOfSaturation <= 0.8 ? "C" : degreeOfSaturation <= 0.9 ? "D" : degreeOfSaturation <= 1.0 ? "E" : "F";
  return { criticalFlowRatios, Y, totalLostTimeSec: L, optimalCycleLengthSec, degreeOfSaturation, los };
}

export interface DD1QueueInputs {
  arrivalRateVph: number;
  saturationRateVph: number; // discharge capacity during oversaturation
  oversaturatedDurationMin: number;
  postPeakArrivalRateVph: number;
}
export interface DD1QueueResults {
  qMaxVeh: number;
  recoveryTimeMin: number;
  totalVehicleHoursDelay: number;
  series: { tMin: number; queueVeh: number }[];
}
export function computeDD1Queue(inputs: DD1QueueInputs): DD1QueueResults {
  const { arrivalRateVph, saturationRateVph, oversaturatedDurationMin, postPeakArrivalRateVph } = inputs;
  const lambda = arrivalRateVph / 60;
  const mu = saturationRateVph / 60;
  const qMaxVeh = Math.max(0, (lambda - mu) * oversaturatedDurationMin);

  const lambdaPost = postPeakArrivalRateVph / 60;
  const recoveryTimeMin = mu > lambdaPost ? qMaxVeh / (mu - lambdaPost) : Infinity;

  const totalVehicleHoursDelay = (0.5 * qMaxVeh * (oversaturatedDurationMin + (Number.isFinite(recoveryTimeMin) ? recoveryTimeMin : 0))) / 60;

  const series: { tMin: number; queueVeh: number }[] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * oversaturatedDurationMin;
    series.push({ tMin: t, queueVeh: Math.max(0, (lambda - mu) * t) });
  }
  if (Number.isFinite(recoveryTimeMin)) {
    for (let i = 1; i <= steps; i++) {
      const t = oversaturatedDurationMin + (i / steps) * recoveryTimeMin;
      const q = Math.max(0, qMaxVeh - (mu - lambdaPost) * (t - oversaturatedDurationMin));
      series.push({ tMin: t, queueVeh: q });
    }
  }

  return { qMaxVeh, recoveryTimeMin, totalVehicleHoursDelay, series };
}
