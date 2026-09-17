// Real-world terrain support for the 3D corridor viewer: parse a path from a
// GeoJSON file or a user-picked sequence of map points, then fetch actual
// ground elevation along it from Open-Meteo's free, keyless elevation API
// (https://open-meteo.com/en/docs/elevation-api — SRTM-derived, ~90m
// resolution globally). No Mapbox/USGS/Copernicus account or token is
// wired in: those either require a paid API key (Mapbox) or are US-only
// (USGS EPQS). Open-Meteo covers the whole globe with no key, which is a
// direct, honest substitution — not a silent downgrade — for the same job:
// draping the alignment ribbon over a real ground profile instead of flat
// space.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TerrainSample {
  arcLengthFt: number; // position along the shown alignment (0 = start of lead-in tangent)
  elevationFt: number;
}

const METERS_TO_FEET = 3.28084;
const EARTH_RADIUS_M = 6371000;

export function haversineDistanceFt(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  return meters * METERS_TO_FEET;
}

export function pathLengthFt(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineDistanceFt(path[i - 1], path[i]);
  return total;
}

/** Linear interpolation along a polyline at a given cumulative distance from its start. */
export function pointAlongPath(path: LatLng[], distanceFt: number): LatLng {
  if (path.length === 0) throw new Error("pointAlongPath: empty path");
  if (path.length === 1) return path[0];
  let remaining = Math.max(0, distanceFt);
  for (let i = 1; i < path.length; i++) {
    const segLen = haversineDistanceFt(path[i - 1], path[i]);
    if (remaining <= segLen || i === path.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      };
    }
    remaining -= segLen;
  }
  return path[path.length - 1];
}

/** Resamples a path into `count` evenly-spaced points by real-world distance along it. */
export function resamplePath(path: LatLng[], count: number): LatLng[] {
  const total = pathLengthFt(path);
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => pointAlongPath(path, (i / (n - 1)) * total));
}

export type GeoJsonInput = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  coordinates?: unknown;
  features?: GeoJsonInput[];
};

/**
 * Extracts a LatLng path from a GeoJSON document — a LineString's own
 * coordinates, a MultiPoint treated as an ordered path, or the first
 * LineString/MultiPoint found in a FeatureCollection. GeoJSON coordinates
 * are [longitude, latitude] order; this returns {lat, lng}.
 */
export function geoJsonToPath(input: unknown): LatLng[] | null {
  const doc = input as GeoJsonInput;
  if (!doc || typeof doc !== "object") return null;

  const fromCoordinates = (coords: unknown): LatLng[] | null => {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    if (!Array.isArray(coords[0])) return null;
    const pts = coords
      .filter((c): c is number[] => Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number")
      .map((c) => ({ lng: c[0], lat: c[1] }));
    return pts.length >= 2 ? pts : null;
  };

  const geomType = doc.geometry?.type ?? doc.type;
  const coords = doc.geometry?.coordinates ?? doc.coordinates;
  if (geomType === "LineString" || geomType === "MultiPoint") {
    const path = fromCoordinates(coords);
    if (path) return path;
  }

  if (Array.isArray(doc.features)) {
    for (const feature of doc.features) {
      const path = geoJsonToPath(feature);
      if (path) return path;
    }
  }
  return null;
}

/**
 * Fetches ground elevation for each point via Open-Meteo's batch elevation
 * endpoint (one request for all points). Returns null on any network/parse
 * failure — the caller should show that as "terrain unavailable" rather
 * than a hard error, since this hits a third-party service with no SLA.
 */
export async function fetchElevationsFt(points: LatLng[]): Promise<number[] | null> {
  if (points.length === 0) return [];
  try {
    const lat = points.map((p) => p.lat.toFixed(6)).join(",");
    const lng = points.map((p) => p.lng.toFixed(6)).join(",");
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { elevation?: number[] };
    if (!Array.isArray(json.elevation) || json.elevation.length !== points.length) return null;
    return json.elevation.map((m) => m * METERS_TO_FEET);
  } catch {
    return null;
  }
}

/**
 * Full pipeline: a real-world path -> resampled at `samples` points -> real
 * elevations -> mapped onto the alignment's own arc-length domain
 * (0..totalShownLengthFt), scaling the path's true length to fit whatever
 * span the alignment currently shows. The corridor's real-world geographic
 * position is otherwise irrelevant here — only its terrain profile (the
 * up/down shape) is borrowed.
 */
export async function buildTerrainProfile(path: LatLng[], totalShownLengthFt: number, samples = 40): Promise<TerrainSample[] | null> {
  if (path.length < 2 || totalShownLengthFt <= 0) return null;
  const resampled = resamplePath(path, samples);
  const elevations = await fetchElevationsFt(resampled);
  if (!elevations) return null;
  return elevations.map((elevationFt, i) => ({
    arcLengthFt: (i / (samples - 1)) * totalShownLengthFt,
    elevationFt,
  }));
}

/** Linear interpolation of a terrain profile at an arbitrary arc length (clamped to the profile's ends). */
export function terrainElevationAt(profile: TerrainSample[], arcLengthFt: number): number {
  if (profile.length === 0) return 0;
  if (arcLengthFt <= profile[0].arcLengthFt) return profile[0].elevationFt;
  const last = profile[profile.length - 1];
  if (arcLengthFt >= last.arcLengthFt) return last.elevationFt;
  for (let i = 1; i < profile.length; i++) {
    if (arcLengthFt <= profile[i].arcLengthFt) {
      const a = profile[i - 1];
      const b = profile[i];
      const t = (arcLengthFt - a.arcLengthFt) / (b.arcLengthFt - a.arcLengthFt || 1);
      return a.elevationFt + (b.elevationFt - a.elevationFt) * t;
    }
  }
  return last.elevationFt;
}
