"use client";

import { useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Upload, Trash2, MountainSnow, Loader2 } from "lucide-react";
import { buildTerrainProfile, geoJsonToPath, pathLengthFt, type LatLng, type TerrainSample } from "@/lib/terrain";
import { toast } from "@/lib/toast";

const AUSTIN_TX: [number, number] = [30.2672, -97.7431];

function ClickCapture({ enabled, onPick }: { enabled: boolean; onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function TerrainImporter({
  totalShownLengthFt,
  onTerrainLoaded,
}: {
  totalShownLengthFt: number;
  onTerrainLoaded: (profile: TerrainSample[]) => void;
}) {
  const [basemap, setBasemap] = useState<"street" | "satellite">("satellite");
  const [pickedPoints, setPickedPoints] = useState<LatLng[]>([]);
  const [importedPath, setImportedPath] = useState<LatLng[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const path = importedPath ?? pickedPoints;
  const canFetch = path.length >= 2;

  function clearPath() {
    setPickedPoints([]);
    setImportedPath(null);
  }

  async function handleGeoJsonUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const parsed = geoJsonToPath(json);
      if (!parsed) {
        toast("That GeoJSON has no LineString/MultiPoint path to import", "fail");
        return;
      }
      setPickedPoints([]);
      setImportedPath(parsed);
      toast(`Imported a ${parsed.length}-point path from GeoJSON`, "ok");
    } catch {
      toast("That file isn't valid GeoJSON", "fail");
    }
  }

  async function handleFetchTerrain() {
    if (!canFetch || loading) return;
    setLoading(true);
    try {
      const profile = await buildTerrainProfile(path, totalShownLengthFt);
      if (!profile) {
        toast("Couldn't fetch terrain elevation (Open-Meteo unreachable or path too short)", "fail");
        return;
      }
      onTerrainLoaded(profile);
      toast(`Draped the corridor over ${fmtMiles(pathLengthFt(path))} of real terrain`, "ok");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-text-tertiary">
          {importedPath ? "GeoJSON path imported" : "Click the map to drop path points"}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={() => setBasemap((b) => (b === "satellite" ? "street" : "satellite"))}
            className="rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
          >
            {basemap === "satellite" ? "SATELLITE" : "STREET"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
          >
            <Upload size={11} /> GEOJSON
          </button>
          <button
            onClick={clearPath}
            disabled={path.length === 0}
            className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-crimson/40 hover:text-crimson disabled:opacity-40"
          >
            <Trash2 size={11} /> CLEAR
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json,.geojson,.json" className="hidden" onChange={handleGeoJsonUpload} />

      <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-border-hairline">
        <MapContainer center={AUSTIN_TX} zoom={11} className="h-full w-full" attributionControl={false}>
          {basemap === "satellite" ? (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          ) : (
            <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          )}
          <ClickCapture enabled={!importedPath} onPick={(p) => setPickedPoints((pts) => [...pts, p])} />
          {path.length >= 2 && <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#22d3ee", weight: 3 }} />}
          {pickedPoints.map((p, i) => (
            <CircleMarker key={i} center={[p.lat, p.lng]} radius={4} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1 }} />
          ))}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-tertiary">
        <span>{path.length >= 2 ? `Path length: ${fmtMiles(pathLengthFt(path))}` : `${path.length} point(s) — need at least 2`}</span>
        <button
          onClick={handleFetchTerrain}
          disabled={!canFetch || loading}
          className="flex items-center gap-1.5 rounded-sm border border-emerald/40 bg-emerald/10 px-2 py-1 text-[10px] font-medium text-emerald hover:bg-emerald/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <MountainSnow size={11} />}
          {loading ? "FETCHING TERRAIN…" : "DRAPE OVER REAL TERRAIN"}
        </button>
      </div>
    </div>
  );
}

function fmtMiles(ft: number): string {
  return `${(ft / 5280).toFixed(2)} mi`;
}
