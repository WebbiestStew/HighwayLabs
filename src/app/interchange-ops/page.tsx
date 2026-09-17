"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, SelectField, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, StatusPill, Panel, ValidationBanner, HeroMetric } from "@/components/ui/Ledger";
import { interchangeOpsSchema } from "@/lib/schemas/interchangeOps";
import { validateInputs } from "@/lib/validation";
import { usePersistedForm } from "@/lib/persistence";
import InterchangeSchematic from "@/components/canvas/InterchangeSchematic";
import QueueChart from "@/components/charts/QueueChart";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { captureCanvasImage, captureSvgImage, findCanvas, findSvg } from "@/lib/export/captureImage";
import { TOPOLOGIES, type TopologyId } from "@/lib/engineering/interchangeTopologies";
import {
  computeMergeDiverge,
  computeWeaving,
  computeRampTerminal,
  computeDD1Queue,
  type LOSGrade,
} from "@/lib/engineering/hcmOps";
import { fmt, formatStation } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv } from "@/lib/export/download";

export default function InterchangeOpsPageRoute() {
  return (
    <Suspense fallback={null}>
      <InterchangeOpsPage />
    </Suspense>
  );
}

function InterchangeOpsPage() {
  const { corridorName, unitSystem, designSpeedMph, designVehicle, designStandard, stationStart, stationEnd } = useProjectStore();
  const searchParams = useSearchParams();
  const schematicRef = useRef<HTMLDivElement>(null);
  const queueChartRef = useRef<HTMLDivElement>(null);

  const [topologyId, setTopologyId] = useState<TopologyId>("diamond");
  const [interchangeStationFt, setInterchangeStationFt] = useState((stationStart + stationEnd) / 2);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [rampDemandVph, setRampDemandVph] = useState(650);
  const [freewayUpstreamVph, setFreewayUpstreamVph] = useState(4200);
  const [freewayLanes, setFreewayLanes] = useState(4);
  const [accelLaneFt, setAccelLaneFt] = useState(720);
  const [phf, setPhf] = useState(0.92);
  const [heavyPct, setHeavyPct] = useState(8);
  const [pce, setPce] = useState(2.0);

  const [weaveVph, setWeaveVph] = useState(900);
  const [nonWeaveVph, setNonWeaveVph] = useState(3600);
  const [weaveLengthFt, setWeaveLengthFt] = useState(1500);
  const [minWeaveLanes, setMinWeaveLanes] = useState(2);
  const [totalWeaveLanes, setTotalWeaveLanes] = useState(4);
  const [rampFfs, setRampFfs] = useState(40);
  const [mainlineFfs, setMainlineFfs] = useState(65);

  const [criticalNS, setCriticalNS] = useState(780);
  const [satNS, setSatNS] = useState(1750);
  const [criticalEW, setCriticalEW] = useState(560);
  const [satEW, setSatEW] = useState(1700);
  const [numPhases, setNumPhases] = useState(3);
  const [lostTimePerPhase, setLostTimePerPhase] = useState(4);

  const [oversatDurationMin, setOversatDurationMin] = useState(20);
  const [postPeakVph, setPostPeakVph] = useState(1400);

  const mergeResults = useMemo(
    () =>
      computeMergeDiverge(
        {
          rampDemandVph,
          freewayUpstreamVph,
          freewayLanes,
          accelDecelLaneLengthFt: accelLaneFt,
          phf,
          heavyVehiclePercent: heavyPct,
          passengerCarEquivalent: pce,
          rampFfsMph: rampFfs,
          mainlineFfsMph: mainlineFfs,
        },
        "merge"
      ),
    [rampDemandVph, freewayUpstreamVph, freewayLanes, accelLaneFt, phf, heavyPct, pce, rampFfs, mainlineFfs]
  );

  const weavingResults = useMemo(
    () =>
      computeWeaving({
        weavingVolumeVph: weaveVph,
        nonWeavingVolumeVph: nonWeaveVph,
        weavingSegmentLengthFt: weaveLengthFt,
        minWeavingLanes: minWeaveLanes,
        totalLanes: totalWeaveLanes,
        freewayFfsMph: mainlineFfs,
        phf,
        heavyVehiclePercent: heavyPct,
        passengerCarEquivalent: pce,
      }),
    [weaveVph, nonWeaveVph, weaveLengthFt, minWeaveLanes, totalWeaveLanes, mainlineFfs, phf, heavyPct, pce]
  );

  const rampTerminalResults = useMemo(
    () =>
      computeRampTerminal({
        criticalMovements: [
          { name: "N-S Through/Left", volumeVph: criticalNS, saturationFlowVphpl: satNS },
          { name: "E-W Ramp Approach", volumeVph: criticalEW, saturationFlowVphpl: satEW },
        ],
        numberOfPhases: numPhases,
        lostTimePerPhaseSec: lostTimePerPhase,
      }),
    [criticalNS, satNS, criticalEW, satEW, numPhases, lostTimePerPhase]
  );

  const queueResults = useMemo(
    () =>
      computeDD1Queue({
        arrivalRateVph: criticalNS + criticalEW,
        saturationRateVph: satNS,
        oversaturatedDurationMin: oversatDurationMin,
        postPeakArrivalRateVph: postPeakVph,
      }),
    [criticalNS, criticalEW, satNS, oversatDurationMin, postPeakVph]
  );

  const rawInputs = {
    rampDemandVph, freewayUpstreamVph, freewayLanes, accelLaneFt, phf, heavyPct, pce,
    weaveVph, nonWeaveVph, weaveLengthFt, minWeaveLanes, totalWeaveLanes, rampFfs, mainlineFfs,
    criticalNS, satNS, criticalEW, satEW, numPhases, lostTimePerPhase,
    oversatDurationMin, postPeakVph,
  };
  const validation = useMemo(() => validateInputs(interchangeOpsSchema, rawInputs), [JSON.stringify(rawInputs)]);

  usePersistedForm(
    "highwaylab.interchange-ops",
    { topologyId, interchangeStationFt, ...rawInputs },
    {
      topologyId: setTopologyId,
      interchangeStationFt: setInterchangeStationFt,
      rampDemandVph: setRampDemandVph, freewayUpstreamVph: setFreewayUpstreamVph, freewayLanes: setFreewayLanes, accelLaneFt: setAccelLaneFt, phf: setPhf, heavyPct: setHeavyPct, pce: setPce,
      weaveVph: setWeaveVph, nonWeaveVph: setNonWeaveVph, weaveLengthFt: setWeaveLengthFt, minWeaveLanes: setMinWeaveLanes, totalWeaveLanes: setTotalWeaveLanes, rampFfs: setRampFfs, mainlineFfs: setMainlineFfs,
      criticalNS: setCriticalNS, satNS: setSatNS, criticalEW: setCriticalEW, satEW: setSatEW, numPhases: setNumPhases, lostTimePerPhase: setLostTimePerPhase,
      oversatDurationMin: setOversatDurationMin, postPeakVph: setPostPeakVph,
    }
  );

  // Deep link from the Network Builder ("Analyze in HCM Ops" on a placed stamp).
  // Declared after usePersistedForm so this effect fires after its load-from-
  // storage effect on mount — an explicit deep link should win over a stale
  // persisted topology, not the other way around.
  useEffect(() => {
    const topologyParam = searchParams.get("topology");
    if (topologyParam && topologyParam in TOPOLOGIES) {
      setTopologyId(topologyParam as TopologyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const topology = TOPOLOGIES[topologyId];
  const losByRole: Partial<Record<"mainline" | "ramp" | "weave" | "crossroad", LOSGrade>> = {
    mainline: weavingResults.los,
    ramp: mergeResults.los,
    weave: weavingResults.los,
    crossroad: rampTerminalResults.los,
  };

  const losSources: { name: string; los: LOSGrade }[] = [
    { name: "Merge/Diverge", los: mergeResults.los },
    { name: "Weaving", los: weavingResults.los },
    { name: "Ramp Signal", los: rampTerminalResults.los },
  ];
  const worstLOS = losSources.reduce((worst, cur) => (cur.los > worst.los ? cur : worst));

  const publishInterchange = useCorridorStore((s) => s.publishInterchange);
  useEffect(() => {
    publishInterchange({
      stationFt: interchangeStationFt,
      topologyLabel: topology.label,
      mergeLOS: mergeResults.los,
      weaveLOS: weavingResults.los,
      rampSignalLOS: rampTerminalResults.los,
    });
  }, [interchangeStationFt, topology.label, mergeResults.los, weavingResults.los, rampTerminalResults.los, publishInterchange]);

  const steps: CalcStep[] = [
    {
      label: "Ramp Demand Flow Rate",
      reference: "HCM flow rate conversion",
      formula: "v_p = V / (PHF · N · f_HV · f_p)",
      substitution: `v_p = ${rampDemandVph} / (${phf} · 1 · f_HV)`,
      result: `${fmt(mergeResults.vR, 0)} pc/h`,
    },
    {
      label: "Merge Influence Area Density",
      reference: "Simplified HCM freeway merge regression form",
      formula: "D_R = 5.475 + 0.00734·v_R + 0.0078·v12 − 0.00627·L_A + turbulence(ΔFFS)",
      substitution: `v_R=${fmt(mergeResults.vR, 0)}, v12=${fmt(mergeResults.v12, 0)}, L_A=${accelLaneFt} ft, ΔFFS=${fmt(mergeResults.speedDifferentialMph, 0)} mph`,
      result: `${fmt(mergeResults.densityPcMiLn, 1)} pc/mi/ln — LOS ${mergeResults.los}`,
      confidence: "approximated",
    },
    {
      label: "Weaving Volume Ratio",
      formula: "VR = v_w / v_total",
      substitution: `VR = ${fmt(weavingResults.vW, 0)} / ${fmt(weavingResults.vTotal, 0)}`,
      result: fmt(weavingResults.VR, 3),
    },
    {
      label: "Composite Weaving Section Speed",
      reference: "Simplified representative weaving speed model",
      formula: "S = v_total / (v_w/S_w + v_nw/S_nw)",
      substitution: `S_w=${fmt(weavingResults.sW, 1)} mph, S_nw=${fmt(weavingResults.sNW, 1)} mph`,
      result: `${fmt(weavingResults.compositeSpeedMph, 1)} mph — LOS ${weavingResults.los}`,
      confidence: "approximated",
    },
    {
      label: "Ramp Terminal Critical Flow Ratio Sum (Webster)",
      formula: "Y = Σ(v_ci / s_i)",
      substitution: `Y = ${criticalNS}/${satNS} + ${criticalEW}/${satEW}`,
      result: fmt(rampTerminalResults.Y, 3),
    },
    {
      label: "Webster Optimal Cycle Length",
      formula: "C_o = (1.5L + 5) / (1 − Y)",
      substitution: `L=${rampTerminalResults.totalLostTimeSec}s, Y=${fmt(rampTerminalResults.Y, 3)}`,
      result: Number.isFinite(rampTerminalResults.optimalCycleLengthSec) ? `${fmt(rampTerminalResults.optimalCycleLengthSec, 0)} s` : "OVERSATURATED",
    },
    {
      label: "Degree of Saturation (v/c)",
      formula: "X = Y·C / (C − L)",
      substitution: `Y=${fmt(rampTerminalResults.Y, 3)}, C=${fmt(rampTerminalResults.optimalCycleLengthSec, 0)}s`,
      result: `${fmt(rampTerminalResults.degreeOfSaturation, 2)} — LOS ${rampTerminalResults.los}`,
    },
    {
      label: "D/D/1 Peak Queue",
      formula: "Q_max = (λ − μ) · T_os",
      substitution: `λ=${fmt((criticalNS + criticalEW) / 60, 1)} veh/min, μ=${fmt(satNS / 60, 1)} veh/min, T=${oversatDurationMin} min`,
      result: `${fmt(queueResults.qMaxVeh, 1)} veh`,
    },
    {
      label: "Queue Recovery Time",
      formula: "t_rec = Q_max / (μ − λ_post)",
      substitution: `Q_max=${fmt(queueResults.qMaxVeh, 1)}, λ_post=${fmt(postPeakVph / 60, 1)} veh/min`,
      result: Number.isFinite(queueResults.recoveryTimeMin) ? `${fmt(queueResults.recoveryTimeMin, 1)} min` : "Does not clear",
    },
    {
      label: "Total Vehicle-Hours of Delay",
      formula: "VHD = 0.5 · Q_max · (T_os + t_rec)",
      substitution: `Q_max=${fmt(queueResults.qMaxVeh, 1)}, T_os=${oversatDurationMin}, t_rec=${fmt(queueResults.recoveryTimeMin, 1)}`,
      result: `${fmt(queueResults.totalVehicleHoursDelay, 2)} veh-hr`,
    },
  ];

  async function handleExportMemo() {
    const images = (
      await Promise.all([
        Promise.resolve(captureCanvasImage(findCanvas(schematicRef.current), `Interactive Schematic — ${topology.label}`)),
        captureSvgImage(findSvg(queueChartRef.current), "D/D/1 Queue Buildup — Ramp Terminal Bottleneck"),
      ])
    ).filter((img): img is NonNullable<typeof img> => img !== null);

    await generateMemoPdf({
      moduleTitle: `Interchange Operations — ${topology.label}`,
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: formatStation(stationStart, unitSystem),
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images,
      inputs: [
        { label: "Topology", value: topology.label },
        { label: "Ramp demand", value: `${rampDemandVph} vph` },
        { label: "Freeway upstream volume", value: `${freewayUpstreamVph} vph` },
        { label: "PHF", value: String(phf) },
        { label: "Heavy vehicle %", value: `${heavyPct}%` },
        { label: "Weaving volume", value: `${weaveVph} vph` },
        { label: "Non-weaving volume", value: `${nonWeaveVph} vph` },
      ],
      steps,
      verdicts: [
        { label: "Merge Influence Area", status: mergeResults.los <= "D" ? "PASS" : "FAIL", detail: `LOS ${mergeResults.los}, D=${fmt(mergeResults.densityPcMiLn, 1)} pc/mi/ln` },
        { label: "Weaving Section", status: weavingResults.los <= "D" ? "PASS" : "FAIL", detail: `LOS ${weavingResults.los}, S=${fmt(weavingResults.compositeSpeedMph, 1)} mph` },
        { label: "Ramp Terminal Signal", status: rampTerminalResults.degreeOfSaturation <= 0.9 ? "PASS" : "WARN", detail: `X=${fmt(rampTerminalResults.degreeOfSaturation, 2)}, LOS ${rampTerminalResults.los}` },
      ],
    });
  }

  function handleExportCsv() {
    downloadCsv(
      [
        ["Metric", "Value", "Unit"],
        ["Merge Density", fmt(mergeResults.densityPcMiLn, 2), "pc/mi/ln"],
        ["Merge LOS", mergeResults.los, ""],
        ["Weaving VR", fmt(weavingResults.VR, 3), ""],
        ["Weaving Composite Speed", fmt(weavingResults.compositeSpeedMph, 2), "mph"],
        ["Weaving LOS", weavingResults.los, ""],
        ["Ramp Terminal X (v/c)", fmt(rampTerminalResults.degreeOfSaturation, 3), ""],
        ["Optimal Cycle Length", fmt(rampTerminalResults.optimalCycleLengthSec, 1), "s"],
        ["Queue Q_max", fmt(queueResults.qMaxVeh, 2), "veh"],
        ["Total Delay", fmt(queueResults.totalVehicleHoursDelay, 3), "veh-hr"],
      ],
      `interchange_ops_${Date.now()}.csv`
    );
  }

  return (
    <ModuleShell
      moduleTag="INTERCHANGE / HCM OPS"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Topology</SectionLabel>
          <SelectField
            label="Interchange Preset"
            value={topologyId}
            onChange={setTopologyId}
            options={Object.values(TOPOLOGIES).map((t) => ({ value: t.id, label: t.label }))}
          />
          <NumberField
            label="Corridor Station"
            value={interchangeStationFt}
            step={100}
            onChange={setInterchangeStationFt}
            unit="ft"
          />

          <SectionLabel>Traffic Parameters</SectionLabel>
          <NumberField label="PHF" value={phf} min={0.8} max={0.98} step={0.01} onChange={setPhf} error={validation.errors.phf} />
          <NumberField label="Heavy Vehicle %" value={heavyPct} min={0} max={40} step={1} onChange={setHeavyPct} unit="%" error={validation.errors.heavyPct} />
          <NumberField label="PCE (E_T)" value={pce} min={1.5} max={2.5} step={0.1} onChange={setPce} error={validation.errors.pce} />

          <SectionLabel>Merge / Diverge</SectionLabel>
          <NumberField label="Ramp Demand" value={rampDemandVph} step={10} onChange={setRampDemandVph} unit="vph" error={validation.errors.rampDemandVph} />
          <NumberField label="Freeway Upstream Volume" value={freewayUpstreamVph} step={50} onChange={setFreewayUpstreamVph} unit="vph" error={validation.errors.freewayUpstreamVph} />
          <NumberField label="Freeway Lanes" value={freewayLanes} min={2} max={8} step={1} onChange={setFreewayLanes} error={validation.errors.freewayLanes} />
          <NumberField label="Accel/Decel Lane Length" value={accelLaneFt} step={10} onChange={setAccelLaneFt} unit="ft" error={validation.errors.accelLaneFt} />

          <SectionLabel>Weaving Section</SectionLabel>
          <NumberField label="Weaving Volume" value={weaveVph} step={10} onChange={setWeaveVph} unit="vph" error={validation.errors.weaveVph} />
          <NumberField label="Non-Weaving Volume" value={nonWeaveVph} step={10} onChange={setNonWeaveVph} unit="vph" error={validation.errors.nonWeaveVph} />
          <NumberField label="Weaving Segment Length" value={weaveLengthFt} step={50} onChange={setWeaveLengthFt} unit="ft" error={validation.errors.weaveLengthFt} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Min. Weaving Lanes" value={minWeaveLanes} min={1} max={3} step={1} onChange={setMinWeaveLanes} error={validation.errors.minWeaveLanes} />
            <NumberField label="Total Lanes" value={totalWeaveLanes} min={2} max={8} step={1} onChange={setTotalWeaveLanes} error={validation.errors.totalWeaveLanes} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Ramp FFS" value={rampFfs} min={25} max={55} step={1} onChange={setRampFfs} unit="mph" error={validation.errors.rampFfs} />
            <NumberField label="Mainline FFS" value={mainlineFfs} min={55} max={75} step={1} onChange={setMainlineFfs} unit="mph" error={validation.errors.mainlineFfs} />
          </div>

          <SectionLabel>Ramp Terminal Signal (CMA)</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Critical Vol. N-S" value={criticalNS} step={10} onChange={setCriticalNS} unit="vph" error={validation.errors.criticalNS} />
            <NumberField label="Sat. Flow N-S" value={satNS} step={10} onChange={setSatNS} unit="vphpl" error={validation.errors.satNS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Critical Vol. E-W" value={criticalEW} step={10} onChange={setCriticalEW} unit="vph" error={validation.errors.criticalEW} />
            <NumberField label="Sat. Flow E-W" value={satEW} step={10} onChange={setSatEW} unit="vphpl" error={validation.errors.satEW} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Phases" value={numPhases} min={2} max={8} step={1} onChange={setNumPhases} error={validation.errors.numPhases} />
            <NumberField label="Lost Time / Phase" value={lostTimePerPhase} min={2} max={6} step={0.5} onChange={setLostTimePerPhase} unit="s" error={validation.errors.lostTimePerPhase} />
          </div>

          <SectionLabel>D/D/1 Queuing</SectionLabel>
          <NumberField label="Oversaturated Duration" value={oversatDurationMin} min={1} max={120} step={1} onChange={setOversatDurationMin} unit="min" error={validation.errors.oversatDurationMin} />
          <NumberField label="Post-Peak Arrival Rate" value={postPeakVph} step={10} onChange={setPostPeakVph} unit="vph" error={validation.errors.postPeakVph} />
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {searchParams.get("topology") && (
          <Link
            href="/network-builder"
            className="flex w-fit items-center gap-1.5 text-[10px] text-text-tertiary hover:text-cyan"
          >
            <ArrowLeft size={11} /> Back to Network Builder
          </Link>
        )}
        <HeroMetric
          label="Governing Level of Service"
          value={worstLOS.los}
          status={worstLOS.los <= "D" ? "ok" : "fail"}
          comparison={`driven by ${worstLOS.name} — Merge ${mergeResults.los} · Weave ${weavingResults.los} · Ramp Signal ${rampTerminalResults.los}`}
        />
        <ValidationBanner errors={validation.errors} />
        <Panel
          title={`Interactive Schematic — ${topology.label}`}
          className="h-[300px]"
          actions={
            <div className="flex gap-1.5">
              <StatusPill status={mergeResults.los <= "D" ? "ok" : "fail"} label={`MERGE ${mergeResults.los}`} />
              <StatusPill status={weavingResults.los <= "D" ? "ok" : "fail"} label={`WEAVE ${weavingResults.los}`} />
              <StatusPill status={rampTerminalResults.los <= "D" ? "ok" : "fail"} label={`RAMP SIGNAL ${rampTerminalResults.los}`} />
            </div>
          }
        >
          <div ref={schematicRef} className="h-full w-full rounded-sm border border-border-hairline">
            <ErrorBoundary label="Interchange Schematic">
              <InterchangeSchematic topology={topology} losByRole={losByRole} />
            </ErrorBoundary>
          </div>
        </Panel>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
          <Panel title="Merge / Diverge Influence Area">
            <LedgerRow label="Ramp Flow v_R" value={fmt(mergeResults.vR, 0)} unit="pc/h" />
            <LedgerRow label="Freeway v_12" value={fmt(mergeResults.v12, 0)} unit="pc/h/ln" />
            <LedgerRow
              label="Ramp/Mainline ΔFFS"
              value={fmt(mergeResults.speedDifferentialMph, 0)}
              unit="mph"
              status={mergeResults.speedDifferentialMph > 10 ? "warn" : "neutral"}
            />
            <LedgerRow label="Density D_R" value={fmt(mergeResults.densityPcMiLn, 1)} unit="pc/mi/ln" />
            <LedgerRow label="Level of Service" value={mergeResults.los} status={mergeResults.los <= "D" ? "ok" : "fail"} />
          </Panel>
          <Panel title="Weaving Analysis">
            <LedgerRow label="Volume Ratio VR" value={fmt(weavingResults.VR, 3)} />
            <LedgerRow label="Weaving Speed S_w" value={fmt(weavingResults.sW, 1)} unit="mph" />
            <LedgerRow label="Non-Weaving Speed S_nw" value={fmt(weavingResults.sNW, 1)} unit="mph" />
            <LedgerRow label="Composite Speed" value={fmt(weavingResults.compositeSpeedMph, 1)} unit="mph" />
            <LedgerRow label="Composite Density" value={fmt(weavingResults.compositeDensityPcMiLn, 1)} unit="pc/mi/ln" />
            <LedgerRow label="Level of Service" value={weavingResults.los} status={weavingResults.los <= "D" ? "ok" : "fail"} />
          </Panel>
          <Panel title="Ramp Terminal — Critical Movement Analysis">
            {rampTerminalResults.criticalFlowRatios.map((m) => (
              <LedgerRow key={m.name} label={m.name} value={fmt(m.y, 3)} />
            ))}
            <LedgerRow label="Σ Critical Flow Ratio Y" value={fmt(rampTerminalResults.Y, 3)} />
            <LedgerRow
              label="Optimal Cycle C_o"
              value={Number.isFinite(rampTerminalResults.optimalCycleLengthSec) ? fmt(rampTerminalResults.optimalCycleLengthSec, 0) : "OVERSAT."}
              unit="s"
            />
            <LedgerRow label="Degree of Saturation X" value={fmt(rampTerminalResults.degreeOfSaturation, 2)} status={rampTerminalResults.degreeOfSaturation <= 0.9 ? "ok" : "fail"} />
            <LedgerRow label="Level of Service" value={rampTerminalResults.los} status={rampTerminalResults.los <= "D" ? "ok" : "fail"} />
          </Panel>
        </div>

        <Panel title="D/D/1 Queue Buildup — Ramp Terminal Bottleneck" className="h-[220px]">
          <div className="grid h-full grid-cols-[1fr_180px] gap-3">
            <div ref={queueChartRef} className="h-full w-full">
              <ErrorBoundary label="Queue Chart">
                <QueueChart series={queueResults.series} qMax={queueResults.qMaxVeh} />
              </ErrorBoundary>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <LedgerRow label="Peak Queue Q_max" value={fmt(queueResults.qMaxVeh, 1)} unit="veh" status="warn" />
              <LedgerRow
                label="Recovery Time"
                value={Number.isFinite(queueResults.recoveryTimeMin) ? fmt(queueResults.recoveryTimeMin, 1) : "∞"}
                unit={Number.isFinite(queueResults.recoveryTimeMin) ? "min" : undefined}
              />
              <LedgerRow label="Total Delay" value={fmt(queueResults.totalVehicleHoursDelay, 2)} unit="veh-hr" status="fail" />
            </div>
          </div>
        </Panel>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Interchange / HCM Operations" steps={steps} />
    </ModuleShell>
  );
}
