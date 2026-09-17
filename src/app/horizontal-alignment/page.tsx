"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, FileDown } from "lucide-react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, SelectField, ToggleGroup, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, StatusPill, Panel, ValidationBanner, HeroMetric } from "@/components/ui/Ledger";
import { horizontalSchema } from "@/lib/schemas/horizontal";
import { validateInputs } from "@/lib/validation";
import { usePersistedForm } from "@/lib/persistence";
import CrossSectionCanvas from "@/components/canvas/CrossSectionCanvas";
import SuperelevationDiagram from "@/components/charts/SuperelevationDiagram";
import SightDistancePlanView from "@/components/canvas/SightDistancePlanView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS, type DesignVehicle } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { computeHorizontal, type HorizontalInputs } from "@/lib/engineering/horizontal";
import { slopesAtOffset } from "@/lib/engineering/superelevationProfile";
import { computeAlignmentGeometry, type AlignmentParams } from "@/lib/engineering/alignmentGeometry";
import { fmt, formatStation, ftToM } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv, downloadDxf } from "@/lib/export/download";
import { downloadAlignmentDxf, downloadLandXml } from "@/lib/export/alignmentExport";
import { captureCanvasImage, captureSvgImage, findCanvas, findSvg } from "@/lib/export/captureImage";

const AlignmentViewer3D = dynamic(() => import("@/components/canvas/AlignmentViewer3D"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[10px] text-text-tertiary">LOADING 3D VIEWER…</div>,
});

