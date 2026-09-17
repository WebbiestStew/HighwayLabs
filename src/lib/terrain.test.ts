import { describe, it, expect, vi, afterEach } from "vitest";
import {
  haversineDistanceFt,
  pathLengthFt,
  pointAlongPath,
  resamplePath,
  geoJsonToPath,
  fetchElevationsFt,
  buildTerrainProfile,
  terrainElevationAt,
  type LatLng,
} from "./terrain";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("haversineDistanceFt", () => {
  it("is zero for identical points", () => {
    expect(haversineDistanceFt({ lat: 30, lng: -97 }, { lat: 30, lng: -97 })).toBeCloseTo(0, 6);
  });

  it("matches a known reference distance (~1 degree of latitude ≈ 69 miles ≈ 364,000 ft)", () => {
    const d = haversineDistanceFt({ lat: 30, lng: -97 }, { lat: 31, lng: -97 });
    expect(d).toBeGreaterThan(360000);
    expect(d).toBeLessThan(368000);
  });
});

describe("pathLengthFt / pointAlongPath / resamplePath", () => {
  const straightPath: LatLng[] = [
    { lat: 30.0, lng: -97.0 },
    { lat: 30.0, lng: -96.9 },
    { lat: 30.0, lng: -96.8 },
  ];

  it("pathLengthFt sums consecutive segment distances", () => {
    const total = pathLengthFt(straightPath);
    const seg1 = haversineDistanceFt(straightPath[0], straightPath[1]);
    const seg2 = haversineDistanceFt(straightPath[1], straightPath[2]);
    expect(total).toBeCloseTo(seg1 + seg2, 3);
  });

  it("pointAlongPath at distance 0 returns the start, and at the total length returns the end", () => {
    const total = pathLengthFt(straightPath);
    const start = pointAlongPath(straightPath, 0);
    const end = pointAlongPath(straightPath, total);
    expect(start.lat).toBeCloseTo(straightPath[0].lat, 6);
    expect(start.lng).toBeCloseTo(straightPath[0].lng, 6);
    expect(end.lat).toBeCloseTo(straightPath[straightPath.length - 1].lat, 6);
    expect(end.lng).toBeCloseTo(straightPath[straightPath.length - 1].lng, 6);
  });

  it("resamplePath returns evenly-spaced points covering the full path length", () => {
    const resampled = resamplePath(straightPath, 5);
    expect(resampled).toHaveLength(5);
    const total = pathLengthFt(straightPath);
    for (let i = 1; i < resampled.length; i++) {
      const step = haversineDistanceFt(resampled[i - 1], resampled[i]);
      expect(step).toBeCloseTo(total / 4, 0);
    }
  });
});

describe("geoJsonToPath", () => {
  it("extracts a path from a bare LineString geometry", () => {
    const path = geoJsonToPath({ type: "LineString", coordinates: [[-97.0, 30.0], [-96.9, 30.1]] });
    expect(path).toEqual([
      { lng: -97.0, lat: 30.0 },
      { lng: -96.9, lat: 30.1 },
    ]);
  });

  it("extracts a path from a Feature wrapping a LineString", () => {
    const path = geoJsonToPath({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[-97.0, 30.0], [-96.9, 30.1], [-96.8, 30.2]] },
    });
    expect(path).toHaveLength(3);
  });

  it("extracts a path from a FeatureCollection by finding the first LineString feature", () => {
    const path = geoJsonToPath({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [-97.0, 30.0] } },
        { type: "Feature", geometry: { type: "LineString", coordinates: [[-97.0, 30.0], [-96.9, 30.1]] } },
      ],
    });
    expect(path).toEqual([
      { lng: -97.0, lat: 30.0 },
      { lng: -96.9, lat: 30.1 },
    ]);
  });

  it("returns null for a document with no usable path geometry", () => {
    expect(geoJsonToPath({ type: "Point", coordinates: [-97.0, 30.0] })).toBeNull();
    expect(geoJsonToPath({})).toBeNull();
    expect(geoJsonToPath(null)).toBeNull();
    expect(geoJsonToPath("not an object")).toBeNull();
  });
});

describe("fetchElevationsFt", () => {
  it("converts Open-Meteo's meters response to feet, in request order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elevation: [100, 200] }) })
    );
    const result = await fetchElevationsFt([
      { lat: 30, lng: -97 },
      { lat: 31, lng: -96 },
    ]);
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(100 * 3.28084, 2);
    expect(result![1]).toBeCloseTo(200 * 3.28084, 2);
  });

  it("returns null when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchElevationsFt([{ lat: 30, lng: -97 }]);
    expect(result).toBeNull();
  });

  it("returns null when the elevation array length doesn't match the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elevation: [100] }) }));
    const result = await fetchElevationsFt([{ lat: 30, lng: -97 }, { lat: 31, lng: -96 }]);
    expect(result).toBeNull();
  });

  it("returns null on a network error rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await fetchElevationsFt([{ lat: 30, lng: -97 }]);
    expect(result).toBeNull();
  });

  it("returns an empty array for an empty input without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchElevationsFt([]);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildTerrainProfile", () => {
  it("maps real terrain elevations onto the alignment's arc-length domain (0..totalShownLengthFt)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elevation: Array.from({ length: 10 }, (_, i) => 100 + i) }) })
    );
    const path: LatLng[] = [{ lat: 30, lng: -97 }, { lat: 30.01, lng: -97 }];
    const profile = await buildTerrainProfile(path, 5000, 10);
    expect(profile).not.toBeNull();
    expect(profile![0].arcLengthFt).toBe(0);
    expect(profile![profile!.length - 1].arcLengthFt).toBe(5000);
  });

  it("returns null for a degenerate single-point path", async () => {
    const profile = await buildTerrainProfile([{ lat: 30, lng: -97 }], 5000);
    expect(profile).toBeNull();
  });
});

describe("terrainElevationAt", () => {
  const profile = [
    { arcLengthFt: 0, elevationFt: 500 },
    { arcLengthFt: 100, elevationFt: 520 },
    { arcLengthFt: 200, elevationFt: 480 },
  ];

  it("interpolates linearly between samples", () => {
    expect(terrainElevationAt(profile, 50)).toBeCloseTo(510, 6);
  });

  it("clamps before the first sample and after the last", () => {
    expect(terrainElevationAt(profile, -50)).toBe(500);
    expect(terrainElevationAt(profile, 999)).toBe(480);
  });
});
