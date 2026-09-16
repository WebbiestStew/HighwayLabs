"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, ToggleGroup, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, StatusPill, Panel, ValidationBanner, HeroMetric } from "@/components/ui/Ledger";
import VerticalCurveCanvas from "@/components/canvas/VerticalCurveCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { Link2 } from "lucide-react";
import { computeVertical, type VerticalInputs, type CurveClass } from "@/lib/engineering/vertical";
import { fmt, formatStation, ftToM } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv } from "@/lib/export/download";
import { verticalSchema } from "@/lib/schemas/vertical";
import { validateInputs } from "@/lib/validation";
import { usePersistedForm } from "@/lib/persistence";
import { captureCanvasImage, findCanvas } from "@/lib/export/captureImage";

export default function VerticalAlignmentPage() {
  const { corridorName, unitSystem, designSpeedMph, designVehicle, designStandard, stationStart } = useProjectStore();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [curveClass, setCurveClass] = useState<CurveClass>("crest");
  const [pvcStationFt, setPvcStationFt] = useState(stationStart + 500);
  const [pvcElevationFt, setPvcElevationFt] = useState(620.0);
  const [g1Percent, setG1] = useState(2.5);
  const [g2Percent, setG2] = useState(-1.5);
  const [lengthMode, setLengthMode] = useState<"auto" | "manual">("auto");
  const [manualLengthFt, setManualLengthFt] = useState(600);
  const [sagCurbedUrban, setSagCurbedUrban] = useState(false);
  const [hasStructure, setHasStructure] = useState(true);
  const [structureStationFt, setStructureStationFt] = useState(pvcStationFt + 300);
  const [girderElevationFt, setGirderElevationFt] = useState(638.0);
  const [structureWidthFt, setStructureWidthFt] = useState(40);
  const [requiredClearanceFt, setRequiredClearanceFt] = useState(16.5);
  const [drawerOpen, setDrawerOpen] = useState(false);

  usePersistedForm(
    "highwaylab.vertical-alignment",
    { curveClass, pvcStationFt, pvcElevationFt, g1Percent, g2Percent, lengthMode, manualLengthFt, sagCurbedUrban, hasStructure, structureStationFt, girderElevationFt, structureWidthFt, requiredClearanceFt },
    { curveClass: setCurveClass, pvcStationFt: setPvcStationFt, pvcElevationFt: setPvcElevationFt, g1Percent: setG1, g2Percent: setG2, lengthMode: setLengthMode, manualLengthFt: setManualLengthFt, sagCurbedUrban: setSagCurbedUrban, hasStructure: setHasStructure, structureStationFt: setStructureStationFt, girderElevationFt: setGirderElevationFt, structureWidthFt: setStructureWidthFt, requiredClearanceFt: setRequiredClearanceFt }
  );

  const inputs: VerticalInputs = {
    curveClass,
    designSpeedMph,
    pvcStationFt,
    pvcElevationFt,
    g1Percent,
    g2Percent,
    lengthMode,
    manualLengthFt,
    structure: hasStructure
      ? { stationFt: structureStationFt, girderElevationFt, widthFt: structureWidthFt, requiredClearanceFt }
      : null,
    sagCurbedUrban,
  };

  const results = useMemo(() => computeVertical(inputs), [JSON.stringify(inputs)]);
  const validation = useMemo(() => validateInputs(verticalSchema, inputs), [JSON.stringify(inputs)]);
  const unitLen = unitSystem === "us" ? "ft" : "m";
  const toDisp = (ft: number) => (unitSystem === "us" ? ft : ftToM(ft));

  const kStatus = results.meetsKMin ? "ok" : "fail";
  const drainageStatus = results.meetsDrainageFlatness ? "ok" : "warn";
  const clearanceStatus = results.structureCheck
    ? results.structureCheck.pass
      ? "ok"
      : "fail"
    : "neutral";

  const publishVertical = useCorridorStore((s) => s.publishVertical);
  const horizontalSummary = useCorridorStore((s) => s.horizontal);
  useEffect(() => {
    publishVertical({
      curveClass,
      pvcStationFt,
      pviStationFt: results.pviStationFt,
      pvtStationFt: results.pvtStationFt,
      highLowStationFt: results.extremaStationFt,
      meetsKMin: results.meetsKMin,
      structurePass: results.structureCheck ? results.structureCheck.pass : null,
    });
  }, [curveClass, pvcStationFt, results.pviStationFt, results.pvtStationFt, results.extremaStationFt, results.meetsKMin, results.structureCheck, publishVertical]);

  const steps: CalcStep[] = [
    {
      label: "Algebraic Grade Difference",
      formula: "A = |g1 − g2|",
      substitution: `A = |${g1Percent} − ${g2Percent}|`,
      result: `${fmt(results.A, 2)}%`,
    },
    {
      label: `Minimum K-Factor (${curveClass === "crest" ? "Crest, SSD" : "Sag, headlight"})`,
      reference: "AASHTO Green Book K-factor design table",
      formula: "K_min = interp(V)",
      substitution: `V = ${designSpeedMph} mph`,
      result: fmt(results.kMin, 1),
    },
    {
      label: "Curve Length",
      formula: lengthMode === "auto" ? "L = K_min · A" : "L = user-specified",
      substitution: lengthMode === "auto" ? `L = ${fmt(results.kMin, 1)} · ${fmt(results.A, 2)}` : `L = ${manualLengthFt} ft`,
      result: `${fmt(results.lengthFt, 1)} ft`,
    },
    {
      label: "K-Factor Compliance Check",
      formula: "K = L / A  ≥  K_min ?",
      substitution: `K = ${fmt(results.lengthFt, 1)} / ${fmt(results.A, 2)} = ${fmt(results.K, 1)}`,
      result: results.meetsKMin ? "PASS" : "FAIL — below AASHTO minimum",
    },
    {
      label: "PVI Station & Elevation",
      formula: "PVI = PVC + L/2",
      substitution: `${formatStation(pvcStationFt, unitSystem)} + ${fmt(results.lengthFt / 2, 1)} ft`,
      result: `STA ${formatStation(results.pviStationFt, unitSystem)}, EL ${fmt(results.pviElevationFt, 2)} ft`,
    },
    {
      label: "PVT Station & Elevation",
      formula: "PVT = PVC + L",
      substitution: `${formatStation(pvcStationFt, unitSystem)} + ${fmt(results.lengthFt, 1)} ft`,
      result: `STA ${formatStation(results.pvtStationFt, unitSystem)}, EL ${fmt(results.pvtElevationFt, 2)} ft`,
    },
    {
      label: "Curve Elevation Equation",
      formula: "y(x) = Elev_PVC + g1·x + [(g2−g1)/(2L)]·x²",
      substitution: `g1=${g1Percent}%, g2=${g2Percent}%, L=${fmt(results.lengthFt, 1)} ft`,
      result: "Evaluated continuously — see canvas",
    },
    {
      label: results.extremaStationFt != null ? `${curveClass === "crest" ? "High" : "Low"} Point` : "Turning Point",
      formula: "x_ext = −g1·L / (g2−g1)",
      substitution:
        results.extremaStationFt != null
          ? `x_ext = −${g1Percent}·${fmt(results.lengthFt, 1)} / (${g2Percent}−${g1Percent})`
          : "No interior extremum (monotonic grade)",
      result:
        results.extremaStationFt != null
          ? `STA ${formatStation(results.extremaStationFt, unitSystem)}, EL ${fmt(results.extremaElevationFt ?? 0, 2)} ft`
          : "N/A",
    },
    {
      label: "Stopping Sight Distance (level)",
      reference: "AASHTO Green Book Eq. 3-2",
      formula: "SSD = 1.47·V·t + V²/[30(a/32.2)]",
      substitution: `V=${designSpeedMph} mph, t=2.5s, a=11.2 ft/s²`,
      result: `${fmt(results.ssdMinFt, 1)} ft`,
    },
    ...(results.structureCheck
      ? [
          {
            label: "Overhead Structure Clearance (governing)",
            formula: "Clearance = Girder_Elev − Road_Elev, min(near, CL, far)",
            substitution: `Girder EL ${girderElevationFt} ft, road profile sampled across ${structureWidthFt} ft footprint`,
            result: `${fmt(results.structureCheck.governingClearanceFt, 2)} ft vs req. ${requiredClearanceFt} ft — ${
              results.structureCheck.pass ? `surplus ${fmt(results.structureCheck.governingClearanceFt - requiredClearanceFt, 2)} ft` : `DEFICIT ${fmt(requiredClearanceFt - results.structureCheck.governingClearanceFt, 2)} ft`
            }`,
          },
        ]
      : []),
    ...(curveClass === "sag" && sagCurbedUrban
      ? [
          {
            label: "Drainage / Flatness Check (curbed urban sag)",
            formula: "K ≤ 167",
            substitution: `K = ${fmt(results.K, 1)}`,
            result: results.meetsDrainageFlatness ? "PASS" : "FAIL — ponding risk",
          },
        ]
      : []),
  ];

  async function handleExportMemo() {
    const img = captureCanvasImage(findCanvas(canvasContainerRef.current), "Vertical Curve Coordinate Canvas");

    generateMemoPdf({
      moduleTitle: `Vertical Alignment — ${curveClass === "crest" ? "Crest" : "Sag"} Curve`,
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: formatStation(pvcStationFt, unitSystem),
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images: img ? [img] : [],
      inputs: [
        { label: "Curve class", value: curveClass },
        { label: "PVC station", value: formatStation(pvcStationFt, unitSystem) },
        { label: "PVC elevation", value: `${pvcElevationFt} ft` },
        { label: "g1", value: `${g1Percent}%` },
        { label: "g2", value: `${g2Percent}%` },
        { label: "Length mode", value: lengthMode },
        { label: "Length used", value: `${fmt(results.lengthFt, 1)} ft` },
        { label: "Structure present", value: hasStructure ? "Yes" : "No" },
      ],
      steps: steps.map((s) => ({ ...s })),
      verdicts: [
        { label: "K-Factor Compliance", status: results.meetsKMin ? "PASS" : "FAIL", detail: `K=${fmt(results.K, 1)} vs K_min=${fmt(results.kMin, 1)}` },
        ...(results.structureCheck
          ? [{ label: "Overhead Clearance" as const, status: (results.structureCheck.pass ? "PASS" : "FAIL") as "PASS" | "FAIL", detail: `${fmt(results.structureCheck.governingClearanceFt, 2)} ft vs req. ${requiredClearanceFt} ft` }]
          : []),
      ],
    });
  }

  function handleExportCsv() {
    const rows: (string | number)[][] = [["Station", "Elevation_ft", "Slope_pct"]];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const st = pvcStationFt + (i / n) * results.lengthFt;
      rows.push([formatStation(st, unitSystem), fmt(results.elevationAt(st), 3), fmt(results.slopeAt(st), 3)]);
    }
    downloadCsv(rows, `vertical_alignment_${Date.now()}.csv`);
  }

  return (
    <ModuleShell
      moduleTag="VERTICAL ALIGNMENT"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Curve Geometry</SectionLabel>
          <ToggleGroup
            label="Curve Class"
            value={curveClass}
            onChange={setCurveClass}
            options={[
              { value: "crest", label: "Crest" },
              { value: "sag", label: "Sag" },
            ]}
          />
          <NumberField label="PVC Station" value={pvcStationFt} step={10} onChange={setPvcStationFt} unit="ft" />
          {horizontalSummary && (
            <button
              onClick={() => setPvcStationFt(horizontalSummary.scStationFt)}
              className="flex items-center gap-1.5 rounded-sm border border-cyan/30 bg-cyan/5 px-2 py-1.5 text-left text-[10px] text-cyan hover:bg-cyan/10"
            >
              <Link2 size={11} className="shrink-0" />
              Sync PVC to Horizontal SC (STA {formatStation(horizontalSummary.scStationFt, unitSystem)})
            </button>
          )}
          <NumberField label="PVC Elevation" value={pvcElevationFt} step={0.1} onChange={setPvcElevationFt} unit="ft" />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Grade g1" value={g1Percent} step={0.1} min={-15} max={15} onChange={setG1} unit="%" error={validation.errors.g1Percent} />
            <NumberField label="Grade g2" value={g2Percent} step={0.1} min={-15} max={15} onChange={setG2} unit="%" error={validation.errors.g2Percent} />
          </div>
          <ToggleGroup
            label="Curve Length Mode"
            value={lengthMode}
            onChange={setLengthMode}
            options={[
              { value: "auto", label: "Auto (K_min)" },
              { value: "manual", label: "Manual" },
            ]}
          />
          {lengthMode === "manual" && (
            <NumberField
              label="Curve Length L"
              value={manualLengthFt}
              step={10}
              onChange={setManualLengthFt}
              unit="ft"
              error={validation.errors.manualLengthFt}
            />
          )}
          {curveClass === "sag" && (
            <label className="flex items-center gap-2 text-[11px] text-text-secondary">
              <input type="checkbox" checked={sagCurbedUrban} onChange={(e) => setSagCurbedUrban(e.target.checked)} />
              Curbed urban section (K ≤ 167 check)
            </label>
          )}

          <SectionLabel>Overhead Obstruction</SectionLabel>
          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <input type="checkbox" checked={hasStructure} onChange={(e) => setHasStructure(e.target.checked)} />
            Critical structure present
          </label>
          {hasStructure && (
            <>
              <NumberField label="Structure Station" value={structureStationFt} step={10} onChange={setStructureStationFt} unit="ft" />
              <NumberField label="Girder / Low Flange Elev." value={girderElevationFt} step={0.1} onChange={setGirderElevationFt} unit="ft" />
              <NumberField label="Structure Width" value={structureWidthFt} step={1} onChange={setStructureWidthFt} unit="ft" />
              <NumberField label="Required Clearance" value={requiredClearanceFt} step={0.25} onChange={setRequiredClearanceFt} unit="ft" />
            </>
          )}
        </div>
      }
    >
      <div className="grid h-full grid-cols-[300px_1fr] gap-3">
        <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={kStatus} label={results.meetsKMin ? "K ≥ K_MIN — CONFORMING" : "K < K_MIN — VIOLATION"} />
            {hasStructure && (
              <StatusPill status={clearanceStatus} label={results.structureCheck?.pass ? "CLEARANCE OK" : "CLEARANCE DEFICIT"} />
            )}
          </div>
          {hasStructure && results.structureCheck ? (
            <HeroMetric
              label="Governing Overhead Clearance"
              value={fmt(results.structureCheck.governingClearanceFt, 2)}
              unit="ft"
              status={clearanceStatus}
              comparison={`vs required ${requiredClearanceFt} ft`}
            />
          ) : (
            <HeroMetric
              label="Provided K-Factor"
              value={fmt(results.K, 1)}
              status={kStatus}
              comparison={`vs K_min = ${fmt(results.kMin, 1)}`}
            />
          )}
          <ValidationBanner errors={validation.errors} />
          <Panel title="Vertical Curve Engineering Ledger">
            <LedgerRow label="Algebraic Diff. A" value={fmt(results.A, 2)} unit="%" />
            <LedgerRow label="K_min (AASHTO)" value={fmt(results.kMin, 1)} />
            <LedgerRow label="Length L" value={fmt(toDisp(results.lengthFt), 1)} unit={unitLen} />
            <LedgerRow label="K (provided)" value={fmt(results.K, 1)} status={kStatus} />
            <LedgerRow label="PVI Station" value={formatStation(results.pviStationFt, unitSystem)} />
            <LedgerRow label="PVI Elevation" value={fmt(toDisp(results.pviElevationFt), 2)} unit={unitLen} />
            <LedgerRow label="PVT Station" value={formatStation(results.pvtStationFt, unitSystem)} />
            <LedgerRow label="PVT Elevation" value={fmt(toDisp(results.pvtElevationFt), 2)} unit={unitLen} />
            <LedgerRow
              label={curveClass === "crest" ? "High Point" : "Low Point"}
              value={results.extremaStationFt != null ? formatStation(results.extremaStationFt, unitSystem) : "N/A"}
              status="ok"
            />
            <LedgerRow label="SSD (level)" value={fmt(toDisp(results.ssdMinFt), 1)} unit={unitLen} />
            {curveClass === "sag" && sagCurbedUrban && (
              <LedgerRow label="Drainage Flatness (K≤167)" value={results.meetsDrainageFlatness ? "PASS" : "FAIL"} status={drainageStatus} />
            )}
            {results.structureCheck && (
              <>
                <LedgerRow label="Clearance — Near Edge" value={fmt(results.structureCheck.nearEdge.clearanceFt, 2)} unit="ft" />
                <LedgerRow label="Clearance — Centerline" value={fmt(results.structureCheck.centerline.clearanceFt, 2)} unit="ft" />
                <LedgerRow label="Clearance — Far Edge" value={fmt(results.structureCheck.farEdge.clearanceFt, 2)} unit="ft" />
                <LedgerRow
                  label="Governing Clearance"
                  value={fmt(results.structureCheck.governingClearanceFt, 2)}
                  unit="ft"
                  status={clearanceStatus}
                />
              </>
            )}
          </Panel>
        </div>

        <Panel title="Vertical Curve Coordinate Canvas" className="min-h-0 flex-1">
          <div ref={canvasContainerRef} className="h-full w-full rounded-sm border border-border-hairline engineering-grid">
            <ErrorBoundary label="Vertical Curve Canvas">
              <VerticalCurveCanvas
                results={results}
                pvcStationFt={pvcStationFt}
                pvcElevationFt={pvcElevationFt}
                pvtStationFt={results.pvtStationFt}
                pvtElevationFt={results.pvtElevationFt}
                g1={g1Percent}
                g2={g2Percent}
                ssdFt={results.ssdMinFt}
                structure={inputs.structure}
                unitSystem={unitSystem}
              />
            </ErrorBoundary>
          </div>
        </Panel>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Vertical Alignment" steps={steps} />
    </ModuleShell>
  );
}
