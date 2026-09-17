"use client";

import { useEffect, useRef, useState } from "react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, SelectField, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, Panel, HeroMetric } from "@/components/ui/Ledger";
import NetworkBuilderCanvas, { type BuilderTool } from "@/components/canvas/NetworkBuilderCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { captureCanvasImage, findCanvas } from "@/lib/export/captureImage";
import Link from "next/link";
import {
  type NetworkState,
  type RoadType,
  EMPTY_NETWORK,
  ROAD_TYPE_SPECS,
  computeNetworkStats,
  saveNetworkToLocalStorage,
  loadNetworkFromLocalStorage,
} from "@/lib/engineering/networkBuilder";
import { TOPOLOGIES, type TopologyId } from "@/lib/engineering/interchangeTopologies";
import { fmt, formatStation } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv } from "@/lib/export/download";
import { Route, LandPlot, Hand, Undo2, Trash2 } from "lucide-react";

export default function NetworkBuilderPage() {
  const { corridorName, unitSystem, designSpeedMph, designVehicle, designStandard, stationStart } = useProjectStore();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [network, setNetwork] = useState<NetworkState>(EMPTY_NETWORK);
  const historyRef = useRef<NetworkState[]>([]);
  const [tool, setTool] = useState<BuilderTool>("draw");
  const [roadType, setRoadType] = useState<RoadType>("freeway");
  const [stampTopologyId, setStampTopologyId] = useState<TopologyId>("diamond");
  const [stampFootprintFt, setStampFootprintFt] = useState(2400);
  const [stampRotationDeg, setStampRotationDeg] = useState(0);
  const [gridFt, setGridFt] = useState(100);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    const saved = loadNetworkFromLocalStorage();
    if (saved) setNetwork(saved);
    setLoadedOnce(true);
  }, []);

  useEffect(() => {
    if (!loadedOnce) return;
    saveNetworkToLocalStorage(network);
  }, [network, loadedOnce]);

  function commit(next: NetworkState) {
    historyRef.current.push(network);
    if (historyRef.current.length > 50) historyRef.current.shift();
    setNetwork(next);
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (prev) setNetwork(prev);
  }

  function clearAll() {
    historyRef.current.push(network);
    setNetwork(EMPTY_NETWORK);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  const stats = computeNetworkStats(network);

  const publishNetwork = useCorridorStore((s) => s.publishNetwork);
  useEffect(() => {
    publishNetwork({
      totalMiles: stats.totalMiles,
      interchangeCount: stats.interchangeStampCount,
      estimatedCost: stats.estimatedCost,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.totalMiles, stats.interchangeStampCount, stats.estimatedCost, publishNetwork]);

  const steps: CalcStep[] = [
    {
      label: "Centerline Mileage by Facility Type",
      formula: "L_mi = Σ segment length / 5280",
      substitution: (Object.keys(ROAD_TYPE_SPECS) as RoadType[])
        .map((t) => `${ROAD_TYPE_SPECS[t].label}: ${fmt(stats.totalMilesByType[t], 2)} mi`)
        .join(", "),
      result: `${fmt(stats.totalMiles, 2)} mi total`,
    },
    {
      label: "Intersection / Merge Node Count",
      formula: "Node is an intersection if degree(node) ≥ 3",
      substitution: `${stats.nodeCount} total nodes evaluated`,
      result: `${stats.intersectionCount} intersections`,
    },
    {
      label: "Placed Interchange Structures",
      formula: "Count of dropped interchange stamps",
      substitution: `Topologies used: ${Array.from(new Set(network.stamps.map((s) => TOPOLOGIES[s.topologyId].label))).join(", ") || "none"}`,
      result: `${stats.interchangeStampCount} structure(s)`,
    },
    {
      label: "Representative Construction Cost Estimate",
      reference: "Illustrative unit costs by facility class — not a bid estimate",
      formula: "Cost = Σ(L_mi,type · $/mi,type) + N_interchange · $45M allowance",
      substitution: `Σ mileage cost + ${stats.interchangeStampCount} × $45,000,000`,
      result: `$${fmt(stats.estimatedCost, 0)}`,
    },
  ];

  async function handleExportMemo() {
    const img = captureCanvasImage(findCanvas(canvasContainerRef.current), "Corridor & Interchange Layout Canvas");

    await generateMemoPdf({
      moduleTitle: "Interchange & Corridor Network Layout",
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: formatStation(stationStart, unitSystem),
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images: img ? [img] : [],
      inputs: (Object.keys(ROAD_TYPE_SPECS) as RoadType[]).map((t) => ({
        label: ROAD_TYPE_SPECS[t].label,
        value: `${fmt(stats.totalMilesByType[t], 2)} mi`,
      })),
      steps,
      verdicts: [
        { label: "Network Layout Summary", status: "PASS", detail: `${stats.totalMiles.toFixed(2)} mi, ${stats.intersectionCount} intersections, ${stats.interchangeStampCount} interchanges` },
        { label: "Estimated Cost (Class 5 / planning-level)", status: "WARN", detail: `$${fmt(stats.estimatedCost, 0)} — illustrative unit costs, not a bid estimate` },
      ],
    });
  }

  function handleExportCsv() {
    const nodeMap = new Map(network.nodes.map((n) => [n.id, n]));
    const rows: (string | number)[][] = [["Segment_ID", "Type", "Lanes", "From_X_ft", "From_Y_ft", "To_X_ft", "To_Y_ft", "Length_ft"]];
    for (const seg of network.segments) {
      const a = nodeMap.get(seg.a);
      const b = nodeMap.get(seg.b);
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      rows.push([seg.id, ROAD_TYPE_SPECS[seg.type].label, ROAD_TYPE_SPECS[seg.type].lanes, fmt(a.x, 1), fmt(a.y, 1), fmt(b.x, 1), fmt(b.y, 1), fmt(len, 1)]);
    }
    rows.push([]);
    rows.push(["Interchange_ID", "Topology", "X_ft", "Y_ft", "Footprint_ft", "Rotation_deg"]);
    for (const s of network.stamps) {
      rows.push([s.id, TOPOLOGIES[s.topologyId].label, fmt(s.x, 1), fmt(s.y, 1), s.footprintFt, s.rotationDeg]);
    }
    downloadCsv(rows, `network_layout_${Date.now()}.csv`);
  }

  return (
    <ModuleShell
      moduleTag="INTERCHANGE / NETWORK BUILDER"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Tools</SectionLabel>
          <div className="grid grid-cols-4 gap-1.5">
            <ToolButton active={tool === "draw"} onClick={() => setTool("draw")} icon={<Route size={14} />} label="Draw" />
            <ToolButton active={tool === "stamp"} onClick={() => setTool("stamp")} icon={<LandPlot size={14} />} label="Stamp" />
            <ToolButton active={tool === "delete"} onClick={() => setTool("delete")} icon={<Trash2 size={14} />} label="Erase" />
            <ToolButton active={tool === "pan"} onClick={() => setTool("pan")} icon={<Hand size={14} />} label="Pan" />
          </div>
          <div className="flex gap-1.5">
            <button onClick={undo} className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan">
              <Undo2 size={12} /> UNDO (⌘Z)
            </button>
            <button onClick={clearAll} className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-crimson/40 hover:text-crimson">
              <Trash2 size={12} /> CLEAR
            </button>
          </div>

          {tool === "draw" && (
            <>
              <SectionLabel>Road Facility Type</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(ROAD_TYPE_SPECS) as RoadType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRoadType(t)}
                    className={`flex items-center justify-between rounded-sm border px-2 py-1.5 text-[11px] ${
                      roadType === t ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-border-hairline text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-4 rounded-full" style={{ background: ROAD_TYPE_SPECS[t].color }} />
                      {ROAD_TYPE_SPECS[t].label}
                    </span>
                    <span className="text-text-tertiary">{ROAD_TYPE_SPECS[t].lanes} ln</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-text-tertiary">Click to start a segment, click again to place it. Right-click cancels. Endpoints snap to nearby nodes automatically.</p>
            </>
          )}

          {tool === "stamp" && (
            <>
              <SectionLabel>Interchange Stamp</SectionLabel>
              <SelectField
                label="Topology"
                value={stampTopologyId}
                onChange={setStampTopologyId}
                options={Object.values(TOPOLOGIES).map((t) => ({ value: t.id, label: t.label }))}
              />
              <NumberField label="Footprint Size" value={stampFootprintFt} min={800} max={6000} step={100} onChange={setStampFootprintFt} unit="ft" />
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 90, 180, 270].map((r) => (
                  <button
                    key={r}
                    onClick={() => setStampRotationDeg(r)}
                    className={`rounded-sm border py-1 text-[10px] ${stampRotationDeg === r ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-border-hairline text-text-secondary"}`}
                  >
                    {r}°
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-text-tertiary">Click on the canvas to drop the selected interchange preset at that location. Align it visually against your mainline.</p>
            </>
          )}

          {tool === "delete" && (
            <p className="text-[10px] leading-relaxed text-text-tertiary">Click a road segment or interchange stamp to remove it.</p>
          )}
          {tool === "pan" && (
            <p className="text-[10px] leading-relaxed text-text-tertiary">Click-drag to pan. Scroll to zoom. Middle-click drag also pans in any tool.</p>
          )}

          <SectionLabel>Grid</SectionLabel>
          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
            Snap to grid
          </label>
          <NumberField label="Grid Spacing" value={gridFt} min={10} max={500} step={10} onChange={setGridFt} unit="ft" />
        </div>
      }
    >
      <div className="grid h-full grid-cols-[1fr_280px] gap-3">
        <Panel title="Corridor & Interchange Layout Canvas" actions={<span className="text-[10px] text-text-tertiary">SCROLL = ZOOM · DRAG (PAN TOOL) = PAN</span>}>
          <div ref={canvasContainerRef} className="h-full w-full overflow-hidden rounded-sm border border-border-hairline">
            <ErrorBoundary label="Network Builder Canvas">
              <NetworkBuilderCanvas
                state={network}
                onChange={commit}
                tool={tool}
                roadType={roadType}
                stampTopologyId={stampTopologyId}
                stampFootprintFt={stampFootprintFt}
                stampRotationDeg={stampRotationDeg}
                gridFt={gridFt}
                snapEnabled={snapEnabled}
              />
            </ErrorBoundary>
          </div>
        </Panel>

        <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
          <HeroMetric
            label="Est. Construction Cost"
            value={`$${fmt(stats.estimatedCost, 0)}`}
            status="neutral"
            comparison={`${fmt(stats.totalMiles, 2)} mi centerline · ${stats.interchangeStampCount} interchange${stats.interchangeStampCount === 1 ? "" : "s"}`}
          />
          <Panel title="Network Statistics">
            {(Object.keys(ROAD_TYPE_SPECS) as RoadType[]).map((t) => (
              <LedgerRow key={t} label={ROAD_TYPE_SPECS[t].label} value={fmt(stats.totalMilesByType[t], 2)} unit="mi" />
            ))}
            <LedgerRow label="Total Centerline Mileage" value={fmt(stats.totalMiles, 2)} unit="mi" status="ok" />
            <LedgerRow label="Nodes" value={String(stats.nodeCount)} />
            <LedgerRow label="Intersections (degree ≥ 3)" value={String(stats.intersectionCount)} status={stats.intersectionCount > 0 ? "warn" : "neutral"} />
            <LedgerRow label="Interchange Structures" value={String(stats.interchangeStampCount)} status="ok" />
            <LedgerRow label="Est. Construction Cost" value={`$${fmt(stats.estimatedCost, 0)}`} status="ok" />
          </Panel>
          {network.stamps.length > 0 && (
            <Panel title={`Placed Interchanges (${network.stamps.length})`}>
              <div className="flex flex-col gap-1.5">
                {network.stamps.map((stamp) => (
                  <div key={stamp.id} className="flex items-center justify-between gap-2 border-b border-border-hairline/60 py-1.5 text-[11px] last:border-0">
                    <span className="truncate text-text-secondary">{TOPOLOGIES[stamp.topologyId].label}</span>
                    <Link
                      href={`/interchange-ops?topology=${stamp.topologyId}`}
                      className="shrink-0 rounded-sm border border-cyan/30 px-2 py-1 text-[10px] font-medium text-cyan hover:bg-cyan/10"
                    >
                      ANALYZE IN HCM OPS →
                    </Link>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Legend">
            {(Object.keys(ROAD_TYPE_SPECS) as RoadType[]).map((t) => (
              <div key={t} className="flex items-center justify-between py-1 text-[11px]">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="h-1.5 w-5 rounded-full" style={{ background: ROAD_TYPE_SPECS[t].color }} />
                  {ROAD_TYPE_SPECS[t].label}
                </span>
                <span className="text-text-tertiary">{ROAD_TYPE_SPECS[t].lanes} lanes</span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 text-[10px] text-text-tertiary">
              <span className="h-2 w-2 rounded-full bg-amber" /> Intersection node (degree ≥ 3)
            </div>
          </Panel>
        </div>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Network Layout" steps={steps} />
    </ModuleShell>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-sm border py-2 text-[10px] ${
        active ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-border-hairline text-text-secondary hover:border-border-strong"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
