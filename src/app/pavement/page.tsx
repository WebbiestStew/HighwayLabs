"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ModuleShell from "@/components/layout/ModuleShell";
import CalcDrawer, { type CalcStep } from "@/components/layout/CalcDrawer";
import { NumberField, SectionLabel } from "@/components/ui/Field";
import { LedgerRow, StatusPill, Panel, ValidationBanner, HeroMetric } from "@/components/ui/Ledger";
import PavementCrossSectionCanvas from "@/components/canvas/PavementCrossSectionCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore, DESIGN_VEHICLE_LABELS, DESIGN_STANDARD_LABELS } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { computePavement, type PavementInputs } from "@/lib/engineering/pavement";
import { fmt, formatStation } from "@/lib/units";
import { generateMemoPdf } from "@/lib/export/memo";
import { downloadCsv } from "@/lib/export/download";
import { pavementSchema } from "@/lib/schemas/pavement";
import { validateInputs } from "@/lib/validation";
import { usePersistedForm } from "@/lib/persistence";
import { captureCanvasImage, findCanvas } from "@/lib/export/captureImage";

export default function PavementPage() {
  const { corridorName, unitSystem, designSpeedMph, designVehicle, designStandard, stationStart } = useProjectStore();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [w18, setW18] = useState(4_500_000);
  const [reliabilityPercent, setReliabilityPercent] = useState(95);
  const [s0, setS0] = useState(0.45);
  const [p0, setP0] = useState(4.2);
  const [pt, setPt] = useState(2.5);
  const [mrPsi, setMrPsi] = useState(7500);
  const [a1, setA1] = useState(0.44);
  const [d1, setD1] = useState(4.5);
  const [a2, setA2] = useState(0.14);
  const [d2, setD2] = useState(8);
  const [m2, setM2] = useState(1.0);
  const [a3, setA3] = useState(0.11);
  const [d3, setD3] = useState(6);
  const [m3, setM3] = useState(1.0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const inputs: PavementInputs = { w18, reliabilityPercent, s0, p0, pt, mrPsi, a1, d1, a2, d2, m2, a3, d3, m3 };
  const results = useMemo(() => computePavement(inputs), [JSON.stringify(inputs)]);
  const validation = useMemo(() => validateInputs(pavementSchema, inputs), [JSON.stringify(inputs)]);

  usePersistedForm(
    "highwaylab.pavement",
    { ...inputs },
    { w18: setW18, reliabilityPercent: setReliabilityPercent, s0: setS0, p0: setP0, pt: setPt, mrPsi: setMrPsi, a1: setA1, d1: setD1, a2: setA2, d2: setD2, m2: setM2, a3: setA3, d3: setD3, m3: setM3 }
  );

  const publishPavement = useCorridorStore((s) => s.publishPavement);
  useEffect(() => {
    publishPavement({ snRequired: results.snRequired, snProvided: results.snProvided, pass: results.pass });
  }, [results.snRequired, results.snProvided, results.pass, publishPavement]);

  const passStatus = results.pass ? "ok" : "fail";
  const surfaceStatus = results.meetsMinSurface ? "ok" : "warn";
  const baseStatus = results.meetsMinBase ? "ok" : "warn";

  const steps: CalcStep[] = [
    {
      label: "Standard Normal Deviate",
      reference: "AASHTO 1993 Guide, reliability table",
      formula: "Z_R = interp(R%)",
      substitution: `R = ${reliabilityPercent}%`,
      result: fmt(results.zR, 3),
    },
    {
      label: "Design Serviceability Loss",
      formula: "ΔPSI = p0 − pt",
      substitution: `${p0} − ${pt}`,
      result: fmt(results.deltaPSI, 2),
    },
    {
      label: "1993 AASHTO Flexible Pavement Equation (solved for SN)",
      reference: "AASHTO Guide for Design of Pavement Structures, 1993",
      formula:
        "log10(W18) = ZR·S0 + 9.36·log10(SN+1) − 0.20 + log10(ΔPSI/2.7)/(0.40+1094/(SN+1)^5.19) + 2.32·log10(MR) − 8.07",
      formulaLatex:
        "\\log_{10}(W_{18}) = Z_R S_0 + 9.36\\log_{10}(SN{+}1) - 0.20 + \\dfrac{\\log_{10}\\!\\left(\\frac{\\Delta PSI}{2.7}\\right)}{0.40 + \\frac{1094}{(SN{+}1)^{5.19}}} + 2.32\\log_{10}(M_R) - 8.07",
      substitution: `W18=${fmt(w18, 0)}, ZR=${fmt(results.zR, 3)}, S0=${s0}, MR=${mrPsi} psi — solved iteratively (bisection)`,
      result: `SN_required = ${fmt(results.snRequired, 2)}`,
    },
    {
      label: "Provided Structural Number",
      formula: "SN_prov = a1·D1 + a2·D2·m2 + a3·D3·m3",
      formulaLatex: "SN_{prov} = a_1 D_1 + a_2 D_2 m_2 + a_3 D_3 m_3",
      substitution: `${a1}·${d1} + ${a2}·${d2}·${m2} + ${a3}·${d3}·${m3}`,
      result: fmt(results.snProvided, 2),
    },
    {
      label: "Structural Adequacy Check",
      formula: "SN_prov ≥ SN_req ?",
      substitution: `${fmt(results.snProvided, 2)} vs ${fmt(results.snRequired, 2)}`,
      result: results.pass ? `PASS — margin ${fmt(results.margin, 2)}` : `FAIL — deficit ${fmt(-results.margin, 2)}`,
    },
    {
      label: "Minimum Layer Thickness Check",
      reference: "AASHTO Guide Ch.3 — ESAL-based minimums",
      formula: "D1 ≥ D1,min ;  D2 ≥ D2,min",
      substitution: `D1,min=${results.minimums.surfaceIn} in, D2,min=${results.minimums.baseIn} in`,
      result: `${results.meetsMinSurface ? "PASS" : "FAIL"} surface / ${results.meetsMinBase ? "PASS" : "FAIL"} base`,
    },
    {
      label: "Allowable ESAL Capacity at Provided SN",
      formula: "Back-solve W18 from SN_provided",
      substitution: `SN = ${fmt(results.snProvided, 2)}`,
      result: `${fmt(results.allowableW18, 0)} ESALs`,
    },
  ];

  async function handleExportMemo() {
    const img = captureCanvasImage(findCanvas(canvasContainerRef.current), "Layered Pavement Cross-Section");

    await generateMemoPdf({
      moduleTitle: "Pavement Structural Number — 1993 AASHTO Empirical Design",
      corridorName,
      designSpeedLabel: `${designSpeedMph} mph`,
      designVehicleLabel: DESIGN_VEHICLE_LABELS[designVehicle],
      stationRangeLabel: formatStation(stationStart, unitSystem),
      unitSystemLabel: unitSystem.toUpperCase(),
      governingStandardLabel: DESIGN_STANDARD_LABELS[designStandard],
      images: img ? [img] : [],
      inputs: [
        { label: "Design ESALs (W18)", value: fmt(w18, 0) },
        { label: "Reliability", value: `${reliabilityPercent}%` },
        { label: "Overall Std. Deviation S0", value: String(s0) },
        { label: "p0 / pt", value: `${p0} / ${pt}` },
        { label: "Roadbed M_R", value: `${mrPsi} psi` },
        { label: "Layer 1 (a1, D1)", value: `${a1}, ${d1} in` },
        { label: "Layer 2 (a2, D2, m2)", value: `${a2}, ${d2} in, ${m2}` },
        { label: "Layer 3 (a3, D3, m3)", value: `${a3}, ${d3} in, ${m3}` },
      ],
      steps,
      verdicts: [
        { label: "Structural Number Adequacy", status: results.pass ? "PASS" : "FAIL", detail: `SN_prov=${fmt(results.snProvided, 2)} vs SN_req=${fmt(results.snRequired, 2)}` },
        { label: "Minimum Surface Thickness", status: results.meetsMinSurface ? "PASS" : "WARN", detail: `D1=${d1} in vs min ${results.minimums.surfaceIn} in` },
        { label: "Minimum Base Thickness", status: results.meetsMinBase ? "PASS" : "WARN", detail: `D2=${d2} in vs min ${results.minimums.baseIn} in` },
      ],
    });
  }

  function handleExportCsv() {
    downloadCsv(
      [
        ["Parameter", "Value", "Unit"],
        ["W18", w18, "ESALs"],
        ["Reliability", reliabilityPercent, "%"],
        ["ZR", fmt(results.zR, 3), ""],
        ["SN_required", fmt(results.snRequired, 3), ""],
        ["SN_provided", fmt(results.snProvided, 3), ""],
        ["D1", d1, "in"],
        ["D2", d2, "in"],
        ["D3", d3, "in"],
        ["Allowable W18 at provided SN", fmt(results.allowableW18, 0), "ESALs"],
      ],
      `pavement_sn_design_${Date.now()}.csv`
    );
  }

  return (
    <ModuleShell
      moduleTag="PAVEMENT SN DESIGN"
      onOpenCalcDrawer={() => setDrawerOpen(true)}
      onExportMemo={handleExportMemo}
      onExportCsv={handleExportCsv}
      sidebar={
        <div className="flex flex-col gap-3">
          <SectionLabel>Traffic & Reliability</SectionLabel>
          <NumberField label="Design ESALs (W18)" value={w18} step={100000} onChange={setW18} error={validation.errors.w18} />
          <NumberField label="Reliability R" value={reliabilityPercent} min={80} max={99.9} step={0.1} onChange={setReliabilityPercent} unit="%" error={validation.errors.reliabilityPercent} />
          <NumberField label="Overall Std. Deviation S0" value={s0} min={0.3} max={0.5} step={0.01} onChange={setS0} error={validation.errors.s0} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Initial PSI p0" value={p0} step={0.1} onChange={setP0} error={validation.errors.p0} />
            <NumberField label="Terminal PSI pt" value={pt} step={0.1} onChange={setPt} error={validation.errors.pt} />
          </div>
          <NumberField label="Roadbed Resilient Modulus" value={mrPsi} step={100} onChange={setMrPsi} unit="psi" error={validation.errors.mrPsi} />

          <SectionLabel>Layer 1 — AC Surface</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Coefficient a1" value={a1} step={0.01} onChange={setA1} error={validation.errors.a1} />
            <NumberField label="Thickness D1" value={d1} step={0.25} onChange={setD1} unit="in" error={validation.errors.d1} />
          </div>

          <SectionLabel>Layer 2 — Crushed Stone Base</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="a2" value={a2} step={0.01} onChange={setA2} error={validation.errors.a2} />
            <NumberField label="D2" value={d2} step={0.5} onChange={setD2} unit="in" error={validation.errors.d2} />
            <NumberField label="m2" value={m2} step={0.05} onChange={setM2} error={validation.errors.m2} />
          </div>

          <SectionLabel>Layer 3 — Granular Subbase</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="a3" value={a3} step={0.01} onChange={setA3} error={validation.errors.a3} />
            <NumberField label="D3" value={d3} step={0.5} onChange={setD3} unit="in" error={validation.errors.d3} />
            <NumberField label="m3" value={m3} step={0.05} onChange={setM3} error={validation.errors.m3} />
          </div>
        </div>
      }
    >
      <div className="grid h-full grid-cols-[320px_1fr] gap-3">
        <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto">
          <StatusPill status={passStatus} label={results.pass ? "SN PROVIDED ≥ SN REQUIRED" : "STRUCTURAL DEFICIT"} />
          <HeroMetric
            label="Provided Structural Number"
            value={fmt(results.snProvided, 2)}
            status={passStatus}
            comparison={`vs SN required = ${fmt(results.snRequired, 2)} (margin ${results.margin >= 0 ? "+" : ""}${fmt(results.margin, 2)})`}
          />
          <ValidationBanner errors={validation.errors} />
          <Panel title="Structural Design Ledger">
            <LedgerRow label="Z_R" value={fmt(results.zR, 3)} />
            <LedgerRow label="ΔPSI" value={fmt(results.deltaPSI, 2)} />
            <LedgerRow label="SN Required" value={fmt(results.snRequired, 2)} status="neutral" />
            <LedgerRow label="SN Provided" value={fmt(results.snProvided, 2)} status={passStatus} />
            <LedgerRow label="Margin" value={fmt(results.margin, 2)} status={passStatus} />
            <LedgerRow label="Min. Surface D1" value={`${results.minimums.surfaceIn} in`} status={surfaceStatus} />
            <LedgerRow label="Min. Base D2" value={`${results.minimums.baseIn} in`} status={baseStatus} />
            <LedgerRow label="Allowable ESAL Capacity" value={fmt(results.allowableW18, 0)} status="ok" />
            <LedgerRow label="Design ESALs (W18)" value={fmt(w18, 0)} />
            <LedgerRow
              label="Remaining Capacity Margin"
              value={fmt(((results.allowableW18 - w18) / w18) * 100, 1)}
              unit="%"
              status={results.allowableW18 >= w18 ? "ok" : "fail"}
            />
          </Panel>
        </div>

        <Panel title="Layered Pavement Cross-Section">
          <div ref={canvasContainerRef} className="h-full w-full rounded-sm border border-border-hairline">
            <ErrorBoundary label="Pavement Cross-Section">
              <PavementCrossSectionCanvas d1={d1} d2={d2} d3={d3} />
            </ErrorBoundary>
          </div>
        </Panel>
      </div>

      <CalcDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Pavement SN Design" steps={steps} />
    </ModuleShell>
  );
}
