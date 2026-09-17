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

export type TransitionType = "spiral" | "linear";

/**
 * For a spiraled curve, the spiral itself IS the transition — full
 * superelevation is reached exactly at SC (spiral-to-curve), so the whole
 * runoff length sits between TS and SC. A simple (unspiraled) curve has no
 * transition curve to run the superelevation over, so AASHTO's classic
 * guidance splits the runoff length Lr with roughly 2/3 on the tangent
 * (before PC) and 1/3 carried onto the curve past PC — the road is already
 * curving before the cross slope finishes rotating. This only changes where
 * the PC marker falls relative to full superelevation; slopesAtOffset's
 * cross-slope-vs-offset ramp is unaffected either way.
 */
export const TRANSITION_STAGES = (g: TransitionGeometry, transitionType: TransitionType = "spiral") => {
  const stages = [
    { label: "Normal Crown (NC)", x: -1 },
    { label: "Begin Tangent Runout (TS)", x: 0 },
    { label: "Adverse Crown Removed / Level Outer", x: g.tangentRunoutFt },
    {
      label: "Reverse Crown",
      x:
        g.tangentRunoutFt +
        g.superelevationRunoffFt * (Math.abs(g.eNCPercent) / Math.max(Math.abs(g.eDesignPercent), 0.01)),
    },
    {
      label: transitionType === "linear" ? "Full Superelevation (1/3 Lr Beyond PC)" : "Full Superelevation (SC)",
      x: g.tangentRunoutFt + g.superelevationRunoffFt,
    },
  ];
  if (transitionType === "linear") {
    stages.push({
      label: "Point of Curvature (PC) — 2/3 of Runoff Complete",
      x: g.tangentRunoutFt + g.superelevationRunoffFt * (2 / 3),
    });
  }
  return stages.sort((a, b) => a.x - b.x);
};
