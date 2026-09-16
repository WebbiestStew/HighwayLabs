"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, ToggleGroup, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, StatusPill, Panel, ValidationBanner, HeroMetric } from "@/components/ui/Ledger";
import MassHaulCanvas from "@/components/canvas/MassHaulCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { computeEarthwork, computeLoops, type StationRow, type SoilClass } from "@/lib/engineering/earthwork";
import { fmt, formatStation } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv } from "@/lib/export/download";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { earthworkControlsSchema } from "@/lib/schemas/earthwork";
import { validateInputs } from "@/lib/validation";
import { usePersistedForm } from "@/lib/persistence";
import { captureCanvasImage, findCanvas } from "@/lib/export/captureImage";

const CUT_SHAPE = [0, 120, 260, 340, 210, 60, 0, 0, 40, 180, 310, 260, 90, 0];
const FILL_SHAPE = [10, 0, 0, 0, 40, 160, 280, 320, 200, 50, 0, 0, 30, 150];

/** Evenly spaces the illustrative cut/fill shape across a given station range. */
function makeRowsForRange(startFt: number, endFt: number): StationRow[] {
  const count = CUT_SHAPE.length;
  const step = (endFt - startFt) / (count - 1 || 1);
  return CUT_SHAPE.map((c, i) => ({
    id: `r${Date.now()}_${i}`,
    stationFt: startFt + i * step,
    cutAreaSqFt: c,
    fillAreaSqFt: FILL_SHAPE[i],
  }));
}

