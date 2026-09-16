import { describe, it, expect } from "vitest";
import { fMax, deltaMax, wL, ssdMinFt, kMinCrest, kMinSag } from "./tables";

describe("fMax", () => {
  it("matches published endpoints", () => {
    expect(fMax(15)).toBeCloseTo(0.38, 3);
    expect(fMax(80)).toBeCloseTo(0.08, 3);
  });
  it("is monotonically non-increasing with speed", () => {
    const speeds = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
    for (let i = 1; i < speeds.length; i++) {
      expect(fMax(speeds[i])).toBeLessThanOrEqual(fMax(speeds[i - 1]));
    }
  });
  it("clamps outside the table range instead of extrapolating", () => {
    expect(fMax(5)).toBe(fMax(15));
    expect(fMax(120)).toBe(fMax(80));
  });
});

describe("deltaMax", () => {
  it("matches the two endpoints given in the AASHTO spec (0.78% at 15mph, 0.35% at 80mph)", () => {
    expect(deltaMax(15)).toBeCloseTo(0.78, 3);
    expect(deltaMax(80)).toBeCloseTo(0.35, 3);
  });
  it("interpolates linearly between breakpoints", () => {
    // midpoint of 55 (0.47) and 60 (0.45) -> 57.5 should be 0.46
    expect(deltaMax(57.5)).toBeCloseTo(0.46, 3);
  });
});

describe("wL multi-lane adjustment factor", () => {
  it("matches the four values given in the spec", () => {
    expect(wL(1)).toBeCloseTo(1.0, 3);
    expect(wL(1.5)).toBeCloseTo(1.2, 3);
    expect(wL(2)).toBeCloseTo(1.5, 3);
    expect(wL(3)).toBeCloseTo(2.0, 3);
  });
});

describe("ssdMinFt", () => {
  it("produces the textbook 60mph -> ~570ft SSD (level grade)", () => {
    // 1.47*60*2.5 + 60^2/(30*(11.2/32.2)) = 220.5 + 344.9 = ~565
    expect(ssdMinFt(60)).toBeGreaterThan(550);
    expect(ssdMinFt(60)).toBeLessThan(580);
  });
  it("increases monotonically with speed", () => {
    expect(ssdMinFt(70)).toBeGreaterThan(ssdMinFt(60));
  });
});

describe("K-factor tables", () => {
  it("sag K-min exceeds crest K-min at the same speed (headlight vs SSD criteria)", () => {
    // Sag curves generally require a larger K at moderate speeds under the
    // headlight-sight-distance criterion than crest curves under SSD.
    expect(kMinSag(30)).toBeGreaterThan(0);
    expect(kMinCrest(30)).toBeGreaterThan(0);
  });
  it("both increase monotonically with design speed", () => {
    const speeds = [15, 30, 45, 60, 75];
    for (let i = 1; i < speeds.length; i++) {
      expect(kMinCrest(speeds[i])).toBeGreaterThan(kMinCrest(speeds[i - 1]));
      expect(kMinSag(speeds[i])).toBeGreaterThan(kMinSag(speeds[i - 1]));
    }
  });
});
