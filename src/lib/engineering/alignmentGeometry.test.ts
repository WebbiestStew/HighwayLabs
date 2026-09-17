import { describe, it, expect } from "vitest";
import { computeAlignmentGeometry, edgeSlopePercents, offsetPoint, type AlignmentParams } from "./alignmentGeometry";

const baseParams: AlignmentParams = {
  curveRadiusFt: 1500,
  geometricSpiralLengthFt: 200,
  deflectionAngleDeg: 40,
  turnDirection: "right",
  crossSlope: { tangentRunoutFt: 100, superelevationRunoffFt: 250, eNCPercent: -2, eDesignPercent: 6 },
  leadTangentFt: 300,
  pavementWidthFt: 24,
  shoulderWidthFt: 10,
  startElevationFt: 600,
  gradePercent: -1,
  startStationFt: 10000,
};

describe("computeAlignmentGeometry — basic continuity", () => {
  it("places the local origin at the start of the lead-in tangent, with TS reached after leadTangentFt of straight, zero-heading travel", () => {
    const result = computeAlignmentGeometry(baseParams);
    const origin = result.points[0];
    expect(origin.arcLengthFt).toBeCloseTo(-baseParams.leadTangentFt, 1);
    expect(origin.x).toBeCloseTo(0, 4);
    expect(origin.y).toBeCloseTo(0, 4);
    expect(origin.headingRad).toBeCloseTo(0, 4);

    const ts = result.points.reduce((closest, p) => (Math.abs(p.arcLengthFt) < Math.abs(closest.arcLengthFt) ? p : closest));
    expect(Math.abs(ts.arcLengthFt)).toBeLessThan(1);
    expect(ts.x).toBeCloseTo(baseParams.leadTangentFt, 0);
    expect(ts.y).toBeCloseTo(0, 1);
    expect(ts.headingRad).toBeCloseTo(0, 2);
  });

  it("produces no large jumps between consecutive samples (continuous path)", () => {
    const result = computeAlignmentGeometry(baseParams);
    for (let i = 1; i < result.points.length; i++) {
      const a = result.points[i - 1];
      const b = result.points[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const dArc = b.arcLengthFt - a.arcLengthFt;
      // Chord length should always be <= arc-length step (never a teleport).
      expect(dist).toBeLessThanOrEqual(dArc + 0.05);
    }
  });

  it("total heading change from TS to ST matches the requested deflection angle", () => {
    const result = computeAlignmentGeometry(baseParams);
    const ts = result.points.reduce((closest, p) => (Math.abs(p.arcLengthFt) < Math.abs(closest.arcLengthFt) ? p : closest));
    const st = result.points.reduce((closest, p) =>
      Math.abs(p.arcLengthFt - result.stArcLength) < Math.abs(closest.arcLengthFt - result.stArcLength) ? p : closest
    );
    const totalTurnDeg = (Math.abs(st.headingRad - ts.headingRad) * 180) / Math.PI;
    expect(totalTurnDeg).toBeCloseTo(baseParams.deflectionAngleDeg, 0);
  });

  it("a zero-deflection alignment stays a straight line along the local x-axis", () => {
    const result = computeAlignmentGeometry({ ...baseParams, deflectionAngleDeg: 0 });
    for (const p of result.points) {
      expect(p.y).toBeCloseTo(0, 6);
      expect(p.headingRad).toBeCloseTo(0, 6);
    }
  });

  it("a right-hand turn curves toward negative Y; a left-hand turn toward positive Y", () => {
    const right = computeAlignmentGeometry({ ...baseParams, turnDirection: "right" });
    const left = computeAlignmentGeometry({ ...baseParams, turnDirection: "left" });
    const rightEnd = right.points[right.points.length - 1];
    const leftEnd = left.points[left.points.length - 1];
    expect(rightEnd.y).toBeLessThan(0);
    expect(leftEnd.y).toBeGreaterThan(0);
  });
});

describe("computeAlignmentGeometry — circular arc geometry", () => {
  it("points on the circular arc sit at radius R from the derived circle center", () => {
    const result = computeAlignmentGeometry(baseParams);
    const midArc = (result.scArcLength + result.csArcLength) / 2;
    const onArc = result.points.reduce((closest, p) =>
      Math.abs(p.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? p : closest
    );
    const distFromCenter = Math.hypot(onArc.x - result.centerX, onArc.y - result.centerY);
    expect(distFromCenter).toBeCloseTo(baseParams.curveRadiusFt, 0);
  });

  it("circular arc length equals R * (deflection - 2*entrySpiralAngle)", () => {
    const result = computeAlignmentGeometry(baseParams);
    const expected = baseParams.curveRadiusFt * ((baseParams.deflectionAngleDeg * Math.PI) / 180 - 2 * result.entrySpiralAngleRad);
    expect(result.circularArcLengthFt).toBeCloseTo(expected, 1);
  });

  it("clamps circular arc length to zero when the deflection is too small for the spirals alone", () => {
    const result = computeAlignmentGeometry({ ...baseParams, deflectionAngleDeg: 1, geometricSpiralLengthFt: 400 });
    expect(result.circularArcLengthFt).toBe(0);
  });

  it("a spiral-only curve (deflection too small for two full spirals) does not overshoot the deflection mid-curve", () => {
    // With no scaling-back, curvature would ramp toward 1/R over the full
    // fixed spiral length regardless of how small the deflection is, making
    // the heading peak well past the requested 1 degree before easing back.
    const result = computeAlignmentGeometry({ ...baseParams, deflectionAngleDeg: 1, geometricSpiralLengthFt: 400 });
    const deflectionRad = (1 * Math.PI) / 180;
    for (const p of result.points) {
      expect(Math.abs(p.headingRad)).toBeLessThanOrEqual(deflectionRad + 1e-6);
    }
  });
});

describe("computeAlignmentGeometry — cross slope integration", () => {
  it("normal crown on the lead-in tangent, full superelevation mid-arc, mirrored back to normal crown on the trailing tangent", () => {
    const result = computeAlignmentGeometry(baseParams);
    const leadIn = result.points.find((p) => p.arcLengthFt <= -baseParams.leadTangentFt + 1)!;
    expect(leadIn.lowSidePercent).toBeCloseTo(-2, 3);
    expect(leadIn.highSidePercent).toBeCloseTo(-2, 3);

    const midArc = (result.scArcLength + result.csArcLength) / 2;
    const mid = result.points.reduce((closest, p) => (Math.abs(p.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? p : closest));
    expect(mid.lowSidePercent).toBeCloseTo(-6, 3);
    expect(mid.highSidePercent).toBeCloseTo(6, 3);

    const trailOut = result.points[result.points.length - 1];
    expect(trailOut.lowSidePercent).toBeCloseTo(-2, 3);
    expect(trailOut.highSidePercent).toBeCloseTo(-2, 3);
  });
});

describe("edgeSlopePercents / offsetPoint — inside-of-curve is always the low side", () => {
  it("for a right turn, the right edge is the low (inside) side and the left edge is the high (outside) side", () => {
    const result = computeAlignmentGeometry(baseParams);
    const midArc = (result.scArcLength + result.csArcLength) / 2;
    const mid = result.points.reduce((closest, p) => (Math.abs(p.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? p : closest));
    const { leftPercent, rightPercent } = edgeSlopePercents(mid, "right");
    expect(rightPercent).toBeCloseTo(mid.lowSidePercent, 6);
    expect(leftPercent).toBeCloseTo(mid.highSidePercent, 6);

    const halfWidth = baseParams.pavementWidthFt / 2;
    const rightEdge = offsetPoint(mid, -halfWidth, "right");
    const leftEdge = offsetPoint(mid, halfWidth, "right");
    expect(rightEdge.z).toBeLessThan(mid.z); // inside edge dips below centerline
    expect(leftEdge.z).toBeGreaterThan(mid.z); // outside edge rises above centerline
  });

  it("for a left turn, the mapping flips: the left edge becomes the low (inside) side", () => {
    const result = computeAlignmentGeometry({ ...baseParams, turnDirection: "left" });
    const midArc = (result.scArcLength + result.csArcLength) / 2;
    const mid = result.points.reduce((closest, p) => (Math.abs(p.arcLengthFt - midArc) < Math.abs(closest.arcLengthFt - midArc) ? p : closest));
    const { leftPercent, rightPercent } = edgeSlopePercents(mid, "left");
    expect(leftPercent).toBeCloseTo(mid.lowSidePercent, 6);
    expect(rightPercent).toBeCloseTo(mid.highSidePercent, 6);
  });

  it("offsetPoint places edges perpendicular to the direction of travel at the requested lateral distance", () => {
    const result = computeAlignmentGeometry(baseParams);
    const origin = result.points[0]; // on the lead tangent, heading = 0
    const left = offsetPoint(origin, 10, "right");
    const right = offsetPoint(origin, -10, "right");
    expect(left.x).toBeCloseTo(origin.x, 4);
    expect(left.y).toBeCloseTo(origin.y + 10, 4);
    expect(right.y).toBeCloseTo(origin.y - 10, 4);
  });
});

describe("computeAlignmentGeometry — elevation", () => {
  it("applies the constant grade linearly from the start elevation", () => {
    const result = computeAlignmentGeometry(baseParams);
    for (const p of result.points) {
      const expected = baseParams.startElevationFt + (baseParams.gradePercent / 100) * p.arcLengthFt;
      expect(p.z).toBeCloseTo(expected, 4);
    }
  });

  it("station tracks arc-length offset from the given start station", () => {
    const result = computeAlignmentGeometry(baseParams);
    for (const p of result.points) {
      expect(p.stationFt).toBeCloseTo(baseParams.startStationFt + p.arcLengthFt, 6);
    }
  });
});
