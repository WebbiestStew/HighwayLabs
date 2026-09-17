export type TopologyId =
  | "diamond"
  | "parclo"
  | "spui"
  | "ddi"
  | "stack"
  | "turbine"
  | "frontage";

export interface SchematicPoint {
  x: number; // normalized 0-1
  y: number;
}

export interface SchematicNode extends SchematicPoint {
  label?: string;
}

/**
 * A road segment as a multi-point path (2+ points), rendered as a smooth
 * curve through them — not just a straight line between two endpoints.
 * Real interchange shapes (a loop ramp, a diamond's fanned ramp legs, a DDI's
 * crossover, a stack's flyover sweep) need intermediate control points to
 * read as the actual interchange type rather than an abstract node graph.
 */
export interface SchematicRoad {
  role: "mainline" | "ramp" | "weave" | "crossroad";
  points: SchematicPoint[];
}

export interface Topology {
  id: TopologyId;
  label: string;
  nodes: SchematicNode[]; // labeled anchor points only — not tied 1:1 to road endpoints
  roads: SchematicRoad[];
}

export const TOPOLOGIES: Record<TopologyId, Topology> = {
  diamond: {
    id: "diamond",
    label: "Conventional Diamond",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.03, label: "X-ROAD N" },
      { x: 0.5, y: 0.97, label: "X-ROAD S" },
    ],
    roads: [
      // The crossroad actually crosses the freeway (grade-separated) —
      // both continuous, uninterrupted straight lines through the center.
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      { role: "crossroad", points: [{ x: 0.5, y: 0.03 }, { x: 0.5, y: 0.97 }] },
      // Each ramp "tent" is two ramp legs sharing a gore near the crossroad
      // — one pair north of the freeway, one pair south — the shape this
      // traces out (mainline + two tents + crossroad) is what a diamond
      // interchange actually looks like from above.
      { role: "ramp", points: [{ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.28 }, { x: 0.7, y: 0.5 }] },
      { role: "ramp", points: [{ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.72 }, { x: 0.7, y: 0.5 }] },
    ],
  },
  parclo: {
    id: "parclo",
    label: "Partial Cloverleaf (Parclo A-4 / B-4)",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.03, label: "X-ROAD N" },
      { x: 0.5, y: 0.97, label: "X-ROAD S" },
      { x: 0.85, y: 0.28, label: "LOOP RAMP" },
    ],
    roads: [
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      { role: "crossroad", points: [{ x: 0.5, y: 0.03 }, { x: 0.5, y: 0.97 }] },
      // Direct diagonal ramp in one quadrant (the non-loop movement).
      { role: "ramp", points: [{ x: 0.3, y: 0.5 }, { x: 0.42, y: 0.34 }, { x: 0.5, y: 0.24 }] },
      // A real loop ramp in the diagonally-opposite quadrant: it bulges out
      // past the crossroad before curving back to meet it — a partial
      // cloverleaf's signature shape, only present in one quadrant (hence
      // "partial").
      {
        role: "ramp",
        points: [
          { x: 0.7, y: 0.5 },
          { x: 0.86, y: 0.42 },
          { x: 0.9, y: 0.22 },
          { x: 0.72, y: 0.14 },
          { x: 0.5, y: 0.16 },
        ],
      },
    ],
  },
  spui: {
    id: "spui",
    label: "Single-Point Urban Interchange",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.5, label: "SINGLE POINT" },
      { x: 0.13, y: 0.87, label: "X-ROAD W" },
      { x: 0.87, y: 0.13, label: "X-ROAD E" },
    ],
    roads: [
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      // Crossroad crosses the mainline at a shallow diagonal through the
      // single signalized point — the defining feature of a SPUI: both
      // ramp terminals are collapsed into this one intersection.
      { role: "crossroad", points: [{ x: 0.15, y: 0.85 }, { x: 0.5, y: 0.5 }, { x: 0.85, y: 0.15 }] },
      // Free-flow right-turn bypass ramps that curve from the mainline
      // around the signal to actually merge onto the crossroad (x+y=1
      // along its diagonal) rather than dangling in empty space.
      { role: "ramp", points: [{ x: 0.32, y: 0.5 }, { x: 0.15, y: 0.62 }, { x: 0.22, y: 0.78 }] },
      { role: "ramp", points: [{ x: 0.68, y: 0.5 }, { x: 0.85, y: 0.38 }, { x: 0.78, y: 0.22 }] },
    ],
  },
  ddi: {
    id: "ddi",
    label: "Diverging Diamond Interchange",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.03, label: "X-ROAD N" },
      { x: 0.5, y: 0.97, label: "X-ROAD S" },
      { x: 0.44, y: 0.36, label: "CROSSOVER 1" },
      { x: 0.44, y: 0.64, label: "CROSSOVER 2" },
    ],
    roads: [
      // Mainline passes straight through, grade-separated, unaffected by
      // the crossover maneuver happening on the crossroad crossing it.
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      // The crossroad's two directions swap sides at crossover 1 (north of
      // the freeway), run parallel-but-swapped straight across the freeway
      // crossing, then swap back at crossover 2 — the "bowtie" shape that
      // makes a DDI recognizable at a glance, and the reason opposing left
      // turns need no signal phase.
      {
        role: "crossroad",
        points: [
          { x: 0.44, y: 0.03 }, { x: 0.44, y: 0.36 },
          { x: 0.56, y: 0.42 }, { x: 0.56, y: 0.58 },
          { x: 0.44, y: 0.64 }, { x: 0.44, y: 0.97 },
        ],
      },
      {
        role: "crossroad",
        points: [
          { x: 0.56, y: 0.03 }, { x: 0.56, y: 0.36 },
          { x: 0.44, y: 0.42 }, { x: 0.44, y: 0.58 },
          { x: 0.56, y: 0.64 }, { x: 0.56, y: 0.97 },
        ],
      },
      // Ramp terminals coincide with the crossover points themselves.
      { role: "ramp", points: [{ x: 0.15, y: 0.5 }, { x: 0.44, y: 0.5 }] },
      { role: "ramp", points: [{ x: 0.85, y: 0.5 }, { x: 0.56, y: 0.5 }] },
    ],
  },
  stack: {
    id: "stack",
    label: "4-Level Directional Stack",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.05, label: "X-ROAD N" },
      { x: 0.5, y: 0.95, label: "X-ROAD S" },
    ],
    roads: [
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      { role: "crossroad", points: [{ x: 0.5, y: 0.05 }, { x: 0.5, y: 0.95 }] },
      // Four large sweeping flyover ramps, one per quadrant, at
      // large/gentle radii — the visual signature that distinguishes a
      // high-design stack from a tight-loop cloverleaf. Each is a distinct
      // directional movement stacked at its own level in reality.
      { role: "ramp", points: [{ x: 0.05, y: 0.5 }, { x: 0.22, y: 0.22 }, { x: 0.47, y: 0.06 }] },
      { role: "ramp", points: [{ x: 0.95, y: 0.5 }, { x: 0.78, y: 0.22 }, { x: 0.53, y: 0.06 }] },
      { role: "ramp", points: [{ x: 0.05, y: 0.5 }, { x: 0.22, y: 0.78 }, { x: 0.47, y: 0.94 }] },
      { role: "ramp", points: [{ x: 0.95, y: 0.5 }, { x: 0.78, y: 0.78 }, { x: 0.53, y: 0.94 }] },
    ],
  },
  turbine: {
    id: "turbine",
    label: "4-Way Directional Turbine",
    nodes: [
      { x: 0.02, y: 0.5, label: "MAINLINE W" },
      { x: 0.98, y: 0.5, label: "MAINLINE E" },
      { x: 0.5, y: 0.05, label: "X-ROAD N" },
      { x: 0.5, y: 0.95, label: "X-ROAD S" },
    ],
    roads: [
      { role: "mainline", points: [{ x: 0.02, y: 0.5 }, { x: 0.98, y: 0.5 }] },
      { role: "crossroad", points: [{ x: 0.5, y: 0.05 }, { x: 0.5, y: 0.95 }] },
      // Four DISTINCT ramps (deliberately not sharing endpoints — each
      // merges onto its approach at a different station, like real gores),
      // each bulging outward and curving the SAME rotational sense around
      // the center — a spiral/pinwheel pattern of 4 separate petals,
      // distinct from a stack's symmetric criss-crossing sweeps.
      { role: "ramp", points: [{ x: 0.22, y: 0.5 }, { x: 0.08, y: 0.22 }, { x: 0.4, y: 0.1 }] },
      { role: "ramp", points: [{ x: 0.6, y: 0.1 }, { x: 0.92, y: 0.22 }, { x: 0.9, y: 0.5 }] },
      { role: "ramp", points: [{ x: 0.78, y: 0.5 }, { x: 0.92, y: 0.78 }, { x: 0.6, y: 0.9 }] },
      { role: "ramp", points: [{ x: 0.4, y: 0.9 }, { x: 0.08, y: 0.78 }, { x: 0.1, y: 0.5 }] },
    ],
  },
  frontage: {
    id: "frontage",
    label: "TxDOT Frontage Road Corridor (w/ U-Turn)",
    nodes: [
      { x: 0.02, y: 0.25, label: "FREEWAY MAINLINE W" },
      { x: 0.98, y: 0.25, label: "FREEWAY MAINLINE E" },
      { x: 0.02, y: 0.6, label: "FRONTAGE W" },
      { x: 0.98, y: 0.6, label: "FRONTAGE E" },
      { x: 0.5, y: 0.85, label: "X-ROAD BRIDGE" },
    ],
    roads: [
      { role: "mainline", points: [{ x: 0.02, y: 0.25 }, { x: 0.98, y: 0.25 }] },
      { role: "crossroad", points: [{ x: 0.5, y: 0.95 }, { x: 0.5, y: 0.1 }] },
      { role: "ramp", points: [{ x: 0.02, y: 0.6 }, { x: 0.38, y: 0.6 }] },
      { role: "ramp", points: [{ x: 0.62, y: 0.6 }, { x: 0.98, y: 0.6 }] },
      // A Texas U-turn: frontage-road traffic loops back on itself just
      // short of the crossroad, via a wide bulb, to reach the other side
      // without the crossroad ever needing a left-turn phase.
      {
        role: "ramp",
        points: [
          { x: 0.36, y: 0.6 }, { x: 0.32, y: 0.82 }, { x: 0.2, y: 0.88 },
          { x: 0.1, y: 0.78 }, { x: 0.14, y: 0.62 }, { x: 0.02, y: 0.6 },
        ],
      },
      {
        role: "ramp",
        points: [
          { x: 0.64, y: 0.6 }, { x: 0.68, y: 0.82 }, { x: 0.8, y: 0.88 },
          { x: 0.9, y: 0.78 }, { x: 0.86, y: 0.62 }, { x: 0.98, y: 0.6 },
        ],
      },
    ],
  },
};
