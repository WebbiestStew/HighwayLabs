# HighwayLab

Enterprise-grade highway geometric design, traffic operations, and earthwork
engineering workstation. Next.js (App Router) + TypeScript + Tailwind CSS +
Canvas/WebGL-style vector rendering + Recharts, styled as a monochrome dark
CAD terminal.

## Getting started

Land on **`/start`** (the app routes you there automatically on a fresh
project): create a new project, open a previously saved one, import a
`.highwaylab.json` file, or load the bundled demo corridor to see all six
modules working together immediately. `⌘K` / `Ctrl+K` opens a command
palette to jump anywhere; `⌘S` quick-saves the active project.

## Modules

0. **Project Overview** — cross-module corridor dashboard: a station ruler
   plotting every published control point (horizontal TS/SC, vertical
   PVC/PVI/PVT, interchange location) alongside a pass/fail card per module.
1. **Horizontal Alignment** — superelevation transition (AASHTO Method 5
   approximation) with the classic **2/3-tangent / 1/3-curve runoff split**
   for simple (unspiraled) curves, clothoid spiral design, tangent runout /
   runoff, pavement widening, station-by-station cross-section visualizer,
   axis-of-rotation selector that actually re-pivots the elevation diagram.
   Also includes a **3D corridor viewer** (React Three Fiber,
   orbit-controllable, vertical exaggeration slider) that extrudes the full
   tangent–spiral–arc–spiral–tangent geometry into a low-poly pavement
   ribbon showing superelevation roll into the curve, and can drape that
   ribbon over a **real natural-ground line** fetched from a **Terrain /
   GIS import** (drop a GeoJSON path or click points on a satellite/street
   basemap; elevation via Open-Meteo's free SRTM-derived API — no Mapbox/
   USGS account needed) so the corridor visibly cuts through real
   topography instead of flat space; a **sight-distance envelope overlay**
   (plan-view SSD sight chord, required horizontal sightline offset M, and
   a live clear/violation check against a user-entered obstruction
   clearance); and real **3D-polyline DXF** and **LandXML
   `<Alignment>`/`<CoordGeom>`** export, sourced from the same clothoid
   geometry engine as the viewer.
2. **Vertical Alignment** — parabolic crest/sag curves, K-factor design,
   SSD, overhead structure clearance checking, one-click sync of PVC station
   to Module 1's horizontal SC.
3. **Interchange / HCM Operations** — merge/diverge influence-area density
   (with a ramp/mainline speed-differential turbulence penalty), weaving
   analysis, signalized ramp-terminal CMA (Webster), D/D/1 queuing, with
   selectable interchange topology schematics (diamond, parclo, SPUI, DDI,
   stack, turbine, TxDOT frontage/U-turn) — deep-linkable via `?topology=`,
   with a breadcrumb back to the Network Builder when arriving that way.
4. **Earthwork / Mass-Haul** — average end-area volumes, prismoidal
   correction, shrinkage/swell adjustment, interactive draggable mass-haul
   balance line (with a visible grip handle) and free-haul/overhaul
   segregation. Station range can sync to the project's corridor range, and
   shows a live pavement-width reference pulled from Module 1.
5. **Pavement SN Design** — 1993 AASHTO flexible pavement empirical
   equation, solved iteratively for required Structural Number, layered
   cross-section diagram.
6. **Network Builder** — freeform corridor/interchange sandbox: draw
   freeway/arterial/ramp/local segments, drop any of the 7 interchange
   presets onto the canvas, pan/zoom, undo, live mileage and planning-level
   cost estimate — with a direct "Analyze in HCM Ops" link from any placed
   interchange into Module 3.

Every module includes a **Calculation Transparency Drawer** (full
step-by-step proof with substituted values, an "≈ approx." badge on steps
that are curve-fit representative models rather than closed-form equations,
and the active AASHTO/TxDOT governing-standard citation) and exports a
print-ready **PE Calculation Memorandum** — a PDF with embedded diagram
captures, **real LaTeX-typeset governing formulas** (MathJax SVG output,
rendered server-side via `/api/render-formula` and rasterized into the PDF —
not plain monospace text), a diagonal **"PRELIMINARY — NOT FOR
CONSTRUCTION"** watermark on every page, and an engineer review/seal
block — plus **CSV / DXF** alignment data.

