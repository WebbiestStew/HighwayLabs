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
  it("produces stages in increasing station order (spiral, default)", () => {
    const stages = TRANSITION_STAGES(geometry);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].x).toBeGreaterThanOrEqual(stages[i - 1].x);
    }
    expect(stages.some((s) => s.label.includes("PC"))).toBe(false);
  });

  it("produces stages in increasing station order (linear/simple curve)", () => {
    const stages = TRANSITION_STAGES(geometry, "linear");
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].x).toBeGreaterThanOrEqual(stages[i - 1].x);
    }
  });

  it("places PC at 2/3 of the runoff length for a simple (unspiraled) curve, before full superelevation", () => {
    const stages = TRANSITION_STAGES(geometry, "linear");
    const pc = stages.find((s) => s.label.includes("PC"));
    expect(pc).toBeDefined();
    expect(pc!.x).toBeCloseTo(geometry.tangentRunoutFt + geometry.superelevationRunoffFt * (2 / 3), 6);
    const fullSuper = stages.find((s) => s.label.includes("Full Superelevation"));
    expect(fullSuper!.x).toBeGreaterThan(pc!.x);
  });

  it("a spiraled curve has no PC marker — full superelevation coincides with SC", () => {
    const stages = TRANSITION_STAGES(geometry, "spiral");
    expect(stages.find((s) => s.label.includes("PC"))).toBeUndefined();
    const fullSuper = stages.find((s) => s.label.includes("Full Superelevation"));
    expect(fullSuper!.x).toBeCloseTo(geometry.tangentRunoutFt + geometry.superelevationRunoffFt, 6);
  });
});
