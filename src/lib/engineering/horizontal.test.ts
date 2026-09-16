import { describe, it, expect } from "vitest";
import { computeHorizontal, type HorizontalInputs } from "./horizontal";
import { fMax } from "./tables";

const baseInputs: HorizontalInputs = {
  designSpeedMph: 60,
  designVehicle: "WB-62",
  lanesPerDirection: 2,
  laneWidthFt: 12,
  shoulderInsideFt: 4,
  shoulderOutsideFt: 8,
  eNCPercent: -2,
  eMaxPercent: 6,
  axisOfRotation: "centerline",
  lateralAccelC: 1.5,
  transitionType: "spiral",
  curveRadiusFt: 1500,
};

describe("R_min formula", () => {
  it("matches the AASHTO closed form V^2 / [15(0.01 emax + fmax)]", () => {
    const r = computeHorizontal(baseInputs);
    const f = fMax(60);
    const expected = (60 * 60) / (15 * (0.01 * 6 + f));
    expect(r.rMinFt).toBeCloseTo(expected, 3);
  });

  it("flags a radius below R_min as non-conforming", () => {
    const r = computeHorizontal({ ...baseInputs, curveRadiusFt: 10 });
    expect(r.meetsRMin).toBe(false);
  });

  it("flags a radius above R_min as conforming", () => {
    const r = computeHorizontal({ ...baseInputs, curveRadiusFt: 100000 });
    expect(r.meetsRMin).toBe(true);
  });
});

describe("design superelevation", () => {
  it("reaches e_max exactly at R_min", () => {
    const pre = computeHorizontal(baseInputs);
    const atMin = computeHorizontal({ ...baseInputs, curveRadiusFt: pre.rMinFt });
    expect(atMin.eDesignPercent).toBeCloseTo(6, 0);
  });

  it("never exceeds e_max even for very sharp radii", () => {
    const r = computeHorizontal({ ...baseInputs, curveRadiusFt: 50 });
    expect(r.eDesignPercent).toBeLessThanOrEqual(6);
  });

  it("is zero (normal crown governs) for very flat radii", () => {
    const r = computeHorizontal({ ...baseInputs, curveRadiusFt: 1_000_000 });
    expect(r.eDesignPercent).toBe(0);
  });
});

describe("runoff / runout lengths", () => {
  it("scales runoff length linearly with e_design", () => {
    const small = computeHorizontal({ ...baseInputs, curveRadiusFt: 3000 });
    const large = computeHorizontal({ ...baseInputs, curveRadiusFt: 800 });
    expect(large.superelevationRunoffFt).toBeGreaterThan(small.superelevationRunoffFt);
  });

  it("total transition length is the sum of runout and runoff", () => {
    const r = computeHorizontal(baseInputs);
    expect(r.totalTransitionFt).toBeCloseTo(r.tangentRunoutFt + r.superelevationRunoffFt, 6);
  });
});

describe("degenerate / edge-case inputs never produce NaN or throw", () => {
  it("handles R = 0 gracefully", () => {
    const r = computeHorizontal({ ...baseInputs, curveRadiusFt: 0 });
    expect(Number.isFinite(r.rMinFt)).toBe(true);
    expect(Number.isNaN(r.eDesignPercent)).toBe(false);
    expect(Number.isNaN(r.middleOrdinateFt)).toBe(false);
    expect(Number.isNaN(r.widening.wcFt)).toBe(false);
  });

  it("handles eMaxPercent equal to |eNCPercent| without dividing by zero", () => {
    const r = computeHorizontal({ ...baseInputs, eMaxPercent: 2, eNCPercent: -2 });
    expect(Number.isNaN(r.stationControlPoints[2].offsetFromTSFt)).toBe(false);
  });

  it("handles a single lane with minimum width", () => {
    const r = computeHorizontal({ ...baseInputs, lanesPerDirection: 1, laneWidthFt: 10 });
    expect(Number.isFinite(r.tangentRunoutFt)).toBe(true);
    expect(r.tangentRunoutFt).toBeGreaterThan(0);
  });
});

describe("mechanical widening", () => {
  it("increases required pavement width for sharp curves with long-wheelbase vehicles", () => {
    const sharp = computeHorizontal({ ...baseInputs, curveRadiusFt: 300, designVehicle: "WB-67" });
    expect(sharp.widening.applicable).toBe(true);
    expect(sharp.widening.wcFt).toBeGreaterThan(baseInputs.lanesPerDirection * baseInputs.laneWidthFt);
  });

  it("is not applicable for flat curves", () => {
    const flat = computeHorizontal({ ...baseInputs, curveRadiusFt: 10000 });
    expect(flat.widening.applicable).toBe(false);
  });
});
