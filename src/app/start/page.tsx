"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, FolderOpen, Sparkles, ArrowRight, Upload } from "lucide-react";
import { NumberField, SelectField } from "@/components/ui/Field";
import { DESIGN_VEHICLE_LABELS, type DesignVehicle } from "@/lib/store";
import { listProjects, createNewProject, loadProject, importProjectFromFile, type ProjectMeta } from "@/lib/projects";
import { loadDemoCorridor } from "@/lib/demoCorridor";
import { formatStation } from "@/lib/units";
import { toast } from "@/lib/toast";

type Mode = "menu" | "new" | "open";

export default function StartPage() {
  const [mode, setMode] = useState<Mode>("menu");
  const [cursorOn, setCursorOn] = useState(true);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await importProjectFromFile(file);
    if (result.ok) {
      toast(`Imported "${result.name}"`, "ok");
      window.location.href = "/overview";
    } else {
      toast(result.error ?? "Import failed", "fail");
    }
  }

  const [corridorName, setCorridorName] = useState("New Corridor");
  const [designSpeedMph, setDesignSpeedMph] = useState(60);
  const [designVehicle, setDesignVehicle] = useState<DesignVehicle>("WB-62");
  const [stationStart, setStationStart] = useState(1000);
  const [stationEnd, setStationEnd] = useState(15000);

  useEffect(() => {
    const t = setInterval(() => setCursorOn((v) => !v), 550);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (mode === "open") setProjects(listProjects());
  }, [mode]);

  function handleCreate() {
    createNewProject({
      corridorName,
      unitSystem: "us",
      designSpeedMph,
      designVehicle,
      designStandard: "aashto-green-book",
      stationStart,
      stationEnd,
    });
    window.location.href = "/overview";
  }

  return (
    <div tabIndex={0} className="engineering-grid flex h-full flex-col items-center overflow-y-auto px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="font-mono text-[32px] font-bold tracking-tight text-cyan">
          HIGHWAYLAB
          <span className={`ml-1 inline-block h-[28px] w-[14px] translate-y-1 bg-cyan align-middle ${cursorOn ? "opacity-100" : "opacity-0"}`} />
        </h1>
        <p className="mt-2 text-[12px] text-text-tertiary">
          Geometric Design &amp; Traffic Operations Workstation — AASHTO Green Book / HCM / TxDOT RDM
        </p>
      </div>

      {mode === "menu" && (
        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          <StartCard
            icon={<FilePlus2 size={20} />}
            title="New Project"
            description="Start a blank corridor with your own design parameters."
            onClick={() => setMode("new")}
          />
          <StartCard
            icon={<FolderOpen size={20} />}
            title="Open Saved Project"
            description="Resume a project you saved earlier from the Project Manager."
            onClick={() => setMode("open")}
          />
          <StartCard
            icon={<Sparkles size={20} />}
            title="Load Demo Corridor"
            description="A fully-configured example spanning all six modules — see it working end to end."
            accent="emerald"
            onClick={loadDemoCorridor}
          />
        </div>
      )}

      {mode === "menu" && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-cyan"
        >
          <Upload size={12} /> or import a project file (.highwaylab.json)
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />

      {mode === "new" && (
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-sm border border-border-hairline bg-surface-1 p-5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">New Project</span>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Corridor Name</span>
            <input
              value={corridorName}
              onChange={(e) => setCorridorName(e.target.value)}
              className="rounded-sm border border-border-hairline bg-surface-4 px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-cyan/50"
            />
          </label>
          <NumberField label="Design Speed" value={designSpeedMph} min={15} max={85} onChange={setDesignSpeedMph} unit="mph" />
          <SelectField
            label="Design Vehicle"
            value={designVehicle}
            onChange={setDesignVehicle}
            options={Object.entries(DESIGN_VEHICLE_LABELS).map(([k, v]) => ({ value: k as DesignVehicle, label: v }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Station Start" value={stationStart} step={100} onChange={setStationStart} unit="ft" />
            <NumberField label="Station End" value={stationEnd} step={100} onChange={setStationEnd} unit="ft" />
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setMode("menu")} className="flex-1 rounded-sm border border-border-hairline py-1.5 text-[11px] text-text-secondary hover:text-text-primary">
              Back
            </button>
            <button
              onClick={handleCreate}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-cyan/40 bg-cyan/10 py-1.5 text-[11px] font-medium text-cyan hover:bg-cyan/20"
            >
              Create <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {mode === "open" && (
        <div className="flex w-full max-w-md flex-col gap-3 rounded-sm border border-border-hairline bg-surface-1 p-5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Open Saved Project</span>
          {projects.length === 0 ? (
            <p className="text-[11px] text-text-tertiary">No saved projects yet. Start a new one or load the demo corridor instead.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (loadProject(p.id)) window.location.href = "/overview";
                  }}
                  className="flex items-center justify-between rounded-sm border border-border-hairline px-3 py-2 text-left hover:border-cyan/40"
                >
                  <span>
                    <span className="block text-[12px] text-text-primary">{p.name}</span>
                    <span className="block text-[10px] text-text-tertiary">{new Date(p.savedAt).toLocaleString()}</span>
                  </span>
                  <ArrowRight size={12} className="text-cyan" />
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setMode("menu")} className="mt-1 rounded-sm border border-border-hairline py-1.5 text-[11px] text-text-secondary hover:text-text-primary">
            Back
          </button>
        </div>
      )}

      <p className="mt-10 text-[10px] text-text-disabled">
        {formatStation(1000, "us")} station format · US Customary / SI toggleable in the top bar
      </p>
    </div>
  );
}

function StartCard({
  icon,
  title,
  description,
  onClick,
  accent = "cyan",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: "cyan" | "emerald";
}) {
  const accentClass = accent === "emerald" ? "hover:border-emerald/50 hover:shadow-[0_0_24px_-12px_var(--accent-compliance)]" : "hover:border-cyan/50 hover:shadow-[0_0_24px_-12px_var(--accent-geometry)]";
  const iconClass = accent === "emerald" ? "text-emerald" : "text-cyan";
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start gap-2 rounded-sm border border-border-hairline bg-surface-1 p-5 text-left transition-all ${accentClass}`}
    >
      <span className={iconClass}>{icon}</span>
      <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
      <span className="text-[11px] leading-relaxed text-text-tertiary">{description}</span>
    </button>
  );
}
