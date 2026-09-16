import { describe, it, expect } from "vitest";
import {
  flowRatePcPhPl,
  computeMergeDiverge,
  computeWeaving,
  computeRampTerminal,
  computeDD1Queue,
  densityToLOS,
} from "./hcmOps";

describe("flow rate conversion", () => {
  it("reduces to V/(PHF*N) when there are no heavy vehicles", () => {
    const v = flowRatePcPhPl({ volumeVph: 2000, phf: 0.92, lanes: 2, heavyVehiclePercent: 0, passengerCarEquivalent: 2 });
    expect(v).toBeCloseTo(2000 / (0.92 * 2), 3);
  });

  it("increases flow rate as heavy vehicle % increases (more pce demand)", () => {
    const low = flowRatePcPhPl({ volumeVph: 2000, phf: 0.92, lanes: 2, heavyVehiclePercent: 2, passengerCarEquivalent: 2 });
    const high = flowRatePcPhPl({ volumeVph: 2000, phf: 0.92, lanes: 2, heavyVehiclePercent: 20, passengerCarEquivalent: 2 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("densityToLOS thresholds", () => {
  it("assigns LOS A/B/C/D/E/F at the documented boundaries", () => {
    expect(densityToLOS(5)).toBe("A");
    expect(densityToLOS(15)).toBe("B");
    expect(densityToLOS(25)).toBe("C");
    expect(densityToLOS(32)).toBe("D");
    expect(densityToLOS(40)).toBe("E");
    expect(densityToLOS(50)).toBe("F");
  });
});

describe("merge/diverge density", () => {
  it("increases with higher ramp demand, all else equal", () => {
    const light = computeMergeDiverge(
      { rampDemandVph: 200, freewayUpstreamVph: 4000, freewayLanes: 4, accelDecelLaneLengthFt: 700, phf: 0.92, heavyVehiclePercent: 5, passengerCarEquivalent: 2 },
      "merge"
    );
    const heavy = computeMergeDiverge(
      { rampDemandVph: 1200, freewayUpstreamVph: 4000, freewayLanes: 4, accelDecelLaneLengthFt: 700, phf: 0.92, heavyVehiclePercent: 5, passengerCarEquivalent: 2 },
      "merge"
    );
    expect(heavy.densityPcMiLn).toBeGreaterThan(light.densityPcMiLn);
  });

  it("adds a turbulence penalty when the ramp is much slower than the mainline", () => {
    const base = { rampDemandVph: 600, freewayUpstreamVph: 4000, freewayLanes: 4, accelDecelLaneLengthFt: 700, phf: 0.92, heavyVehiclePercent: 5, passengerCarEquivalent: 2 };
    const noDiff = computeMergeDiverge({ ...base, rampFfsMph: 55, mainlineFfsMph: 65 }, "merge");
    const bigDiff = computeMergeDiverge({ ...base, rampFfsMph: 25, mainlineFfsMph: 70 }, "merge");
    expect(bigDiff.densityPcMiLn).toBeGreaterThan(noDiff.densityPcMiLn);
    expect(bigDiff.speedDifferentialMph).toBeCloseTo(45, 3);
  });

  it("never returns a negative density", () => {
    const r = computeMergeDiverge(
      { rampDemandVph: 10, freewayUpstreamVph: 500, freewayLanes: 4, accelDecelLaneLengthFt: 2000, phf: 0.98, heavyVehiclePercent: 0, passengerCarEquivalent: 2 },
      "merge"
    );
    expect(r.densityPcMiLn).toBeGreaterThanOrEqual(0);
  });
});

describe("weaving analysis", () => {
  it("volume ratio is bounded between 0 and 1", () => {
    const r = computeWeaving({
      weavingVolumeVph: 900,
      nonWeavingVolumeVph: 3600,
      weavingSegmentLengthFt: 1500,
      minWeavingLanes: 2,
      totalLanes: 4,
      freewayFfsMph: 65,
      phf: 0.92,
      heavyVehiclePercent: 8,
      passengerCarEquivalent: 2,
    });
    expect(r.VR).toBeGreaterThan(0);
    expect(r.VR).toBeLessThan(1);
  });

  it("composite speed never exceeds free-flow speed", () => {
    const r = computeWeaving({
      weavingVolumeVph: 300,
      nonWeavingVolumeVph: 800,
      weavingSegmentLengthFt: 3000,
      minWeavingLanes: 2,
      totalLanes: 5,
      freewayFfsMph: 65,
      phf: 0.95,
      heavyVehiclePercent: 3,
      passengerCarEquivalent: 1.5,
    });
    expect(r.compositeSpeedMph).toBeLessThanOrEqual(65 + 1e-6);
  });
});

describe("Webster ramp terminal CMA", () => {
  it("computes Y as the sum of individual critical flow ratios", () => {
    const r = computeRampTerminal({
      criticalMovements: [
        { name: "A", volumeVph: 600, saturationFlowVphpl: 1800 },
        { name: "B", volumeVph: 400, saturationFlowVphpl: 1700 },
      ],
      numberOfPhases: 2,
      lostTimePerPhaseSec: 4,
    });
    expect(r.Y).toBeCloseTo(600 / 1800 + 400 / 1700, 6);
  });

  it("reports an oversaturated (infinite cycle) condition when Y >= 1", () => {
    const r = computeRampTerminal({
      criticalMovements: [
        { name: "A", volumeVph: 1800, saturationFlowVphpl: 1800 },
        { name: "B", volumeVph: 1000, saturationFlowVphpl: 1700 },
      ],
      numberOfPhases: 2,
      lostTimePerPhaseSec: 4,
    });
    expect(r.Y).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(r.optimalCycleLengthSec)).toBe(false);
    expect(r.los).toBe("F");
  });
});

describe("D/D/1 deterministic queuing", () => {
  it("produces zero queue when demand never exceeds capacity", () => {
    const r = computeDD1Queue({ arrivalRateVph: 1000, saturationRateVph: 1800, oversaturatedDurationMin: 20, postPeakArrivalRateVph: 800 });
    expect(r.qMaxVeh).toBe(0);
  });

  it("Q_max matches (lambda - mu) * T exactly when oversaturated", () => {
    const r = computeDD1Queue({ arrivalRateVph: 2000, saturationRateVph: 1700, oversaturatedDurationMin: 15, postPeakArrivalRateVph: 1200 });
    const lambda = 2000 / 60;
    const mu = 1700 / 60;
    expect(r.qMaxVeh).toBeCloseTo((lambda - mu) * 15, 4);
  });

  it("recovers to zero queue by the reported recovery time", () => {
    const r = computeDD1Queue({ arrivalRateVph: 2000, saturationRateVph: 1700, oversaturatedDurationMin: 15, postPeakArrivalRateVph: 1200 });
    const lastPoint = r.series[r.series.length - 1];
    expect(lastPoint.queueVeh).toBeCloseTo(0, 1);
  });
});
