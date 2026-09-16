"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save, Plus, Trash2, X, FolderInput, Download, Upload } from "lucide-react";
import {
  listProjects,
  saveProjectAs,
  overwriteProject,
  loadProject,
  deleteProject,
  startNewProject,
  getActiveProjectId,
  exportProjectToFile,
  importProjectFromFile,
  type ProjectMeta,
} from "@/lib/projects";
import { useProjectStore } from "@/lib/store";
import { toast } from "@/lib/toast";

export default function ProjectManager() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const corridorName = useProjectStore((s) => s.corridorName);

  // Load on mount (so the trigger button reflects the active project immediately)
  // and again whenever the modal opens (so it reflects changes made elsewhere,
  // e.g. after a save-as on another tab).
  useEffect(() => {
    setProjects(listProjects());
    setActiveId(getActiveProjectId());
  }, [open]);

  const activeProject = projects.find((p) => p.id === activeId);

  function refresh() {
    setProjects(listProjects());
    setActiveId(getActiveProjectId());
  }

  function handleSaveAs() {
    const name = newName.trim() || `Untitled Project ${new Date().toLocaleDateString()}`;
    saveProjectAs(name);
    setNewName("");
    refresh();
  }

  function handleSaveOverwrite() {
    if (!activeId) return;
    overwriteProject(activeId);
    refresh();
  }

  function handleLoad(id: string) {
    if (loadProject(id)) {
      window.location.reload();
    }
  }

  function handleDelete(id: string) {
    if (window.confirm("Delete this saved project? This cannot be undone.")) {
      deleteProject(id);
      refresh();
    }
  }

  function handleNewProject() {
    if (window.confirm("Start a new project? Any unsaved changes to the current working state will be lost (saved projects are unaffected).")) {
      startNewProject();
      window.location.reload();
    }
  }

  function handleExportFile() {
    exportProjectToFile(activeProject?.name ?? corridorName ?? "HighwayLab Project");
    toast("Project file downloaded", "ok");
  }

  async function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await importProjectFromFile(file);
    if (result.ok) {
      toast(`Imported "${result.name}"`, "ok");
      window.location.reload();
    } else {
      toast(result.error ?? "Import failed", "fail");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Project Manager"
        className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
        title="Project manager — save, load, or start a new project"
      >
        <FolderOpen size={12} />
        {activeProject ? activeProject.name : "Unsaved"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-sm border border-border-hairline bg-surface-1 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-hairline px-4 py-3">
              <span className="text-[12px] font-semibold text-text-primary">Project Manager</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div tabIndex={0} className="flex flex-col gap-3 overflow-y-auto p-4">
              <div className="flex flex-col gap-2 rounded-sm border border-border-hairline p-3">
                <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Save Current Working State</span>
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Project name…"
                    className="flex-1 rounded-sm border border-border-hairline bg-surface-4 px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-cyan/50"
                  />
                  <button
                    onClick={handleSaveAs}
                    className="flex items-center gap-1 rounded-sm border border-cyan/40 bg-cyan/10 px-2 py-1.5 text-[10px] text-cyan hover:bg-cyan/20"
                  >
                    <Save size={11} /> SAVE AS
                  </button>
                </div>
                {activeProject && (
                  <button
                    onClick={handleSaveOverwrite}
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-emerald/40 hover:text-emerald"
                  >
                    <Save size={11} /> SAVE TO &quot;{activeProject.name}&quot;
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Saved Projects ({projects.length})</span>
                {projects.length === 0 && <p className="text-[10px] text-text-tertiary">No saved projects yet.</p>}
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 rounded-sm border px-2 py-1.5 ${
                      p.id === activeId ? "border-cyan/40 bg-cyan/5" : "border-border-hairline"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-text-primary">{p.name}</div>
                      <div className="text-[10px] text-text-tertiary">{new Date(p.savedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleLoad(p.id)}
                        className="flex items-center gap-1 rounded-sm border border-border-hairline px-2 py-1 text-[10px] text-cyan hover:border-cyan/40"
                      >
                        <FolderInput size={10} /> LOAD
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="rounded-sm border border-border-hairline px-1.5 py-1 text-crimson hover:border-crimson/40"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportFile}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
                >
                  <Download size={11} /> EXPORT TO FILE
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-cyan/40 hover:text-cyan"
                >
                  <Upload size={11} /> IMPORT FROM FILE
                </button>
                <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFileSelected} />
              </div>

              <button
                onClick={handleNewProject}
                className="flex items-center justify-center gap-1.5 rounded-sm border border-border-hairline py-1.5 text-[10px] text-text-secondary hover:border-amber/40 hover:text-amber"
              >
                <Plus size={11} /> NEW PROJECT (RESET WORKING STATE)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
