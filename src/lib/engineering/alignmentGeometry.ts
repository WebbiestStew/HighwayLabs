// Full 3D horizontal + vertical + cross-slope alignment geometry generator.
// Shared by the 3D corridor viewer, DXF/LandXML export, and the sight-distance
// plan-view overlay, so all three stay numerically consistent with each other
// and with the Module 1 engineering ledger.
//
// Implementation approach: a single curvature function κ(s) is defined over
// the whole path (0 on tangents, linearly ramping on the clothoid spirals,
// constant 1/R on the circular arc) and integrated once via the standard 2D
// Frenet-Serret relations (dheading/ds = κ, dx/ds = cos(heading), dy/ds =
// sin(heading)). This is the same clothoid definition as the closed-form
// Fresnel-integral approach, but avoids error-prone manual stitching of
// separately-derived tangent/spiral/arc/spiral/tangent segments — continuity
// of position and heading across segment boundaries is automatic because
// κ(s) itself is continuous and the whole path is integrated in one pass.
//
// This module introduces one new input beyond the existing Module 1 engine:
// a central deflection angle Δ, which a radius alone does not determine
// (R defines curvature; a full curve additionally needs a length or angle).
// It is scoped to geometry/visualization/export — it does not change any of
// the superelevation engineering results in horizontal.ts.

import { slopesAtOffset, type TransitionGeometry } from "./superelevationProfile";

export interface AlignmentParams {
  curveRadiusFt: number;
  geometricSpiralLengthFt: number; // clothoid length of each spiral (entry = exit)
  deflectionAngleDeg: number; // total central angle Δ
  turnDirection: "left" | "right";
  crossSlope: TransitionGeometry; // tangentRunoutFt / superelevationRunoffFt / eNCPercent / eDesignPercent
  leadTangentFt: number; // straight run shown before TS and after ST
  pavementWidthFt: number; // distance from centerline to each edge of pavement
  shoulderWidthFt: number;
  startElevationFt: number;
  gradePercent: number; // constant grade applied along the whole shown length, for Z only
  startStationFt: number;
}

export interface AlignmentPoint {
  arcLengthFt: number; // measured from TS (negative = on the lead-in tangent)
  stationFt: number;
  x: number;
  y: number;
  z: number;
  headingRad: number;
  lowSidePercent: number;
  highSidePercent: number;
}

export interface AlignmentResult {
  points: AlignmentPoint[];
  tsArcLength: number;
  scArcLength: number;
  csArcLength: number;
  stArcLength: number;
  totalCurveLengthFt: number; // TS to ST
  circularArcLengthFt: number;
  entrySpiralAngleRad: number;
  /** Circle center in the same local XY frame as `points`, for reference/QA. */
  centerX: number;
  centerY: number;
}

function curvatureAt(s: number, Ls: number, La: number, R: number): number {
  if (Ls <= 0) return 0; // zero deflection: no curve at all, stay straight
  const totalCurve = 2 * Ls + La;
  if (s < 0 || s > totalCurve) return 0; // tangents
  if (s <= Ls) return s / (R * Ls); // entry spiral: 0 -> 1/R
  if (s <= Ls + La) return 1 / R; // circular arc
  const sExit = s - (Ls + La); // 0..Ls on the exit spiral
  return (Ls - sExit) / (R * Ls); // 1/R -> 0
}

/**
 * When the requested deflection is too small for two full-length spirals to
 * meet (circularArcLengthFt clamps to 0), ramping curvature over the fixed Ls
 * on both sides would overshoot 1/R at the PI and bulge past the actual
 * deflection before curving back. Real spiral-only curves solve this by
 * shortening the spiral so its angle is exactly half the deflection
 * (Ls' = R * deflection), meeting at the PI with zero overshoot.
 */
function effectiveSpiralLengthFt(Ls: number, deflectionRad: number, R: number): number {
  const neededForFullSpirals = 2 * (Ls / (2 * R)); // = 2 * entrySpiralAngleRad at full Ls
  if (deflectionRad >= neededForFullSpirals) return Ls;
  return R * deflectionRad;
}

