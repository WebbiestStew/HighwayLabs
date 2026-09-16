"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjectStore } from "@/lib/store";
import { useCorridorStore } from "@/lib/corridorStore";
import { Panel, StatusPill, LedgerRow } from "@/components/ui/Ledger";
import { formatStation } from "@/lib/units";
import { ArrowRight } from "lucide-react";

interface RulerMark {
  stationFt: number;
  label: string;
  color: string;
}

export default function OverviewPage() {
  const { corridorName, unitSystem, stationStart, stationEnd, designSpeedMph } = useProjectStore();
  const corridor = useCorridorStore();

  const marks = useMemo<RulerMark[]>(() => {
    const m: RulerMark[] = [];
    if (corridor.horizontal) {
      m.push({ stationFt: corridor.horizontal.tsStationFt, label: "TS", color: "#22d3ee" });
      m.push({ stationFt: corridor.horizontal.scStationFt, label: "SC", color: "#22d3ee" });
    }
    if (corridor.vertical) {
      m.push({ stationFt: corridor.vertical.pvcStationFt, label: "PVC", color: "#f59e0b" });
      m.push({ stationFt: corridor.vertical.pviStationFt, label: "PVI", color: "#f59e0b" });
      m.push({ stationFt: corridor.vertical.pvtStationFt, label: "PVT", color: "#f59e0b" });
    }
    if (corridor.interchange) {
      m.push({ stationFt: corridor.interchange.stationFt, label: "IX", color: "#10b981" });
    }
    return m;
  }, [corridor.horizontal, corridor.vertical, corridor.interchange]);

  const rangeMin = Math.min(stationStart, ...marks.map((m) => m.stationFt));
  const rangeMax = Math.max(stationEnd, ...marks.map((m) => m.stationFt));
  const pct = (station: number) => ((station - rangeMin) / Math.max(rangeMax - rangeMin, 1)) * 100;

  const modules = [
    {
      title: "01 · Horizontal Alignment",
      href: "/horizontal-alignment",
      configured: !!corridor.horizontal,
      pass: corridor.horizontal?.meetsRMin ?? null,
      rows: corridor.horizontal
        ? [
            { label: "TS – SC", value: `${formatStation(corridor.horizontal.tsStationFt, unitSystem)} – ${formatStation(corridor.horizontal.scStationFt, unitSystem)}` },
            { label: "Radius", value: `${corridor.horizontal.curveRadiusFt.toFixed(0)} ft` },
            { label: "e_design", value: `${corridor.horizontal.eDesignPercent.toFixed(1)}%` },
          ]
        : [],
    },
    {
      title: "02 · Vertical Alignment",
      href: "/vertical-alignment",
      configured: !!corridor.vertical,
      pass: corridor.vertical ? corridor.vertical.meetsKMin && corridor.vertical.structurePass !== false : null,
      rows: corridor.vertical
        ? [
            { label: "Class", value: corridor.vertical.curveClass },
            { label: "PVI", value: formatStation(corridor.vertical.pviStationFt, unitSystem) },
            { label: "Structure", value: corridor.vertical.structurePass == null ? "N/A" : corridor.vertical.structurePass ? "Clear" : "Deficit" },
          ]
        : [],
    },
    {
      title: "03 · Interchange / HCM Ops",
      href: "/interchange-ops",
      configured: !!corridor.interchange,
      pass: corridor.interchange ? ["A", "B", "C", "D"].includes(corridor.interchange.rampSignalLOS) : null,
      rows: corridor.interchange
        ? [
            { label: "Station", value: formatStation(corridor.interchange.stationFt, unitSystem) },
            { label: "Topology", value: corridor.interchange.topologyLabel },
            { label: "Ramp Signal LOS", value: corridor.interchange.rampSignalLOS },
          ]
        : [],
    },
    {
      title: "04 · Earthwork / Mass-Haul",
      href: "/earthwork",
      configured: !!corridor.earthwork,
      pass: corridor.earthwork ? true : null,
      rows: corridor.earthwork
        ? [
            { label: "Station Range", value: `${formatStation(corridor.earthwork.startStationFt, unitSystem)} – ${formatStation(corridor.earthwork.endStationFt, unitSystem)}` },
            { label: "Net Ordinate", value: `${corridor.earthwork.netEndOrdinateCy.toFixed(0)} CY` },
            { label: "Total Cost", value: `$${corridor.earthwork.grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
          ]
        : [],
    },
    {
      title: "05 · Pavement SN Design",
      href: "/pavement",
      configured: !!corridor.pavement,
      pass: corridor.pavement?.pass ?? null,
      rows: corridor.pavement
        ? [
            { label: "SN Required", value: corridor.pavement.snRequired.toFixed(2) },
            { label: "SN Provided", value: corridor.pavement.snProvided.toFixed(2) },
          ]
        : [],
    },
    {
      title: "06 · Network Builder",
      href: "/network-builder",
      configured: !!corridor.network,
      pass: corridor.network ? true : null,
      rows: corridor.network
        ? [
            { label: "Centerline Miles", value: corridor.network.totalMiles.toFixed(2) },
            { label: "Interchanges", value: String(corridor.network.interchangeCount) },
            { label: "Est. Cost", value: `$${corridor.network.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
          ]
        : [],
    },
  ];

  const configuredCount = modules.filter((m) => m.configured).length;
  const failingCount = modules.filter((m) => m.configured && m.pass === false).length;

  return (
    <div tabIndex={0} className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[13px] font-semibold text-text-primary">{corridorName}</h1>
          <p className="text-[10px] text-text-tertiary">
            Project station range {formatStation(stationStart, unitSystem)} – {formatStation(stationEnd, unitSystem)} · Design speed {designSpeedMph} mph
          </p>
        </div>
        <div className="flex gap-2">
          <StatusPill status="ok" label={`${configuredCount}/6 MODULES CONFIGURED`} />
          {failingCount > 0 && <StatusPill status="fail" label={`${failingCount} NON-CONFORMING`} />}
        </div>
      </div>

      <Panel title="Corridor Station Overview">
        <div className="relative h-16 w-full">
          <div className="absolute left-0 right-0 top-8 h-0.5 bg-border-strong" />
          {marks.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pct(m.stationFt)}%` }}
            >
              <span className="text-[8px] font-semibold" style={{ color: m.color }}>
                {m.label}
              </span>
              <span className="h-6 w-0.5" style={{ background: m.color }} />
              <span className="mt-1 whitespace-nowrap text-[8px] text-text-tertiary">{formatStation(m.stationFt, unitSystem)}</span>
            </div>
          ))}
          {corridor.earthwork && (
            <div
              className="absolute top-8 h-1.5 -translate-y-1/2 rounded-full bg-emerald/30"
              style={{
                left: `${pct(corridor.earthwork.startStationFt)}%`,
                width: `${pct(corridor.earthwork.endStationFt) - pct(corridor.earthwork.startStationFt)}%`,
              }}
            />
          )}
        </div>
        {marks.length === 0 && (
          <p className="text-[10px] text-text-tertiary">
            No control points published yet — open Modules 01–03 to populate the corridor station overview.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-3 gap-3">
        {modules.map((m) => (
          <Panel
            key={m.href}
            title={m.title}
            actions={
              m.configured ? (
                <StatusPill status={m.pass === false ? "fail" : "ok"} label={m.pass === false ? "REVIEW" : "OK"} />
              ) : (
                <StatusPill status="neutral" label="NOT SET UP" />
              )
            }
          >
            {m.configured ? (
              <>
                {m.rows.map((r) => (
                  <LedgerRow key={r.label} label={r.label} value={r.value} />
                ))}
              </>
            ) : (
              <p className="mb-2 text-[10px] text-text-tertiary">This module hasn&apos;t been configured for the current corridor yet.</p>
            )}
            <Link
              href={m.href}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-cyan hover:border-cyan/40 hover:bg-cyan/5"
            >
              Open Module <ArrowRight size={11} />
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