export default function EarthworkPage() {
  const { corridorName, unitSystem, designSpeedMph, designVehicle, designStandard, stationStart, stationEnd } = useProjectStore();
  const horizontalSummary = useCorridorStore((s) => s.horizontal);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<StationRow[]>(() => makeRowsForRange(stationStart, stationEnd));
  const [soilClass, setSoilClass] = useState<SoilClass>("common-soil");
  const [shrinkagePercent, setShrinkagePercent] = useState(15);
  const [swellPercent, setSwellPercent] = useState(20);
  const [applyPrismoidal, setApplyPrismoidal] = useState(false);
  const [excavationCost, setExcavationCost] = useState(8.5);
  const [freeHaulDistanceFt, setFreeHaulDistanceFt] = useState(500);
  const [overhaulCost, setOverhaulCost] = useState(0.35);
  const [borrowCost, setBorrowCost] = useState(12);
  const [wasteCost, setWasteCost] = useState(4);
  const [balanceLevelCy, setBalanceLevelCy] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const results = useMemo(
    () =>
      computeEarthwork({
        rows,
        soilClass,
        shrinkagePercent,
        swellPercent,
        applyPrismoidalCorrection: applyPrismoidal,
        excavationUnitCostPerCy: excavationCost,
        freeHaulDistanceFt,
        overhaulUnitCostPerStationYd: overhaulCost,
        borrowUnitCostPerCy: borrowCost,
        wasteUnitCostPerCy: wasteCost,
      }),
    [rows, soilClass, shrinkagePercent, swellPercent, applyPrismoidal, excavationCost, freeHaulDistanceFt, overhaulCost, borrowCost, wasteCost]
  );

  const loops = useMemo(
    () => computeLoops(results.massHaul, results.intervals, balanceLevelCy, freeHaulDistanceFt, overhaulCost),
    [results.massHaul, results.intervals, balanceLevelCy, freeHaulDistanceFt, overhaulCost]
  );
  const totalOverhaulCost = loops.reduce((s, l) => s + l.overhaulCost, 0);
  const grandTotal = results.grandTotalCost + totalOverhaulCost;

  const publishEarthwork = useCorridorStore((s) => s.publishEarthwork);
  useEffect(() => {
    if (rows.length === 0) return;
    const stations = rows.map((r) => r.stationFt);
    publishEarthwork({
      startStationFt: Math.min(...stations),
      endStationFt: Math.max(...stations),
      netEndOrdinateCy: results.netEndOrdinateCy,
      borrowRequiredCy: results.borrowRequiredCy,
      wasteRequiredCy: results.wasteRequiredCy,
      grandTotalCost: grandTotal,
    });
  }, [rows, results.netEndOrdinateCy, results.borrowRequiredCy, results.wasteRequiredCy, grandTotal, publishEarthwork]);

  const controlInputs = { shrinkagePercent, swellPercent, excavationCost, freeHaulDistanceFt, overhaulCost, borrowCost, wasteCost };
  const validation = useMemo(() => validateInputs(earthworkControlsSchema, controlInputs), [JSON.stringify(controlInputs)]);

  usePersistedForm(
    "highwaylab.earthwork",
    { rows, soilClass, applyPrismoidal, balanceLevelCy, ...controlInputs },
    { rows: setRows, soilClass: setSoilClass, applyPrismoidal: setApplyPrismoidal, balanceLevelCy: setBalanceLevelCy, shrinkagePercent: setShrinkagePercent, swellPercent: setSwellPercent, excavationCost: setExcavationCost, freeHaulDistanceFt: setFreeHaulDistanceFt, overhaulCost: setOverhaulCost, borrowCost: setBorrowCost, wasteCost: setWasteCost }
  );

  function updateRow(id: string, patch: Partial<StationRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    setRows((rs) => [...rs, { id: `r${Date.now()}`, stationFt: (last?.stationFt ?? 0) + 100, cutAreaSqFt: 0, fillAreaSqFt: 0 }]);
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }
  function syncToCorridorRange() {
    setRows(makeRowsForRange(stationStart, stationEnd));
  }

  const steps: CalcStep[] = [
    {
      label: "Average End Area Volume (per interval)",
      formula: "V = (A1 + A2)/2 · (L/27)",
      substitution: "Computed for each consecutive station pair — see interval ledger",
      result: `ΣV_cut = ${fmt(results.totalCutCy, 0)} CY, ΣV_fill = ${fmt(results.totalFillCy, 0)} CY`,
    },
    {
      label: "Prismoidal Correction",
      formula: "V_p = (L/162)·(c1−c2)·(w1−w2)",
      substitution: applyPrismoidal ? "Applied where center height / top width provided" : "Not applied",
      result: `Σ correction = ${fmt(results.intervals.reduce((s, i) => s + i.prismoidalCorrectionCy, 0), 1)} CY`,
    },
    {
      label: `Shrinkage / Swell Adjustment (${soilClass})`,
      formula: soilClass === "common-soil" ? "Factor = 1 − shrinkage%" : "Factor = 1 + swell%",
      substitution: soilClass === "common-soil" ? `1 − ${shrinkagePercent}%` : `1 + ${swellPercent}%`,
      result: `Adjusted cut credit = ${fmt(results.totalAdjustedCutCy, 0)} CY`,
    },
    {
      label: "Cumulative Mass-Haul Ordinate",
      formula: "M(i) = M(i−1) + V_cut,adj(i) − V_fill(i)",
      substitution: "Running sum across all stations",
      result: `Final ordinate = ${fmt(results.netEndOrdinateCy, 0)} CY`,
    },
    {
      label: "Net Borrow / Waste Requirement",
      formula: "Borrow if M_end < 0;  Waste if M_end > 0",
      substitution: `M_end = ${fmt(results.netEndOrdinateCy, 0)} CY`,
      result: results.netEndOrdinateCy >= 0 ? `Waste ${fmt(results.wasteRequiredCy, 0)} CY` : `Borrow ${fmt(results.borrowRequiredCy, 0)} CY`,
    },
    ...loops.slice(0, 6).map((loop, i) => ({
      label: `Loop ${i + 1} (STA ${formatStation(loop.startStationFt, unitSystem)} – ${formatStation(loop.endStationFt, unitSystem)}) — Haul Segregation`,
      formula: "Haul Dist. = |centroid_fill − centroid_cut|; Overhaul = max(0, Haul − FHD)",
      substitution: `Centroid cut STA ${formatStation(loop.centroidCutStationFt, unitSystem)}, centroid fill STA ${formatStation(loop.centroidFillStationFt, unitSystem)}`,
      result: `Haul=${fmt(loop.haulDistanceFt, 0)} ft, Overhaul=${fmt(loop.overhaulStationYd, 1)} sta-yd`,
    })),
  ];

  async function handleExportMemo() {
    const img = captureCanvasImage(findCanvas(canvasContainerRef.current), "Interactive Mass-Haul Diagram");

    generateMemoPdf({
      moduleTitle: "Earthwork — Prismoidal / End-Area & Mass-Haul Balance",
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: rows.length ? `${formatStation(rows[0].stationFt, unitSystem)} – ${formatStation(rows[rows.length - 1].stationFt, unitSystem)}` : "N/A",
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images: img ? [img] : [],
      inputs: [
        { label: "Soil classification", value: soilClass },
        { label: "Shrinkage %", value: `${shrinkagePercent}%` },
        { label: "Swell %", value: `${swellPercent}%` },
        { label: "Excavation unit cost", value: `$${excavationCost}/CY` },
        { label: "Free-haul distance", value: `${freeHaulDistanceFt} ft` },
        { label: "Overhaul unit cost", value: `$${overhaulCost}/sta-yd` },
        { label: "Borrow unit cost", value: `$${borrowCost}/CY` },
        { label: "Waste unit cost", value: `$${wasteCost}/CY` },
        { label: "Balance line level", value: `${fmt(balanceLevelCy, 0)} CY` },
      ],
      steps,
      verdicts: [
        {
          label: "Mass-Haul Balance",
          status: "PASS",
          detail: `Net end ordinate ${fmt(results.netEndOrdinateCy, 0)} CY — ${results.netEndOrdinateCy >= 0 ? "surplus (waste)" : "deficit (borrow)"}`,
        },
        {
          label: "Project Earthwork Cost",
          status: "PASS",
          detail: `Grand total $${fmt(grandTotal, 0)} (excavation + overhaul + borrow/waste)`,
        },
      ],
    });
  }

  function handleExportCsv() {
    const rowsOut: (string | number)[][] = [["Station", "Cut_SqFt", "Fill_SqFt"]];
    rows.forEach((r) => rowsOut.push([formatStation(r.stationFt, unitSystem), r.cutAreaSqFt, r.fillAreaSqFt]));
    rowsOut.push([]);
    rowsOut.push(["Station", "Cumulative_MassHaul_CY"]);
    results.massHaul.forEach((p) => rowsOut.push([formatStation(p.stationFt, unitSystem), fmt(p.cumulativeCy, 1)]));
    downloadCsv(rowsOut, `earthwork_massHaul_${Date.now()}.csv`);
  }

  return (
    <ModuleShell
      moduleTag="EARTHWORK / MASS-HAUL"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Soil Geotechnical Mechanics</SectionLabel>
          <ToggleGroup
            label="Excavated Material Class"
            value={soilClass}
            onChange={setSoilClass}
            options={[
              { value: "common-soil", label: "Common Soil" },
              { value: "rock", label: "Rock" },
            ]}
          />
          <NumberField label="Shrinkage Factor" value={shrinkagePercent} min={10} max={25} step={1} onChange={setShrinkagePercent} unit="%" error={validation.errors.shrinkagePercent} />
          <NumberField label="Rock Swell Factor" value={swellPercent} min={15} max={35} step={1} onChange={setSwellPercent} unit="%" error={validation.errors.swellPercent} />
          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <input type="checkbox" checked={applyPrismoidal} onChange={(e) => setApplyPrismoidal(e.target.checked)} />
            Apply prismoidal correction
          </label>

          <SectionLabel>Cost & Haul Economics</SectionLabel>
          <NumberField label="Excavation Unit Cost" value={excavationCost} step={0.25} onChange={setExcavationCost} unit="$/CY" error={validation.errors.excavationCost} />
          <NumberField label="Free-Haul Distance" value={freeHaulDistanceFt} step={50} onChange={setFreeHaulDistanceFt} unit="ft" error={validation.errors.freeHaulDistanceFt} />
          <NumberField label="Overhaul Unit Cost" value={overhaulCost} step={0.05} onChange={setOverhaulCost} unit="$/sta-yd" error={validation.errors.overhaulCost} />
          <NumberField label="Borrow Unit Cost" value={borrowCost} step={0.5} onChange={setBorrowCost} unit="$/CY" error={validation.errors.borrowCost} />
          <NumberField label="Waste Unit Cost" value={wasteCost} step={0.5} onChange={setWasteCost} unit="$/CY" error={validation.errors.wasteCost} />

          <SectionLabel>Balance Line</SectionLabel>
          <NumberField label="Balance Level (drag on chart)" value={Math.round(balanceLevelCy)} step={10} onChange={setBalanceLevelCy} unit="CY" />
        </div>
      }
    >
      <div className="grid h-full grid-rows-[auto_1fr] gap-3">
        <Panel
          title="Station Cross-Section Ledger"
          className="max-h-[220px]"
          actions={
            <div className="flex gap-1.5">
              <button
                onClick={syncToCorridorRange}
                title={`Regenerate the station ledger evenly across the project's corridor range (${formatStation(stationStart, unitSystem)} – ${formatStation(stationEnd, unitSystem)})`}
                className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
              >
                <RefreshCw size={11} /> SYNC TO CORRIDOR RANGE
              </button>
              <button onClick={addRow} className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-cyan hover:border-cyan/40">
                <Plus size={11} /> ADD STATION
              </button>
            </div>
          }
        >
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-text-tertiary">
                  <th className="pb-1">Station (ft)</th>
                  <th className="pb-1">Cut Area (sf)</th>
                  <th className="pb-1">Fill Area (sf)</th>
                  <th className="pb-1"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border-hairline/60">
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        aria-label={`Station for row at ${formatStation(r.stationFt, unitSystem)}`}
                        value={r.stationFt}
                        onChange={(e) => updateRow(r.id, { stationFt: Number(e.target.value) })}
                        className="w-24 bg-transparent tabular-nums text-text-primary outline-none"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        aria-label={`Cut area at ${formatStation(r.stationFt, unitSystem)}`}
                        value={r.cutAreaSqFt}
                        onChange={(e) => updateRow(r.id, { cutAreaSqFt: Number(e.target.value) })}
                        className="w-20 bg-transparent tabular-nums text-emerald outline-none"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        aria-label={`Fill area at ${formatStation(r.stationFt, unitSystem)}`}
                        value={r.fillAreaSqFt}
                        onChange={(e) => updateRow(r.id, { fillAreaSqFt: Number(e.target.value) })}
                        className="w-20 bg-transparent tabular-nums text-amber outline-none"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeRow(r.id)}
                        aria-label={`Delete row at ${formatStation(r.stationFt, unitSystem)}`}
                        className="text-text-tertiary hover:text-crimson"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid min-h-0 grid-cols-[1fr_320px] gap-3">
          <Panel title="Interactive Mass-Haul Diagram (drag red line to set balance)">
            <div ref={canvasContainerRef} className="h-full w-full rounded-sm border border-border-hairline">
              <ErrorBoundary label="Mass-Haul Diagram">
                <MassHaulCanvas
                  massHaul={results.massHaul}
                  loops={loops}
                  balanceLevelCy={balanceLevelCy}
                  onBalanceLevelChange={setBalanceLevelCy}
                  unitSystem={unitSystem}
                />
              </ErrorBoundary>
            </div>
          </Panel>

          <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              <StatusPill status={results.netEndOrdinateCy >= 0 ? "ok" : "warn"} label={results.netEndOrdinateCy >= 0 ? "NET SURPLUS (WASTE)" : "NET DEFICIT (BORROW)"} />
            </div>
            <HeroMetric
              label="Total Project Earthwork Cost"
              value={`$${fmt(grandTotal, 0)}`}
              status="neutral"
              comparison={
                results.netEndOrdinateCy >= 0
                  ? `net surplus — ${fmt(results.wasteRequiredCy, 0)} CY waste`
                  : `net deficit — ${fmt(results.borrowRequiredCy, 0)} CY borrow`
              }
            />
            <ValidationBanner errors={validation.errors} />
            {horizontalSummary && (
              <Panel title="Corridor Reference (from Module 1)">
                <LedgerRow
                  label="Typical Section Width"
                  value={fmt(horizontalSummary.pavementWidthFt, 1)}
                  unit="ft / direction"
                  approx="Reference only — lanesPerDirection × laneWidthFt from the Horizontal Alignment module. Use it as a guide when estimating cut/fill cross-sectional areas by hand; this tool has no terrain/ground-survey model, so areas are still entered manually."
                />
              </Panel>
            )}
            <Panel title="Volume & Cost Summary">
              <LedgerRow label="Total Cut Volume" value={fmt(results.totalCutCy, 0)} unit="CY" />
              <LedgerRow label="Total Fill Volume" value={fmt(results.totalFillCy, 0)} unit="CY" />
              <LedgerRow label="Adjusted Cut Credit" value={fmt(results.totalAdjustedCutCy, 0)} unit="CY" status="ok" />
              <LedgerRow label="Net End Ordinate" value={fmt(results.netEndOrdinateCy, 0)} unit="CY" />
              <LedgerRow label="Borrow Required" value={fmt(results.borrowRequiredCy, 0)} unit="CY" status={results.borrowRequiredCy > 0 ? "warn" : "neutral"} />
              <LedgerRow label="Waste Required" value={fmt(results.wasteRequiredCy, 0)} unit="CY" status={results.wasteRequiredCy > 0 ? "warn" : "neutral"} />
              <LedgerRow label="Excavation Cost" value={`$${fmt(results.totalExcavationCost, 0)}`} />
              <LedgerRow label="Overhaul Cost (all loops)" value={`$${fmt(totalOverhaulCost, 0)}`} />
              <LedgerRow label="Borrow Cost" value={`$${fmt(results.totalBorrowCost, 0)}`} />
              <LedgerRow label="Waste Cost" value={`$${fmt(results.totalWasteCost, 0)}`} />
              <LedgerRow label="Grand Total" value={`$${fmt(grandTotal, 0)}`} status="ok" />
            </Panel>
            <Panel title={`Balanced Loops (${loops.length})`}>
              {loops.map((l, i) => (
                <LedgerRow
                  key={i}
                  label={`Loop ${i + 1}: ${formatStation(l.startStationFt, unitSystem)}–${formatStation(l.endStationFt, unitSystem)}`}
                  value={`${fmt(l.balancedVolumeCy, 0)} CY / ${fmt(l.haulDistanceFt, 0)} ft`}
                  status={l.overhaulStationYd > 0 ? "warn" : "ok"}
                />
              ))}
            </Panel>
          </div>
        </div>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Earthwork / Mass-Haul" steps={steps} />
    </ModuleShell>
  );
}
