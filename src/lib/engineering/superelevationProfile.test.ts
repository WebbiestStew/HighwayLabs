import { describe, it, expect } from "vitest";
import { slopesAtOffset, TRANSITION_STAGES, type TransitionGeometry } from "./superelevationProfile";

const geometry: TransitionGeometry = {
  tangentRunoutFt: 100,
  superelevationRunoffFt: 250,
  eNCPercent: -2,
  eDesignPercent: 6,
};

describe("slopesAtOffset boundary conditions", () => {
  it("both edges sit at normal crown magnitude at x=0 (TS)", () => {
    const s = slopesAtOffset(0, geometry);
    expect(s.lowSidePercent).toBeCloseTo(-2, 3);
    expect(s.highSidePercent).toBeCloseTo(-2, 3);
  });

  it("high side is level (0%) at the end of tangent runout", () => {
    const s = slopesAtOffset(100, geometry);
    expect(s.highSidePercent).toBeCloseTo(0, 3);
  });

  it("both edges reach full design superelevation at x = Lt+Lr", () => {
    const s = slopesAtOffset(350, geometry);
    expect(s.lowSidePercent).toBeCloseTo(-6, 3);
    expect(s.highSidePercent).toBeCloseTo(6, 3);
  });

  it("clamps beyond the transition length instead of extrapolating", () => {
    const s = slopesAtOffset(10000, geometry);
    expect(s.lowSidePercent).toBeCloseTo(-6, 3);
    expect(s.highSidePercent).toBeCloseTo(6, 3);
  });
});

describe("transition stage stationing", () => {
  it("produces stages in increasing station order", () => {
    const stages = TRANSITION_STAGES(geometry);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].x).toBeGreaterThanOrEqual(stages[i - 1].x);
    }
  });
});
