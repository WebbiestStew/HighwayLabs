"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { useProjectStore } from "@/lib/store";
import { getActiveProjectId, overwriteProject } from "@/lib/projects";
import { toast } from "@/lib/toast";

interface Command {
  id: string;
  label: string;
  group: "Module" | "Action";
  keywords?: string;
  run: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { unitSystem, setUnitSystem, designStandard, setDesignStandard } = useProjectStore();

  const commands: Command[] = useMemo(
    () => [
      { id: "overview", label: "00 · Project Overview", group: "Module", run: () => router.push("/overview") },
      { id: "horizontal", label: "01 · Horizontal Alignment", group: "Module", run: () => router.push("/horizontal-alignment") },
      { id: "vertical", label: "02 · Vertical Alignment", group: "Module", run: () => router.push("/vertical-alignment") },
      { id: "interchange", label: "03 · Interchange / HCM Ops", group: "Module", run: () => router.push("/interchange-ops") },
      { id: "earthwork", label: "04 · Earthwork / Mass-Haul", group: "Module", run: () => router.push("/earthwork") },
      { id: "pavement", label: "05 · Pavement SN Design", group: "Module", run: () => router.push("/pavement") },
      { id: "network", label: "06 · Network Builder", group: "Module", run: () => router.push("/network-builder") },
      { id: "start", label: "Start Screen", group: "Module", keywords: "new home", run: () => router.push("/start") },
      {
        id: "units",
        label: `Switch Units to ${unitSystem === "us" ? "SI" : "US Customary"}`,
        group: "Action",
        keywords: "metric imperial toggle",
        run: () => setUnitSystem(unitSystem === "us" ? "si" : "us"),
      },
      {
        id: "standard",
        label: `Switch Governing Standard to ${designStandard === "aashto-green-book" ? "TxDOT RDM" : "AASHTO Green Book"}`,
        group: "Action",
        keywords: "aashto txdot",
        run: () => setDesignStandard(designStandard === "aashto-green-book" ? "txdot-rdm" : "aashto-green-book"),
      },
      {
        id: "save",
        label: "Save Current Project",
        group: "Action",
        keywords: "save cmd+s",
        run: () => quickSave(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unitSystem, designStandard, router]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        quickSave();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function runCommand(cmd: Command) {
    cmd.run();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative flex w-full max-w-lg flex-col rounded-sm border border-border-hairline bg-surface-1 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border-hairline px-3 py-2.5">
          <Search size={14} className="text-text-tertiary" />
          <input
            ref={inputRef}
            aria-label="Search commands and modules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a module or run a command…"
            className="w-full bg-transparent text-[13px] text-text-primary outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && filtered[activeIndex]) {
                runCommand(filtered[activeIndex]);
              }
            }}
          />
          <kbd className="rounded-sm border border-border-hairline px-1.5 py-0.5 text-[9px] text-text-tertiary">ESC</kbd>
        </div>
        <div tabIndex={0} className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && <div className="px-3 py-4 text-center text-[11px] text-text-tertiary">No matches.</div>}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => runCommand(cmd)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-[12px] ${
                i === activeIndex ? "bg-cyan/10 text-cyan" : "text-text-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-wide text-text-disabled">{cmd.group}</span>
                {cmd.label}
              </span>
              {i === activeIndex && <ArrowRight size={12} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const OPEN_EVENT = "highwaylab:open-command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function quickSave() {
  const activeId = getActiveProjectId();
  if (activeId && overwriteProject(activeId)) {
    toast("Project saved", "ok");
  } else {
    toast("No active saved project — use the folder icon to Save As", "warn");
  }
}