export default function HorizontalAlignmentPage() {
  const {
    corridorName,
    unitSystem,
    designSpeedMph,
    designVehicle,
    setDesignVehicle,
    designStandard,
    stationStart,
  } = useProjectStore();

  const crossSectionRef = useRef<HTMLDivElement>(null);
  const superelevationRef = useRef<HTMLDivElement>(null);

  const [lanesPerDirection, setLanes] = useState(2);
  const [laneWidthFt, setLaneWidthFt] = useState<10 | 11 | 12>(12);
  const [shoulderInsideFt, setShoulderInsideFt] = useState(4);
  const [shoulderOutsideFt, setShoulderOutsideFt] = useState(8);
  const [eNCPercent, setENCPercent] = useState(-2.0);
  const [eMaxPercent, setEMaxPercent] = useState<4 | 6 | 8 | 10 | 12>(6);
  const [axisOfRotation, setAxisOfRotation] = useState<HorizontalInputs["axisOfRotation"]>("centerline");
  const [lateralAccelC, setLateralAccelC] = useState(1.5);
  const [transitionType, setTransitionType] = useState<HorizontalInputs["transitionType"]>("spiral");
  const [curveRadiusFt, setCurveRadiusFt] = useState(1500);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [offsetFt, setOffsetFt] = useState(0);

  // Geometry-only inputs for the 3D viewer / DXF / LandXML / sight-distance
  // overlay: a radius alone doesn't determine a full curve (also needs a
  // central angle) or 3D shape (also needs lead tangents, elevation, grade).
  // Scoped to geometry/visualization/export — none of these feed the
  // superelevation engineering ledger above.
  const [deflectionAngleDeg, setDeflectionAngleDeg] = useState(40);
  const [turnDirection, setTurnDirection] = useState<AlignmentParams["turnDirection"]>("right");
  const [leadTangentFt, setLeadTangentFt] = useState(300);
  const [startElevationFt, setStartElevationFt] = useState(500);
  const [gradePercent, setGradePercent] = useState(0);
  const [verticalExaggeration, setVerticalExaggeration] = useState(8);
  const [actualClearanceFt, setActualClearanceFt] = useState(20);

  usePersistedForm(
    "highwaylab.horizontal-alignment",
    { lanesPerDirection, laneWidthFt, shoulderInsideFt, shoulderOutsideFt, eNCPercent, eMaxPercent, axisOfRotation, lateralAccelC, transitionType, curveRadiusFt, deflectionAngleDeg, turnDirection, leadTangentFt, startElevationFt, gradePercent, actualClearanceFt },
    { lanesPerDirection: setLanes, laneWidthFt: setLaneWidthFt, shoulderInsideFt: setShoulderInsideFt, shoulderOutsideFt: setShoulderOutsideFt, eNCPercent: setENCPercent, eMaxPercent: setEMaxPercent, axisOfRotation: setAxisOfRotation, lateralAccelC: setLateralAccelC, transitionType: setTransitionType, curveRadiusFt: setCurveRadiusFt, deflectionAngleDeg: setDeflectionAngleDeg, turnDirection: setTurnDirection, leadTangentFt: setLeadTangentFt, startElevationFt: setStartElevationFt, gradePercent: setGradePercent, actualClearanceFt: setActualClearanceFt }
  );

  const inputs: HorizontalInputs = {
    designSpeedMph,
    designVehicle,
    lanesPerDirection,
    laneWidthFt,
    shoulderInsideFt,
    shoulderOutsideFt,
    eNCPercent,
    eMaxPercent,
    axisOfRotation,
    lateralAccelC,
    transitionType,
    curveRadiusFt,
  };

  const results = useMemo(() => computeHorizontal(inputs), [JSON.stringify(inputs)]);
  const validation = useMemo(() => validateInputs(horizontalSchema, inputs), [JSON.stringify(inputs)]);

  const totalTransitionFt = results.totalTransitionFt;
  const geometry = {
    tangentRunoutFt: results.tangentRunoutFt,
    superelevationRunoffFt: results.superelevationRunoffFt,
    eNCPercent,
    eDesignPercent: results.eDesignPercent,
  };

  const pavementWidthFt = lanesPerDirection * laneWidthFt;
  const alignmentParams: AlignmentParams = {
    curveRadiusFt,
    geometricSpiralLengthFt: Math.max(results.spiralLengthMinFt, results.superelevationRunoffFt),
    deflectionAngleDeg,
    turnDirection,
    crossSlope: geometry,
    leadTangentFt,
    pavementWidthFt,
    shoulderWidthFt: shoulderOutsideFt,
    startElevationFt,
    gradePercent,
    startStationFt: stationStart,
  };
  const alignmentResult = useMemo(() => computeAlignmentGeometry(alignmentParams), [JSON.stringify(alignmentParams)]);

  const radiusStatus = results.meetsRMin ? "ok" : "fail";
  const sightDistanceViolation = actualClearanceFt < results.middleOrdinateFt;
  const wideningStatus = results.widening.applicable
    ? results.widening.wcFt - lanesPerDirection * laneWidthFt > 0.05
      ? "warn"
      : "ok"
    : "neutral";

  const unitLen = unitSystem === "us" ? "ft" : "m";
  const toDisp = (ft: number) => (unitSystem === "us" ? ft : ftToM(ft));

  const publishHorizontal = useCorridorStore((s) => s.publishHorizontal);
  useEffect(() => {
    publishHorizontal({
      curveRadiusFt,
      tsStationFt: stationStart,
      scStationFt: stationStart + totalTransitionFt,
      eDesignPercent: results.eDesignPercent,
      meetsRMin: results.meetsRMin,
      designSpeedMph,
      pavementWidthFt: lanesPerDirection * laneWidthFt,
    });
  }, [curveRadiusFt, stationStart, totalTransitionFt, results.eDesignPercent, results.meetsRMin, designSpeedMph, lanesPerDirection, laneWidthFt, publishHorizontal]);

  const steps: CalcStep[] = [
    {
      label: "Maximum Side Friction Factor f_max(V)",
      reference: "AASHTO Green Book — side friction design curve",
      formula: "f_max = interp(V)",
      substitution: `V = ${designSpeedMph} mph`,
      result: fmt(results.fMax, 3),
    },
    {
      label: "Minimum Radius for e_max",
      reference: "AASHTO Green Book Eq. 3-8 (US)",
      formula: "R_min = V² / [15(0.01·e_max + f_max)]",
      substitution: `R_min = ${designSpeedMph}² / [15(0.01·${eMaxPercent} + ${fmt(results.fMax, 3)})]`,
      result: `${fmt(results.rMinFt, 1)} ft`,
    },
    {
      label: "Curve Radius Compliance Check",
      formula: "R_selected ≥ R_min ?",
      substitution: `${fmt(curveRadiusFt, 1)} ft vs ${fmt(results.rMinFt, 1)} ft`,
      result: results.meetsRMin ? "PASS" : "FAIL — Non-Conforming",
    },
    {
      label: "AASHTO Method 5 Design Superelevation",
      reference: "Empirical curve-fit approximation of AASHTO Method 5",
      formula: "e_d = e_max·[(1/R − 1/R₀)/(1/R_min − 1/R₀)]^1.5",
      substitution: `R = ${fmt(curveRadiusFt, 0)} ft`,
      result: `${fmt(results.eDesignPercent, 1)}%`,
      confidence: "approximated",
    },
    {
      label: "Multi-lane Adjustment Factor",
      reference: "AASHTO Table — lanes rotated w_l",
      formula: "w_l = interp(lanes rotated)",
      substitution: `lanes rotated = ${results.lanesRotated}`,
      result: fmt(results.wl, 2),
    },
    {
      label: "Tangent Runout Length",
      formula: "L_t = (W_rotated · |e_NC|) / Δmax",
      substitution: `L_t = (${fmt(results.wRotatedFt, 1)} · ${Math.abs(eNCPercent)}) / ${fmt(results.deltaMaxPct, 2)}`,
      result: `${fmt(results.tangentRunoutFt, 1)} ft`,
    },
    {
      label: "Superelevation Runoff Length",
      formula: "L_r = (w_l · W_rotated · e_design) / Δmax",
      substitution: `L_r = (${fmt(results.wl, 2)} · ${fmt(results.wRotatedFt, 1)} · ${fmt(results.eDesignPercent, 1)}) / ${fmt(results.deltaMaxPct, 2)}`,
      result: `${fmt(results.superelevationRunoffFt, 1)} ft`,
    },
    {
      label: "Minimum Spiral Length (Barnett / comfort)",
      reference: "AASHTO / Barnett formula, C=" + lateralAccelC + " ft/s³",
      formula: "L_s,min = 1.6·V³ / (R·C)",
      substitution: `L_s,min = 1.6·${designSpeedMph}³ / (${fmt(curveRadiusFt, 0)}·${lateralAccelC})`,
      result: `${fmt(results.spiralLengthMinFt, 1)} ft`,
    },
    {
      label: "Clothoid Spiral Parameter",
      formula: "A = √(L_s · R)",
      substitution: `A = √(${fmt(Math.max(results.spiralLengthMinFt, results.superelevationRunoffFt), 1)} · ${fmt(curveRadiusFt, 0)})`,
      result: fmt(results.spiralParameterA, 1),
    },
    {
      label: "Stopping Sight Distance",
      reference: "AASHTO Green Book Eq. 3-2, t=2.5s, a=11.2 ft/s²",
      formula: "SSD = 1.47·V·t + V²/[30(a/32.2)]",
      substitution: `SSD = 1.47·${designSpeedMph}·2.5 + ${designSpeedMph}²/[30(11.2/32.2)]`,
      result: `${fmt(results.ssdFt, 1)} ft`,
    },
    {
      label: "Horizontal Sightline Offset (Middle Ordinate)",
      formula: "M = R·[1 − cos(28.65·SSD/R)]",
      substitution: `M = ${fmt(curveRadiusFt, 0)}·[1 − cos(28.65·${fmt(results.ssdFt, 1)}/${fmt(curveRadiusFt, 0)})]`,
      result: `${fmt(results.middleOrdinateFt, 2)} ft`,
    },
    {
      label: "Mechanical Pavement Widening",
      reference: `Design vehicle: ${designVehicle}, wheelbase ${fmt(results.widening.wheelbaseFt, 1)} ft`,
      formula: "Wc = N·W + c + (R − √(R² − L²)) + Z,  Z = V/(9.5√R)",
      substitution: results.widening.applicable
        ? `Wc = ${lanesPerDirection}·${laneWidthFt} + 2.0 + ${fmt(results.widening.trackShiftFt, 3)} + ${fmt(results.widening.z, 3)}`
        : "Not applicable — R exceeds widening threshold or vehicle wheelbase too short",
      result: results.widening.applicable ? `${fmt(results.widening.wcFt, 2)} ft` : "N/A",
    },
  ];

  async function handleExportMemo() {
    const images = (
      await Promise.all([
        Promise.resolve(captureCanvasImage(findCanvas(crossSectionRef.current), "Station-by-Station Cross-Section Visualizer")),
        captureSvgImage(findSvg(superelevationRef.current), "Plan & Superelevation Elevation Diagram"),
      ])
    ).filter((img): img is NonNullable<typeof img> => img !== null);

    generateMemoPdf({
      moduleTitle: "Horizontal Alignment & Superelevation Transition",
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: formatStation(stationStart, unitSystem),
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images,
      inputs: [
        { label: "Lanes / direction", value: String(lanesPerDirection) },
        { label: "Lane width", value: `${laneWidthFt} ft` },
        { label: "Shoulder (in/out)", value: `${shoulderInsideFt} / ${shoulderOutsideFt} ft` },
        { label: "Normal crown e_NC", value: `${eNCPercent}%` },
        { label: "e_max policy", value: `${eMaxPercent}%` },
        { label: "Axis of rotation", value: axisOfRotation },
        { label: "Transition type", value: transitionType },
        { label: "Selected radius R", value: `${curveRadiusFt} ft` },
        { label: "Lateral accel. C", value: `${lateralAccelC} ft/s³` },
      ],
      steps,
      verdicts: [
        {
          label: "Minimum Radius Compliance",
          status: results.meetsRMin ? "PASS" : "FAIL",
          detail: `R = ${fmt(curveRadiusFt, 1)} ft vs R_min = ${fmt(results.rMinFt, 1)} ft`,
        },
        {
          label: "Pavement Widening",
          status: results.widening.applicable && wideningStatus === "warn" ? "WARN" : "PASS",
          detail: results.widening.applicable
            ? `Widened section Wc = ${fmt(results.widening.wcFt, 2)} ft`
            : "Not required at this radius / vehicle class",
        },
      ],
    });
  }

  function handleExportCsv() {
    const rows: (string | number)[][] = [
      ["Station", "Offset_from_TS_ft", "LowSide_%", "HighSide_%", "LEP_Elev_ft", "REP_Elev_ft"],
    ];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * totalTransitionFt;
      const pavementWidth = lanesPerDirection * laneWidthFt;
      const s = slopesAtOffset(x, geometry);
      rows.push([
        formatStation(stationStart + x, unitSystem),
        fmt(x, 2),
        fmt(s.lowSidePercent, 3),
        fmt(s.highSidePercent, 3),
        fmt(100 - (pavementWidth * s.lowSidePercent) / 100, 3),
        fmt(100 + (pavementWidth * s.highSidePercent) / 100, 3),
      ]);
    }
    downloadCsv(rows, `horizontal_alignment_stationing_${Date.now()}.csv`);
    downloadDxf(
      rows.slice(1).map((r, i) => ({ x: i * (totalTransitionFt / n), y: Number(r[4]), label: String(r[0]) })),
      `horizontal_alignment_${Date.now()}.dxf`
    );
  }

  return (
    <ModuleShell
      moduleTag="HORIZONTAL ALIGNMENT"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Normal Cross Section</SectionLabel>
          <NumberField
            label="Lanes per Direction"
            value={lanesPerDirection}
            min={1}
            max={6}
            step={1}
            onChange={setLanes}
            error={validation.errors.lanesPerDirection}
          />
          <SelectField
            label="Lane Width"
            value={String(laneWidthFt) as "10" | "11" | "12"}
            onChange={(v) => setLaneWidthFt(Number(v) as 10 | 11 | 12)}
            options={[
              { value: "10", label: "10 ft" },
              { value: "11", label: "11 ft" },
              { value: "12", label: "12 ft" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Shoulder — Inside" value={shoulderInsideFt} min={2} max={12} onChange={setShoulderInsideFt} unit="ft" error={validation.errors.shoulderInsideFt} />
            <NumberField label="Shoulder — Outside" value={shoulderOutsideFt} min={2} max={12} onChange={setShoulderOutsideFt} unit="ft" error={validation.errors.shoulderOutsideFt} />
          </div>
          <NumberField label="Normal Crown e_NC" value={eNCPercent} min={-3} max={0} step={0.1} onChange={setENCPercent} unit="%" error={validation.errors.eNCPercent} />

          <SectionLabel>Superelevation Policy</SectionLabel>
          <SelectField
            label="e_max Distribution Table"
            value={String(eMaxPercent) as "4" | "6" | "8" | "10" | "12"}
            onChange={(v) => setEMaxPercent(Number(v) as 4 | 6 | 8 | 10 | 12)}
            options={["4", "6", "8", "10", "12"].map((v) => ({ value: v as "4", label: `${v}%` }))}
          />
          <ToggleGroup
            label="Axis of Rotation"
            value={axisOfRotation}
            onChange={setAxisOfRotation}
            options={[
              { value: "centerline", label: "CL" },
              { value: "inside-edge", label: "In. Edge" },
              { value: "outside-edge", label: "Out. Edge" },
            ]}
          />
          <NumberField label="Lateral Accel. Rate (C)" value={lateralAccelC} min={1} max={3} step={0.1} onChange={setLateralAccelC} unit="ft/s³" error={validation.errors.lateralAccelC} />

          <SectionLabel>Curve & Transition</SectionLabel>
          <ToggleGroup
            label="Transition Curve Type"
            value={transitionType}
            onChange={setTransitionType}
            options={[
              { value: "spiral", label: "Clothoid Spiral" },
              { value: "linear", label: "Linear T-to-C" },
            ]}
          />
          <NumberField
            label="Selected Curve Radius R"
            value={curveRadiusFt}
            min={50}
            max={50000}
            step={10}
            onChange={setCurveRadiusFt}
            unit="ft"
            error={validation.errors.curveRadiusFt}
          />

          <SectionLabel>Design Vehicle</SectionLabel>
          <SelectField
            label="Classification (AASHTO)"
            value={designVehicle}
            onChange={(v) => setDesignVehicle(v as DesignVehicle)}
            options={Object.entries(DESIGN_VEHICLE_LABELS).map(([k, v]) => ({ value: k as DesignVehicle, label: v }))}
          />

          <SectionLabel>3D / Export Geometry</SectionLabel>
          <NumberField label="Deflection Angle Δ" value={deflectionAngleDeg} min={0} max={180} step={1} onChange={setDeflectionAngleDeg} unit="deg" />
          <ToggleGroup
            label="Turn Direction"
            value={turnDirection}
            onChange={setTurnDirection}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
          <NumberField label="Lead Tangent" value={leadTangentFt} min={0} max={5000} step={50} onChange={setLeadTangentFt} unit="ft" />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Start Elevation" value={startElevationFt} step={10} onChange={setStartElevationFt} unit="ft" />
            <NumberField label="Grade" value={gradePercent} min={-10} max={10} step={0.1} onChange={setGradePercent} unit="%" />
          </div>
          <NumberField label="3D Vertical Exaggeration" value={verticalExaggeration} min={1} max={30} step={1} onChange={setVerticalExaggeration} unit="×" />

          <SectionLabel>Sight Distance Overlay</SectionLabel>
          <NumberField
            label="Actual Obstruction Clearance"
            value={actualClearanceFt}
            min={0}
            max={500}
            step={1}
            onChange={setActualClearanceFt}
            unit="ft"
          />
        </div>
      }
    >
      <div className="grid h-full grid-cols-[300px_1fr] gap-3">
        <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <StatusPill status={radiusStatus} label={results.meetsRMin ? "R ≥ R_MIN — CONFORMING" : "R < R_MIN — VIOLATION"} />
          </div>
          <HeroMetric
            label="Selected Curve Radius"
            value={fmt(toDisp(curveRadiusFt), 1)}
            unit={unitLen}
            status={radiusStatus}
            comparison={`vs R_min = ${fmt(toDisp(results.rMinFt), 1)} ${unitLen}`}
          />
          <ValidationBanner errors={validation.errors} />
          <Panel title="Superelevation Engineering Ledger">
            <LedgerRow label="f_max(V)" value={fmt(results.fMax, 3)} />
            <LedgerRow label="Δmax (relative gradient)" value={fmt(results.deltaMaxPct, 2)} unit="%" />
            <LedgerRow label="R_min (e_max)" value={fmt(toDisp(results.rMinFt), 1)} unit={unitLen} status={radiusStatus === "fail" ? "fail" : "ok"} />
            <LedgerRow label="Selected R" value={fmt(toDisp(curveRadiusFt), 1)} unit={unitLen} />
            <LedgerRow
              label="e_design"
              value={fmt(results.eDesignPercent, 1)}
              unit="%"
              status="ok"
              approx="Approximated via a curve-fit of AASHTO Method 5's qualitative shape — not a digitization of the published Green Book exhibit tables. See Calculation Proof."
            />
            <LedgerRow label="w_l multi-lane factor" value={fmt(results.wl, 2)} />
            <LedgerRow label="Tangent Runout L_t" value={fmt(toDisp(results.tangentRunoutFt), 1)} unit={unitLen} />
            <LedgerRow label="Superelevation Runoff L_r" value={fmt(toDisp(results.superelevationRunoffFt), 1)} unit={unitLen} />
            <LedgerRow label="Total Transition Length" value={fmt(toDisp(totalTransitionFt), 1)} unit={unitLen} status="ok" />
            <LedgerRow label="Min. Spiral Length L_s" value={fmt(toDisp(results.spiralLengthMinFt), 1)} unit={unitLen} />
            <LedgerRow label="Spiral Parameter A" value={fmt(results.spiralParameterA, 1)} />
            <LedgerRow label="SSD" value={fmt(toDisp(results.ssdFt), 1)} unit={unitLen} />
            <LedgerRow label="Middle Ordinate (HSO)" value={fmt(toDisp(results.middleOrdinateFt), 2)} unit={unitLen} />
            <LedgerRow
              label="Widened Section Wc"
              value={results.widening.applicable ? fmt(toDisp(results.widening.wcFt), 2) : "N/A"}
              unit={results.widening.applicable ? unitLen : undefined}
              status={wideningStatus}
            />
          </Panel>
        </div>

        <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
          <Panel
            title="Station-by-Station Cross-Section Visualizer"
            className="h-[380px]"
            actions={<span className="text-[10px] text-text-tertiary tabular-nums">STA {formatStation(stationStart + offsetFt, unitSystem)}</span>}
          >
            <div className="flex h-full flex-col gap-2">
              <div ref={crossSectionRef} className="min-h-0 flex-1 rounded-sm border border-border-hairline engineering-grid">
                <ErrorBoundary label="Cross-Section Visualizer">
                  <CrossSectionCanvas
                    offsetFt={offsetFt}
                    geometry={geometry}
                    lanesPerDirection={lanesPerDirection}
                    laneWidthFt={laneWidthFt}
                    shoulderInsideFt={shoulderInsideFt}
                    shoulderOutsideFt={shoulderOutsideFt}
                  />
                </ErrorBoundary>
              </div>
              <input
                type="range"
                aria-label="Station offset along the superelevation transition"
                min={0}
                max={Math.max(totalTransitionFt, 1)}
                step={totalTransitionFt / 200 || 1}
                value={offsetFt}
                onChange={(e) => setOffsetFt(Number(e.target.value))}
                className="w-full accent-cyan"
              />
              <div className="flex justify-between text-[10px] text-text-tertiary">
                <span>TS (0+00)</span>
                <span>SC — Full Superelevation ({fmt(toDisp(totalTransitionFt), 0)} {unitLen})</span>
              </div>
            </div>
          </Panel>

          <Panel title="Plan & Superelevation Elevation Diagram" className="h-[320px]">
            <div ref={superelevationRef} className="h-full w-full">
            <ErrorBoundary label="Superelevation Diagram">
              <SuperelevationDiagram
                geometry={geometry}
                lanesPerDirection={lanesPerDirection}
                laneWidthFt={laneWidthFt}
                shoulderOutsideFt={shoulderOutsideFt}
                tsStationFt={stationStart}
                unitSystem={unitSystem}
                axisOfRotation={axisOfRotation}
              />
            </ErrorBoundary>
            </div>
          </Panel>

          <Panel
            title="3D Corridor Viewer"
            className="h-[420px]"
            actions={
              <div className="flex gap-1.5">
                <button
                  onClick={() => downloadAlignmentDxf(alignmentResult, alignmentParams, `horizontal_alignment_3d_${Date.now()}.dxf`)}
                  title="Real 3D POLYLINE entities (centerline + both edges of pavement) — not point clouds"
                  className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
                >
                  <Box size={11} /> DXF (3D POLYLINE)
                </button>
                <button
                  onClick={() =>
                    downloadLandXml(alignmentResult, alignmentParams, corridorName, stationStart, `horizontal_alignment_${Date.now()}.xml`)
                  }
                  title="LandXML 1.2 <Alignment>/<CoordGeom> — Line/Spiral/Curve elements"
                  className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-emerald/40 hover:text-emerald"
                >
                  <FileDown size={11} /> LandXML
                </button>
              </div>
            }
          >
            <ErrorBoundary label="3D Corridor Viewer">
              <AlignmentViewer3D result={alignmentResult} params={alignmentParams} verticalExaggeration={verticalExaggeration} />
            </ErrorBoundary>
            <p className="mt-1 text-[10px] text-text-tertiary">
              Low-poly visualization only — not CAD-accurate geometry. Vertical scale exaggerated {verticalExaggeration}× so grade and
              superelevation roll are visible; plan scale is true.
            </p>
          </Panel>

          <Panel
            title="Sight Distance Envelope Overlay"
            className="h-[380px]"
            actions={
              <StatusPill
                status={sightDistanceViolation ? "fail" : "ok"}
                label={
                  sightDistanceViolation
                    ? `ACTUAL OBSTRUCTION @ ${fmt(actualClearanceFt, 1)} ft — VIOLATION (need ${fmt(results.middleOrdinateFt, 1)} ft)`
                    : `ACTUAL OBSTRUCTION @ ${fmt(actualClearanceFt, 1)} ft — CLEAR (M = ${fmt(results.middleOrdinateFt, 1)} ft)`
                }
              />
            }
          >
            <ErrorBoundary label="Sight Distance Envelope Overlay">
              <SightDistancePlanView
                result={alignmentResult}
                curveRadiusFt={curveRadiusFt}
                middleOrdinateFt={results.middleOrdinateFt}
                ssdFt={results.ssdFt}
                turnDirection={turnDirection}
                pavementWidthFt={pavementWidthFt}
                actualClearanceFt={actualClearanceFt}
              />
            </ErrorBoundary>
          </Panel>
        </div>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Horizontal Alignment" steps={steps} />
    </ModuleShell>
  );
}