## Cross-cutting features

- **Start screen** (`/start`) — new project, open saved project, import a
  project file, or load a fully-configured demo corridor. Also offers
  **1-click TxDOT/AASHTO templates** — "TxDOT Rural Interstate" (75 mph,
  e_max 8%), "Urban Arterial Divided" (45 mph, e_max 4%), and "Mountain
  Pass Highway" (50 mph, e_max 6%) — each a full, R ≥ R_min compliant
  Horizontal Alignment configuration, verified against the app's own
  engine in `presets.test.ts`, not just plausible-looking numbers.
- **Project portability** — named local save/load (Project Manager, top
  bar) plus **export/import as a `.highwaylab.json` file**, so a project can
  move between machines or be handed to a colleague with no backend.
- **Command palette** (`⌘K`) and quick-save (`⌘S`).
- **Global unit engine** (US Customary / SI) and an **AASHTO / TxDOT RDM**
  governing-standard toggle (citation-level only — see disclaimer).
- **Live input validation** — every numeric field is checked against a Zod
  schema in real time, with inline error text, a range hint, and a summary
  banner; results still compute live underneath so out-of-policy values
  stay visible rather than silently blocked.
- **Full persistence** — the global project bar, corridor summaries, and
  every module's form state survive a reload (localStorage).
- **Error boundaries** around every canvas/chart and at the page level, so a
  pathological input can't take down the whole app.
- **Accessible by default** — WCAG AA text contrast, labeled form controls,
  keyboard-focusable scroll regions, and a status-flash animation that never
  dims text below readable contrast. Enforced by an automated axe-core scan
  (see Testing below), not just eyeballed.

## Engineering disclaimer

Empirical coefficient curves (side friction, relative gradient, K-factors,
HCM density-LOS models, etc.) are digitized representative approximations of
published AASHTO Green Book / HCM / TxDOT RDM design values for engineering
education and preliminary design use — not a verbatim reproduction of the
copyrighted exhibits. The AASHTO/TxDOT toggle changes citations only, not the
underlying formulas — there is no separately verified TxDOT-specific
coefficient table swapped in. The calculation drawer flags the specific
steps that are curve-fit approximations (vs. standard closed-form
equations) with an "≈ approx." badge. Verify against the current governing
edition and have a licensed PE review and seal all calculations before PS&E
submittal or construction use.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build     # production build + type-check
npm run lint
```

## Testing

```bash
npm run test      # Vitest — unit tests on the engineering calculation engines
npm run test:e2e  # Playwright — end-to-end tests across every route, plus
                   # an axe-core accessibility scan (npx playwright test e2e/accessibility.spec.ts)
```

E2E tests reuse an already-running `next dev` server on :3000 if one is up,
otherwise Playwright starts one itself.

## Known gaps

- Empirical curves (AASHTO Method 5, HCM merge/diverge/weaving) are
  representative curve-fits, not digitizations of the actual governing
  tables — flagged in-app, not silently presented as authoritative.
- Interchange topology schematics are simplified node-graphs, not
  CAD-accurate geometry.
- Earthwork cut/fill areas are still hand-entered — there's no
  terrain/ground-survey model to derive them from the designed template.
- The 3D corridor viewer, DXF/LandXML export, and sight-distance overlay
  always model superelevation about the pavement centerline, regardless of
  Module 1's Axis of Rotation setting (inside-/outside-edge rotation isn't
  reflected in the 3D geometry, only in the 2D superelevation ledger).
- LandXML export is a good-faith interoperability export (well-formed
  `<Alignment>`/`<CoordGeom>` with Line/Spiral/Curve elements) — it hasn't
  been round-tripped against every CAD vendor's importer.
- Terrain import borrows a real path's elevation *shape* (Open-Meteo,
  ~90 m SRTM-derived resolution) and re-anchors it to the corridor's own
  arc-length range — the picked path's real-world geographic position and
  orientation are not otherwise tied to the design (no coordinate system
  registration), and Start Elevation auto-snaps to the terrain's first
  sample rather than the user's own design intent.
- No multi-user accounts or server-side storage; everything is local to one
  browser unless exported as a project file.
