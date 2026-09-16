"use client";

import { downloadBlob } from "./export/download";

// Named project snapshots — bundles every localStorage key this app uses
// (global project store, corridor summaries, each module's persisted form)
// into one named, saveable/loadable unit. Loading rewrites the underlying
// keys and reloads the page so every store/hook re-hydrates cleanly rather
// than trying to imperatively push state into every mounted component.

const PROJECT_KEYS = [
  "highwaylab.project",
  "highwaylab.corridor",
  "highwaylab.horizontal-alignment",
  "highwaylab.vertical-alignment",
  "highwaylab.interchange-ops",
  "highwaylab.earthwork",
  "highwaylab.pavement",
  "highwaylab.networkBuilder.v1",
];

const INDEX_KEY = "highwaylab.projects.index";
const ACTIVE_KEY = "highwaylab.activeProject";
const dataKey = (id: string) => `highwaylab.projects.data.${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  savedAt: number;
}

function readIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
  } catch {
    return [];
  }
}
function writeIndex(list: ProjectMeta[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — nothing we can do
  }
}

export function listProjects(): ProjectMeta[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function snapshotCurrentState(): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  for (const key of PROJECT_KEYS) snapshot[key] = localStorage.getItem(key);
  return snapshot;
}

export function saveProjectAs(name: string): string {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem(dataKey(id), JSON.stringify(snapshotCurrentState()));
  const list = readIndex();
  list.push({ id, name, savedAt: Date.now() });
  writeIndex(list);
  localStorage.setItem(ACTIVE_KEY, id);
  return id;
}

export function overwriteProject(id: string): boolean {
  const list = readIndex();
  if (!list.some((p) => p.id === id)) return false;
  localStorage.setItem(dataKey(id), JSON.stringify(snapshotCurrentState()));
  writeIndex(list.map((p) => (p.id === id ? { ...p, savedAt: Date.now() } : p)));
  return true;
}

export function loadProject(id: string): boolean {
  const raw = localStorage.getItem(dataKey(id));
  if (!raw) return false;
  try {
    const snapshot = JSON.parse(raw) as Record<string, string | null>;
    for (const key of PROJECT_KEYS) {
      if (snapshot[key] == null) localStorage.removeItem(key);
      else localStorage.setItem(key, snapshot[key] as string);
    }
    localStorage.setItem(ACTIVE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id: string) {
  localStorage.removeItem(dataKey(id));
  writeIndex(readIndex().filter((p) => p.id !== id));
  if (getActiveProjectId() === id) localStorage.removeItem(ACTIVE_KEY);
}

export function startNewProject() {
  for (const key of PROJECT_KEYS) localStorage.removeItem(key);
  localStorage.removeItem(ACTIVE_KEY);
}

export interface NewProjectFields {
  corridorName: string;
  unitSystem: "us" | "si";
  designSpeedMph: number;
  designVehicle: string;
  designStandard: string;
  stationStart: number;
  stationEnd: number;
}

/** Clears any existing working state and seeds a fresh project store from the given fields. */
export function createNewProject(fields: NewProjectFields) {
  startNewProject();
  localStorage.setItem(
    "highwaylab.project",
    JSON.stringify({
      state: fields,
      version: 0,
    })
  );
}

// --- File export / import ---------------------------------------------
// A local-file alternative to the localStorage-only save/load above, so a
// project can move between machines or be handed to a colleague without any
// server or account — just a .highwaylab.json file.

const FILE_FORMAT_VERSION = 1;

interface ProjectFile {
  app: "highwaylab";
  formatVersion: number;
  name: string;
  exportedAt: string;
  data: Record<string, string | null>;
}

function safeFileNamePart(name: string): string {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "project";
}

/** Downloads the current working state as a portable .highwaylab.json file. */
export function exportProjectToFile(name: string) {
  const file: ProjectFile = {
    app: "highwaylab",
    formatVersion: FILE_FORMAT_VERSION,
    name,
    exportedAt: new Date().toISOString(),
    data: snapshotCurrentState(),
  };
  downloadBlob(
    new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
    `${safeFileNamePart(name)}.highwaylab.json`
  );
}

export interface ImportResult {
  ok: boolean;
  name?: string;
  error?: string;
}

/** Reads a .highwaylab.json file and loads it as the current working state (does not auto-add it to the saved-projects list). */
export async function importProjectFromFile(file: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Record<string, unknown>).app !== "highwaylab" ||
    typeof (parsed as Record<string, unknown>).data !== "object"
  ) {
    return { ok: false, error: "That file doesn't look like a HighwayLab project export." };
  }
  const projectFile = parsed as ProjectFile;
  if (projectFile.formatVersion > FILE_FORMAT_VERSION) {
    return { ok: false, error: "This project file was exported by a newer version of HighwayLab." };
  }
  startNewProject();
  for (const key of PROJECT_KEYS) {
    const value = projectFile.data[key];
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
  return { ok: true, name: projectFile.name };
}
