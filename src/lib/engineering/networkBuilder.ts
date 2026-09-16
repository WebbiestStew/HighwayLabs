import type { TopologyId } from "./interchangeTopologies";

export type RoadType = "freeway" | "arterial" | "ramp" | "local";

export const ROAD_TYPE_SPECS: Record<
  RoadType,
  { label: string; lanes: number; laneWidthFt: number; color: string; costPerMile: number }
> = {
  freeway: { label: "Freeway Mainline", lanes: 4, laneWidthFt: 12, color: "#22d3ee", costPerMile: 25_000_000 },
  arterial: { label: "Arterial", lanes: 4, laneWidthFt: 12, color: "#f59e0b", costPerMile: 8_000_000 },
  ramp: { label: "Ramp / Connector", lanes: 1, laneWidthFt: 14, color: "#10b981", costPerMile: 14_000_000 },
  local: { label: "Local / Frontage", lanes: 2, laneWidthFt: 11, color: "#838a97", costPerMile: 3_500_000 },
};

export interface NetNode {
  id: string;
  x: number; // world feet
  y: number;
}
export interface NetSegment {
  id: string;
  a: string; // node id
  b: string; // node id
  type: RoadType;
}
export interface PlacedStamp {
  id: string;
  topologyId: TopologyId;
  x: number;
  y: number;
  footprintFt: number;
  rotationDeg: number;
}

export interface NetworkState {
  nodes: NetNode[];
  segments: NetSegment[];
  stamps: PlacedStamp[];
}

export const EMPTY_NETWORK: NetworkState = { nodes: [], segments: [], stamps: [] };

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Find an existing node within snapRadiusFt, else null. */
export function findNearbyNode(nodes: NetNode[], x: number, y: number, snapRadiusFt: number): NetNode | null {
  let best: NetNode | null = null;
  let bestD = snapRadiusFt;
  for (const n of nodes) {
    const d = dist(n.x, n.y, x, y);
    if (d <= bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function snapToGrid(v: number, gridFt: number): number {
  return Math.round(v / gridFt) * gridFt;
}

/** Add a road segment between two world points, reusing nearby nodes or creating new ones. */
export function addSegment(
  state: NetworkState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: RoadType,
  snapRadiusFt: number
): NetworkState {
  if (dist(x1, y1, x2, y2) < 1) return state;
  const nodes = [...state.nodes];

  const resolve = (x: number, y: number): NetNode => {
    const existing = findNearbyNode(nodes, x, y, snapRadiusFt);
    if (existing) return existing;
    const n: NetNode = { id: uid("n"), x, y };
    nodes.push(n);
    return n;
  };

  const nodeA = resolve(x1, y1);
  const nodeB = resolve(x2, y2);
  if (nodeA.id === nodeB.id) return state;

  const seg: NetSegment = { id: uid("s"), a: nodeA.id, b: nodeB.id, type };
  return { ...state, nodes, segments: [...state.segments, seg] };
}

export function removeSegment(state: NetworkState, segmentId: string): NetworkState {
  const segments = state.segments.filter((s) => s.id !== segmentId);
  const usedNodeIds = new Set(segments.flatMap((s) => [s.a, s.b]));
  const nodes = state.nodes.filter((n) => usedNodeIds.has(n.id));
  return { ...state, segments, nodes };
}

export function removeStamp(state: NetworkState, stampId: string): NetworkState {
  return { ...state, stamps: state.stamps.filter((s) => s.id !== stampId) };
}

export function addStamp(state: NetworkState, stamp: PlacedStamp): NetworkState {
  return { ...state, stamps: [...state.stamps, stamp] };
}

/** Perpendicular distance from point to segment, for hit-testing. */
export function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return dist(px, py, projX, projY);
}

export interface NetworkStats {
  totalMilesByType: Record<RoadType, number>;
  totalMiles: number;
  nodeCount: number;
  intersectionCount: number;
  interchangeStampCount: number;
  estimatedCost: number;
}

export function computeNetworkStats(state: NetworkState): NetworkStats {
  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
  const totalMilesByType: Record<RoadType, number> = { freeway: 0, arterial: 0, ramp: 0, local: 0 };
  let estimatedCost = 0;

  for (const seg of state.segments) {
    const a = nodeMap.get(seg.a);
    const b = nodeMap.get(seg.b);
    if (!a || !b) continue;
    const lengthFt = dist(a.x, a.y, b.x, b.y);
    const miles = lengthFt / 5280;
    totalMilesByType[seg.type] += miles;
    estimatedCost += miles * ROAD_TYPE_SPECS[seg.type].costPerMile;
  }

  const degree = new Map<string, number>();
  for (const seg of state.segments) {
    degree.set(seg.a, (degree.get(seg.a) ?? 0) + 1);
    degree.set(seg.b, (degree.get(seg.b) ?? 0) + 1);
  }
  const intersectionCount = Array.from(degree.values()).filter((d) => d >= 3).length;

  const totalMiles = Object.values(totalMilesByType).reduce((s, v) => s + v, 0);
  estimatedCost += state.stamps.length * 45_000_000; // representative interchange structure allowance

  return {
    totalMilesByType,
    totalMiles,
    nodeCount: state.nodes.length,
    intersectionCount,
    interchangeStampCount: state.stamps.length,
    estimatedCost,
  };
}

const STORAGE_KEY = "highwaylab.networkBuilder.v1";

export function saveNetworkToLocalStorage(state: NetworkState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — silently skip persistence
  }
}
export function loadNetworkFromLocalStorage(): NetworkState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkState;
  } catch {
    return null;
  }
}
