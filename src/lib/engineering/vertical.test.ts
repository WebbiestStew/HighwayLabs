import { describe, it, expect } from "vitest";
import { computeVertical, type VerticalInputs } from "./vertical";

const baseInputs: VerticalInputs = {
  curveClass: "crest",
  designSpeedMph: 60,
  pvcStationFt: 1000,
  pvcElevationFt: 600,
  g1Percent: 2,
  g2Percent: -2,
  lengthMode: "manual",
  manualLengthFt: 800,
  structure: null,
  sagCurbedUrban: false,
};

describe("elevation equation", () => {
  it("matches the tangent grade exactly at PVC (x=0)", () => {
    const r = computeVertical(baseInputs);
    expect(r.elevationAt(baseInputs.pvcStationFt)).toBeCloseTo(600, 6);
  });

  it("matches PVT elevation computed from both grades", () => {
    const r = computeVertical(baseInputs);
    const expected = 600 + (2 / 100) * 800 + ((-2 - 2) / 100 / (2 * 800)) * 800 * 800;
    expect(r.elevationAt(baseInputs.pvcStationFt + 800)).toBeCloseTo(expected, 4);
    expect(r.pvtElevationFt).toBeCloseTo(expected, 4);
  });

  it("PVI elevation sits exactly halfway using the entering grade", () => {
    const r = computeVertical(baseInputs);
    expect(r.pviElevationFt).toBeCloseTo(600 + 2 * 4, 6); // 2% over 400ft
  });
});

describe("high/low point extrema", () => {
  it("finds the interior high point for a symmetric crest curve", () => {
    const r = computeVertical(baseInputs);
    // x_ext = -g1*L/(g2-g1) = -2*800/(-4) = 400 -> midpoint for symmetric grades
    expect(r.extremaStationFt).toBeCloseTo(1400, 3);
  });

  it("slope at the extrema is ~0", () => {
    const r = computeVertical(baseInputs);
    expect(r.slopeAt(r.extremaStationFt!)).toBeCloseTo(0, 3);
  });

  it("returns null extrema for a monotonic (non-crest/sag) grade change", () => {
    const r = computeVertical({ ...baseInputs, g1Percent: 1, g2Percent: 2 });
    expect(r.extremaStationFt).toBeNull();
  });
});

describe("K-factor compliance", () => {
  it("auto length mode uses K_min · A exactly", () => {
    const r = computeVertical({ ...baseInputs, lengthMode: "auto" });
    expect(r.lengthFt).toBeCloseTo(r.kMin * r.A, 6);
    expect(r.meetsKMin).toBe(true);
  });

  it("flags an under-length manual curve as non-conforming", () => {
    const r = computeVertical({ ...baseInputs, lengthMode: "manual", manualLengthFt: 1 });
    expect(r.meetsKMin).toBe(false);
  });
});

describe("overhead structure clearance", () => {
  it("computes governing clearance as the minimum across near/CL/far", () => {
    const r = computeVertical({
      ...baseInputs,
      structure: { stationFt: 1400, girderElevationFt: 640, widthFt: 40, requiredClearanceFt: 16.5 },
    });
    expect(r.structureCheck).not.toBeNull();
    const { nearEdge, centerline, farEdge, governingClearanceFt } = r.structureCheck!;
    expect(governingClearanceFt).toBeLessThanOrEqual(nearEdge.clearanceFt);
    expect(governingClearanceFt).toBeLessThanOrEqual(centerline.clearanceFt);
    expect(governingClearanceFt).toBeLessThanOrEqual(farEdge.clearanceFt);
  });

  it("fails when girder elevation is too low", () => {
    const r = computeVertical({
      ...baseInputs,
      structure: { stationFt: 1400, girderElevationFt: 610, widthFt: 40, requiredClearanceFt: 16.5 },
    });
    expect(r.structureCheck!.pass).toBe(false);
  });
});

describe("degenerate inputs", () => {
  it("handles zero-length curve without NaN", () => {
    const r = computeVertical({ ...baseInputs, manualLengthFt: 0.0001 });
    expect(Number.isNaN(r.elevationAt(1000))).toBe(false);
  });

  it("handles g1 === g2 (straight grade line) without div-by-zero", () => {
    const r = computeVertical({ ...baseInputs, g1Percent: 1.5, g2Percent: 1.5 });
    expect(r.A).toBe(0);
    expect(r.meetsKMin).toBe(true);
    expect(Number.isNaN(r.elevationAt(1200))).toBe(false);
  });
});
