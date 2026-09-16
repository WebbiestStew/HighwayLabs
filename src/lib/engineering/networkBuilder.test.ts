import { describe, it, expect } from "vitest";
import {
  EMPTY_NETWORK,
  addSegment,
  removeSegment,
  computeNetworkStats,
  findNearbyNode,
  pointToSegmentDistance,
} from "./networkBuilder";

describe("addSegment", () => {
  it("creates two nodes and one segment for a fresh network", () => {
    const next = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    expect(next.nodes.length).toBe(2);
    expect(next.segments.length).toBe(1);
  });

  it("reuses an existing node within snap radius instead of duplicating it", () => {
    const first = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    const second = addSegment(first, 1005, 3, 2000, 0, "arterial", 20);
    expect(second.nodes.length).toBe(3); // shared endpoint + one new
    expect(second.segments.length).toBe(2);
  });

  it("refuses to create a degenerate zero-length segment", () => {
    const next = addSegment(EMPTY_NETWORK, 100, 100, 100.1, 100, "local", 20);
    expect(next.segments.length).toBe(0);
  });
});

describe("removeSegment", () => {
  it("also removes orphaned nodes no longer referenced by any segment", () => {
    const withSeg = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    const segId = withSeg.segments[0].id;
    const after = removeSegment(withSeg, segId);
    expect(after.segments.length).toBe(0);
    expect(after.nodes.length).toBe(0);
  });

  it("keeps a shared node alive if another segment still references it", () => {
    const first = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    const second = addSegment(first, 1000, 0, 2000, 0, "freeway", 20);
    const after = removeSegment(second, second.segments[0].id);
    expect(after.nodes.length).toBe(2); // the shared node + the far end of segment 2
  });
});

describe("computeNetworkStats", () => {
  it("computes mileage from feet correctly (5280 ft = 1 mi)", () => {
    const net = addSegment(EMPTY_NETWORK, 0, 0, 5280, 0, "freeway", 20);
    const stats = computeNetworkStats(net);
    expect(stats.totalMilesByType.freeway).toBeCloseTo(1, 4);
  });

  it("counts an intersection only when 3+ segments meet at a node", () => {
    let net = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    net = addSegment(net, 1000, 0, 2000, 0, "freeway", 20);
    expect(computeNetworkStats(net).intersectionCount).toBe(0); // straight-through, degree 2
    net = addSegment(net, 1000, 0, 1000, 1000, "arterial", 20);
    expect(computeNetworkStats(net).intersectionCount).toBe(1);
  });
});

describe("geometry helpers", () => {
  it("findNearbyNode respects the snap radius", () => {
    const net = addSegment(EMPTY_NETWORK, 0, 0, 1000, 0, "freeway", 20);
    expect(findNearbyNode(net.nodes, 15, 0, 20)).not.toBeNull();
    expect(findNearbyNode(net.nodes, 100, 0, 20)).toBeNull();
  });

  it("pointToSegmentDistance returns 0 for a point on the segment", () => {
    expect(pointToSegmentDistance(500, 0, 0, 0, 1000, 0)).toBeCloseTo(0, 6);
  });

  it("pointToSegmentDistance returns perpendicular distance off the segment", () => {
    expect(pointToSegmentDistance(500, 50, 0, 0, 1000, 0)).toBeCloseTo(50, 6);
  });
});
