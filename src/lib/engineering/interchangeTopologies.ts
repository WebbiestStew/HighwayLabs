export type TopologyId =
  | "diamond"
  | "parclo"
  | "spui"
  | "ddi"
  | "stack"
  | "turbine"
  | "frontage";

export interface SchematicNode {
  id: string;
  x: number; // normalized 0-1
  y: number;
  label?: string;
}
export interface SchematicLink {
  from: string;
  to: string;
  role: "mainline" | "ramp" | "weave" | "crossroad";
}
export interface Topology {
  id: TopologyId;
  label: string;
  nodes: SchematicNode[];
  links: SchematicLink[];
}

export const TOPOLOGIES: Record<TopologyId, Topology> = {
  diamond: {
    id: "diamond",
    label: "Conventional Diamond",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.5, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.5, label: "MAINLINE E" },
      { id: "n1", x: 0.38, y: 0.5 },
      { id: "n2", x: 0.62, y: 0.5 },
      { id: "xr_n1", x: 0.38, y: 0.12, label: "N RAMP TERM." },
      { id: "xr_n2", x: 0.62, y: 0.12, label: "N RAMP TERM." },
      { id: "cr_w", x: 0.05, y: 0.12, label: "X-ROAD W" },
      { id: "cr_e", x: 0.95, y: 0.12, label: "X-ROAD E" },
    ],
    links: [
      { from: "ml_w", to: "n1", role: "mainline" },
      { from: "n1", to: "n2", role: "mainline" },
      { from: "n2", to: "ml_e", role: "mainline" },
      { from: "n1", to: "xr_n1", role: "ramp" },
      { from: "n2", to: "xr_n2", role: "ramp" },
      { from: "cr_w", to: "xr_n1", role: "crossroad" },
      { from: "xr_n1", to: "xr_n2", role: "crossroad" },
      { from: "xr_n2", to: "cr_e", role: "crossroad" },
    ],
  },
  parclo: {
    id: "parclo",
    label: "Partial Cloverleaf (Parclo A-4 / B-4)",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.55, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.55, label: "MAINLINE E" },
      { id: "n1", x: 0.38, y: 0.55 },
      { id: "n2", x: 0.62, y: 0.55 },
      { id: "loop1", x: 0.3, y: 0.85, label: "LOOP RAMP" },
      { id: "loop2", x: 0.7, y: 0.2, label: "LOOP RAMP" },
      { id: "cr_w", x: 0.05, y: 0.15, label: "X-ROAD W" },
      { id: "cr_e", x: 0.95, y: 0.15, label: "X-ROAD E" },
      { id: "xr", x: 0.5, y: 0.15, label: "X-ROAD" },
    ],
    links: [
      { from: "ml_w", to: "n1", role: "mainline" },
      { from: "n1", to: "n2", role: "mainline" },
      { from: "n2", to: "ml_e", role: "mainline" },
      { from: "n1", to: "loop1", role: "ramp" },
      { from: "loop1", to: "xr", role: "ramp" },
      { from: "n2", to: "loop2", role: "ramp" },
      { from: "loop2", to: "xr", role: "ramp" },
      { from: "cr_w", to: "xr", role: "crossroad" },
      { from: "xr", to: "cr_e", role: "crossroad" },
    ],
  },
  spui: {
    id: "spui",
    label: "Single-Point Urban Interchange",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.55, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.55, label: "MAINLINE E" },
      { id: "sp", x: 0.5, y: 0.5, label: "SINGLE POINT" },
      { id: "cr_w", x: 0.05, y: 0.1, label: "X-ROAD W" },
      { id: "cr_e", x: 0.95, y: 0.1, label: "X-ROAD E" },
    ],
    links: [
      { from: "ml_w", to: "sp", role: "mainline" },
      { from: "sp", to: "ml_e", role: "mainline" },
      { from: "cr_w", to: "sp", role: "crossroad" },
      { from: "sp", to: "cr_e", role: "crossroad" },
      { from: "ml_w", to: "cr_e", role: "ramp" },
      { from: "ml_e", to: "cr_w", role: "ramp" },
    ],
  },
  ddi: {
    id: "ddi",
    label: "Diverging Diamond Interchange",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.5, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.5, label: "MAINLINE E" },
      { id: "x1", x: 0.35, y: 0.35, label: "CROSSOVER 1" },
      { id: "x2", x: 0.65, y: 0.65, label: "CROSSOVER 2" },
      { id: "cr_w", x: 0.05, y: 0.12, label: "X-ROAD W" },
      { id: "cr_e", x: 0.95, y: 0.12, label: "X-ROAD E" },
    ],
    links: [
      { from: "ml_w", to: "x1", role: "mainline" },
      { from: "x1", to: "x2", role: "crossroad" },
      { from: "x2", to: "ml_e", role: "mainline" },
      { from: "cr_w", to: "x1", role: "crossroad" },
      { from: "x2", to: "cr_e", role: "crossroad" },
      { from: "x1", to: "cr_e", role: "ramp" },
      { from: "x2", to: "cr_w", role: "ramp" },
    ],
  },
  stack: {
    id: "stack",
    label: "4-Level Directional Stack",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.5, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.5, label: "MAINLINE E" },
      { id: "cr_s", x: 0.5, y: 0.95, label: "X-ROAD S" },
      { id: "cr_n", x: 0.5, y: 0.05, label: "X-ROAD N" },
      { id: "core", x: 0.5, y: 0.5, label: "STACK CORE" },
      { id: "fly1", x: 0.3, y: 0.25, label: "FLYOVER" },
      { id: "fly2", x: 0.7, y: 0.75, label: "FLYOVER" },
    ],
    links: [
      { from: "ml_w", to: "core", role: "mainline" },
      { from: "core", to: "ml_e", role: "mainline" },
      { from: "cr_s", to: "core", role: "crossroad" },
      { from: "core", to: "cr_n", role: "crossroad" },
      { from: "ml_w", to: "fly1", role: "ramp" },
      { from: "fly1", to: "cr_n", role: "ramp" },
      { from: "cr_s", to: "fly2", role: "ramp" },
      { from: "fly2", to: "ml_e", role: "ramp" },
    ],
  },
  turbine: {
    id: "turbine",
    label: "4-Way Directional Turbine",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.5, label: "MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.5, label: "MAINLINE E" },
      { id: "cr_s", x: 0.5, y: 0.95, label: "X-ROAD S" },
      { id: "cr_n", x: 0.5, y: 0.05, label: "X-ROAD N" },
      { id: "core", x: 0.5, y: 0.5, label: "TURBINE CORE" },
      { id: "sw1", x: 0.28, y: 0.28 },
      { id: "sw2", x: 0.72, y: 0.28 },
      { id: "sw3", x: 0.72, y: 0.72 },
      { id: "sw4", x: 0.28, y: 0.72 },
    ],
    links: [
      { from: "ml_w", to: "core", role: "mainline" },
      { from: "core", to: "ml_e", role: "mainline" },
      { from: "cr_s", to: "core", role: "crossroad" },
      { from: "core", to: "cr_n", role: "crossroad" },
      { from: "core", to: "sw1", role: "ramp" },
      { from: "core", to: "sw2", role: "ramp" },
      { from: "core", to: "sw3", role: "ramp" },
      { from: "core", to: "sw4", role: "ramp" },
    ],
  },
  frontage: {
    id: "frontage",
    label: "TxDOT Frontage Road Corridor (w/ U-Turn)",
    nodes: [
      { id: "ml_w", x: 0.02, y: 0.4, label: "FREEWAY MAINLINE W" },
      { id: "ml_e", x: 0.98, y: 0.4, label: "FREEWAY MAINLINE E" },
      { id: "fr_w", x: 0.02, y: 0.75, label: "FRONTAGE W" },
      { id: "fr_e", x: 0.98, y: 0.75, label: "FRONTAGE E" },
      { id: "uturn1", x: 0.3, y: 0.9, label: "TEXAS U-TURN" },
      { id: "uturn2", x: 0.7, y: 0.9, label: "TEXAS U-TURN" },
      { id: "xr", x: 0.5, y: 0.75, label: "X-ROAD BRIDGE" },
    ],
    links: [
      { from: "ml_w", to: "ml_e", role: "mainline" },
      { from: "fr_w", to: "xr", role: "crossroad" },
      { from: "xr", to: "fr_e", role: "crossroad" },
      { from: "fr_w", to: "uturn1", role: "ramp" },
      { from: "uturn1", to: "fr_e", role: "ramp" },
      { from: "fr_e", to: "uturn2", role: "ramp" },
      { from: "uturn2", to: "fr_w", role: "ramp" },
    ],
  },
};
