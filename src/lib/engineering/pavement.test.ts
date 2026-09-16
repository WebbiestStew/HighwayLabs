import { describe, it, expect } from "vitest";
import { computePavement, solveRequiredSN, providedSN, zR, minimumThicknesses, type PavementInputs } from "./pavement";

const baseInputs: PavementInputs = {
  w18: 4_500_000,
  reliabilityPercent: 95,
  s0: 0.45,
  p0: 4.2,
  pt: 2.5,
  mrPsi: 7500,
  a1: 0.44,
  d1: 5,
  a2: 0.14,
  d2: 8,
  m2: 1,
  a3: 0.11,
  d3: 6,
  m3: 1,
};

describe("standard normal deviate table", () => {
  it("matches published Z_R values at key reliability levels", () => {
    expect(zR(50)).toBeCloseTo(0, 3);
    expect(zR(95)).toBeCloseTo(-1.645, 3);
    expect(zR(99.9)).toBeCloseTo(-3.09, 3);
  });
});

describe("iterative SN solver", () => {
  it("the solved SN satisfies the 1993 AASHTO equation to within tight tolerance", () => {
    const sn = solveRequiredSN(baseInputs);
    const ZR = zR(baseInputs.reliabilityPercent);
    const deltaPSI = baseInputs.p0 - baseInputs.pt;
    const lhs = Math.log10(baseInputs.w18);
    const rhs =
      ZR * baseInputs.s0 +
      9.36 * Math.log10(sn + 1) -
      0.2 +
      Math.log10(deltaPSI / 2.7) / (0.4 + 1094 / Math.pow(sn + 1, 5.19)) +
      2.32 * Math.log10(baseInputs.mrPsi) -
      8.07;
    expect(rhs).toBeCloseTo(lhs, 2);
  });

  it("requires a larger SN for higher traffic (W18)", () => {
    const low = solveRequiredSN({ ...baseInputs, w18: 500_000 });
    const high = solveRequiredSN({ ...baseInputs, w18: 20_000_000 });
    expect(high).toBeGreaterThan(low);
  });

  it("requires a larger SN for higher reliability", () => {
    const low = solveRequiredSN({ ...baseInputs, reliabilityPercent: 80 });
    const high = solveRequiredSN({ ...baseInputs, reliabilityPercent: 99 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("provided structural number", () => {
  it("matches the closed-form a1D1 + a2D2m2 + a3D3m3", () => {
    const sn = providedSN(baseInputs);
    expect(sn).toBeCloseTo(0.44 * 5 + 0.14 * 8 * 1 + 0.11 * 6 * 1, 6);
  });
});

describe("pass/fail and back-solved capacity", () => {
  it("is internally consistent: allowable W18 at the provided SN is >= design W18 exactly when pass=true", () => {
    const passing = computePavement({ ...baseInputs, d1: 6, d2: 10, d3: 8 });
    expect(passing.pass).toBe(true);
    expect(passing.allowableW18).toBeGreaterThanOrEqual(baseInputs.w18);

    const failing = computePavement({ ...baseInputs, d1: 2, d2: 4, d3: 4 });
    expect(failing.pass).toBe(false);
    expect(failing.allowableW18).toBeLessThan(baseInputs.w18);
  });
});

describe("minimum layer thickness table", () => {
  it("steps up with increasing ESALs", () => {
    expect(minimumThicknesses(10_000).surfaceIn).toBe(1.0);
    expect(minimumThicknesses(1_000_000).surfaceIn).toBe(3.0);
    expect(minimumThicknesses(10_000_000).surfaceIn).toBe(4.0);
  });
});