export function computeAlignmentGeometry(params: AlignmentParams): AlignmentResult {
  const {
    curveRadiusFt: R,
    geometricSpiralLengthFt: LsRaw,
    deflectionAngleDeg,
    turnDirection,
    crossSlope,
    leadTangentFt,
    startElevationFt,
    gradePercent,
    startStationFt,
  } = params;

  const LsFull = Math.max(LsRaw, 1);
  const Rsafe = Math.max(R, 1);
  const deflectionRad = (Math.abs(deflectionAngleDeg) * Math.PI) / 180;
  const Ls = effectiveSpiralLengthFt(LsFull, deflectionRad, Rsafe);
  const entrySpiralAngleRad = Ls / (2 * Rsafe); // = Ls^2 / (2A^2), A = spiral parameter
  const circularAngleRad = Math.max(0, deflectionRad - 2 * entrySpiralAngleRad);
  const circularArcLengthFt = Rsafe * circularAngleRad;

  const tsArcLength = 0;
  const scArcLength = Ls;
  const csArcLength = Ls + circularArcLengthFt;
  const stArcLength = 2 * Ls + circularArcLengthFt;
  const totalCurveLengthFt = stArcLength;

  const sign = turnDirection === "right" ? -1 : 1;
  const sStart = -leadTangentFt;
  const sEnd = totalCurveLengthFt + leadTangentFt;

  // Sample density: fine on the spirals/arc (where curvature changes matter
  // for visual smoothness), coarser on the straight tangents. The spiral is
  // the shortest curvature-varying feature, so the step must resolve it
  // (several samples across Ls) or a fixed-size RK2 step can straddle the
  // whole spiral in one hop and overshoot the target heading. Capped so a
  // degenerate near-zero spiral (e.g. Δ ≈ 0) can't blow up the step count.
  const stepFt = Math.min(5, Math.max(Ls / 10, 0.5));
  const totalSteps = Math.min(20000, Math.max(4, Math.ceil((sEnd - sStart) / stepFt)));

  function crossSlopeAt(arcLength: number) {
    const transitionLen = crossSlope.tangentRunoutFt + crossSlope.superelevationRunoffFt;
    if (arcLength >= 0 && arcLength <= transitionLen) {
      return slopesAtOffset(arcLength, crossSlope);
    }
    const mirrored = totalCurveLengthFt - arcLength;
    if (mirrored >= 0 && mirrored <= transitionLen) {
      return slopesAtOffset(mirrored, crossSlope);
    }
    if (arcLength < 0 || arcLength > totalCurveLengthFt) {
      const eNC = Math.abs(crossSlope.eNCPercent);
      return { lowSidePercent: -eNC, highSidePercent: -eNC };
    }
    const eD = Math.abs(crossSlope.eDesignPercent);
    return { lowSidePercent: -eD, highSidePercent: eD };
  }

  const points: AlignmentPoint[] = [];
  let s = sStart;
  let x = 0;
  let y = 0;
  let heading = 0;
  const h = (sEnd - sStart) / totalSteps;

  const emit = (arcLength: number) => {
    const cs = crossSlopeAt(arcLength);
    points.push({
      arcLengthFt: arcLength,
      stationFt: startStationFt + arcLength,
      x,
      y,
      z: startElevationFt + (gradePercent / 100) * arcLength,
      headingRad: heading,
      lowSidePercent: cs.lowSidePercent,
      highSidePercent: cs.highSidePercent,
    });
  };

  emit(s);
  // RK2 (midpoint) integration of the Frenet-Serret equations — accurate
  // enough for visualization/export at this step size, and simple.
  for (let i = 0; i < totalSteps; i++) {
    const kappaMid = sign * curvatureAt(s + h / 2, Ls, circularArcLengthFt, Rsafe);
    const headingMid = heading + kappaMid * (h / 2);
    x += Math.cos(headingMid) * h;
    y += Math.sin(headingMid) * h;
    heading += kappaMid * h;
    s += h;
    emit(s);
  }

  // Circle center: perpendicular to the heading at SC, offset by R toward the turn side.
  const scPoint = points.find((p) => p.arcLengthFt >= scArcLength) ?? points[points.length - 1];
  const centerX = scPoint.x - sign * Rsafe * Math.sin(scPoint.headingRad);
  const centerY = scPoint.y + sign * Rsafe * Math.cos(scPoint.headingRad);

  return {
    points,
    tsArcLength,
    scArcLength,
    csArcLength,
    stArcLength,
    totalCurveLengthFt,
    circularArcLengthFt,
    entrySpiralAngleRad,
    centerX,
    centerY,
  };
}

/**
 * Superelevation banks the road so the INSIDE of the curve (the side nearer
 * the circle center) is the low side and the outside is the high side — the
 * cross-slope model in superelevationProfile.ts only knows "low"/"high", not
 * left/right, so this is the single place that maps inside/outside onto
 * physical left/right, shared by the 3D viewer, DXF/LandXML export, and the
 * sight-distance overlay so they can never disagree with each other.
 */
export function edgeSlopePercents(
  p: AlignmentPoint,
  turnDirection: "left" | "right"
): { leftPercent: number; rightPercent: number } {
  const rightIsInside = turnDirection === "right";
  return rightIsInside
    ? { rightPercent: p.lowSidePercent, leftPercent: p.highSidePercent }
    : { rightPercent: p.highSidePercent, leftPercent: p.lowSidePercent };
}

/**
 * A point laterally offset from the centerline by `lateralOffsetFt` (positive
 * = left of the direction of travel, negative = right), with z adjusted for
 * the cross-slope at that offset (centerline axis of rotation).
 */
export function offsetPoint(
  p: AlignmentPoint,
  lateralOffsetFt: number,
  turnDirection: "left" | "right"
): { x: number; y: number; z: number } {
  const { leftPercent, rightPercent } = edgeSlopePercents(p, turnDirection);
  const slopePercent = lateralOffsetFt >= 0 ? leftPercent : rightPercent;
  return {
    x: p.x - Math.sin(p.headingRad) * lateralOffsetFt,
    y: p.y + Math.cos(p.headingRad) * lateralOffsetFt,
    z: p.z + (slopePercent / 100) * Math.abs(lateralOffsetFt),
  };
}
