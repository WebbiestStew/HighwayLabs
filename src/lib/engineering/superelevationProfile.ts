// Superelevation transition profile — centerline axis of rotation, right-hand
// curve convention (mirror for left-hand). Two pavement edges are tracked
// generically as "low-side" (inside of curve, monotonic rotation, no reversal)
// and "high-side" (outside of curve, passes through adverse-crown removal and
// reverse-crown before reaching full superelevation).

export interface TransitionGeometry {
  tangentRunoutFt: number;
  superelevationRunoffFt: number;
  eNCPercent: number; // stored negative, e.g. -2.0
  eDesignPercent: number; // positive magnitude
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** x measured in feet from TS (start of tangent runout), 0 .. Lt+Lr */
export function slopesAtOffset(x: number, g: TransitionGeometry) {
  const eNC = Math.abs(g.eNCPercent);
  const eD = Math.abs(g.eDesignPercent);
  const Lt = Math.max(g.tangentRunoutFt, 1e-6);
  const Lr = Math.max(g.superelevationRunoffFt, 1e-6);

  const lowSide = lerp(-eNC, -eD, x / (Lt + Lr));

  let highSide: number;
  if (x <= Lt) {
    highSide = lerp(-eNC, 0, x / Lt);
  } else {
    highSide = lerp(0, eD, (x - Lt) / Lr);
  }
  return { lowSidePercent: lowSide, highSidePercent: highSide };
}

export const TRANSITION_STAGES = (g: TransitionGeometry) => [
  { label: "Normal Crown (NC)", x: -1 },
  { label: "Begin Tangent Runout (TS)", x: 0 },
  { label: "Adverse Crown Removed / Level Outer", x: g.tangentRunoutFt },
  {
    label: "Reverse Crown",
    x:
      g.tangentRunoutFt +
      g.superelevationRunoffFt * (Math.abs(g.eNCPercent) / Math.max(Math.abs(g.eDesignPercent), 0.01)),
  },
  { label: "Full Superelevation (SC)", x: g.tangentRunoutFt + g.superelevationRunoffFt },
];
