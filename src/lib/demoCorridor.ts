"use client";

// A fully-configured example corridor spanning all six modules, so a new
// user lands on a working, internally-consistent project instead of six
// empty forms. Every derived corridor-store summary is computed through the
// same engines the app uses at runtime (not hand-typed), so the numbers on
// the Overview dashboard are guaranteed to match what each module would
// itself compute from the same seeded inputs.

import { computeHorizontal, type HorizontalInputs } from "./engineering/horizontal";
import { computeVertical, type VerticalInputs } from "./engineering/vertical";
import { computeMergeDiverge, computeWeaving, computeRampTerminal } from "./engineering/hcmOps";
import { computeEarthwork, type StationRow } from "./engineering/earthwork";
import { computePavement, type PavementInputs } from "./engineering/pavement";
import { computeNetworkStats, type NetworkState } from "./engineering/networkBuilder";
import { TOPOLOGIES } from "./engineering/interchangeTopologies";
import { startNewProject } from "./projects";

const CORRIDOR_NAME = "US-290 Bypass — STA 100+00 TO 250+00";
const DESIGN_SPEED_MPH = 65;
const DESIGN_VEHICLE = "WB-62";
const DESIGN_STANDARD = "txdot-rdm";
const STATION_START = 10000;
const STATION_END = 25000;

const horizontalInputs: HorizontalInputs = {
  designSpeedMph: DESIGN_SPEED_MPH,
  designVehicle: DESIGN_VEHICLE,
  lanesPerDirection: 2,
  laneWidthFt: 12,
  shoulderInsideFt: 4,
  shoulderOutsideFt: 10,
  eNCPercent: -2,
  eMaxPercent: 6,
  axisOfRotation: "centerline",
  lateralAccelC: 1.5,
  transitionType: "spiral",
  curveRadiusFt: 2000,
};

const verticalInputs: VerticalInputs = {
  curveClass: "crest",
  designSpeedMph: DESIGN_SPEED_MPH,
  pvcStationFt: 12000,
  pvcElevationFt: 450,
  g1Percent: 1.5,
  g2Percent: -2.0,
  lengthMode: "auto",
  manualLengthFt: 700,
  structure: { stationFt: 12400, girderElevationFt: 468, widthFt: 44, requiredClearanceFt: 16.5 },
  sagCurbedUrban: false,
};

const interchangeFields = {
  topologyId: "diamond" as const,
  interchangeStationFt: 18000,
  rampDemandVph: 580,
  freewayUpstreamVph: 3800,
  freewayLanes: 3,
  accelLaneFt: 660,
  phf: 0.93,
  heavyPct: 6,
  pce: 2.0,
  weaveVph: 750,
  nonWeaveVph: 3200,
  weaveLengthFt: 1400,
  minWeaveLanes: 2,
  totalWeaveLanes: 4,
  rampFfs: 45,
  mainlineFfs: 65,
  criticalNS: 650,
  satNS: 1800,
  criticalEW: 480,
  satEW: 1700,
  numPhases: 3,
  lostTimePerPhase: 4,
  oversatDurationMin: 15,
  postPeakVph: 1200,
};

function makeDemoRows(): StationRow[] {
  const cuts = [0, 140, 280, 360, 220, 70, 0, 0, 50, 190, 320, 270, 100, 0];
  const fills = [15, 0, 0, 0, 45, 170, 290, 330, 210, 55, 0, 0, 35, 160];
  return cuts.map((c, i) => ({
    id: `demo_r${i}`,
    stationFt: STATION_START + i * 500,
    cutAreaSqFt: c,
    fillAreaSqFt: fills[i],
  }));
}

const earthworkFields = {
  rows: makeDemoRows(),
  soilClass: "common-soil" as const,
  applyPrismoidal: false,
  balanceLevelCy: 0,
  shrinkagePercent: 15,
  swellPercent: 20,
  excavationCost: 9,
  freeHaulDistanceFt: 500,
  overhaulCost: 0.4,
  borrowCost: 13,
  wasteCost: 4.5,
};

const pavementInputs: PavementInputs = {
  w18: 6_000_000,
  reliabilityPercent: 95,
  s0: 0.45,
  p0: 4.2,
  pt: 2.5,
  mrPsi: 8000,
  a1: 0.44,
  d1: 5,
  a2: 0.14,
  d2: 9,
  m2: 1,
  a3: 0.11,
  d3: 7,
  m3: 1,
};

const networkBuilderState: NetworkState = {
  nodes: [
    { id: "demo_n1", x: -2000, y: 0 },
    { id: "demo_n2", x: 2000, y: 0 },
  ],
  segments: [{ id: "demo_s1", a: "demo_n1", b: "demo_n2", type: "freeway" }],
  stamps: [{ id: "demo_stamp1", topologyId: "diamond", x: 0, y: 0, footprintFt: 2200, rotationDeg: 0 }],
};

export function loadDemoCorridor() {
  // Clears any prior working state AND the "active saved project" marker —
  // the demo is fresh unsaved working state, not a continuation of whatever
  // project was previously loaded, so the Project Manager button shouldn't
  // keep showing a stale project name after this runs.
  startNewProject();

  const horizontalResults = computeHorizontal(horizontalInputs);
  const verticalResults = computeVertical(verticalInputs);
  const mergeResults = computeMergeDiverge(
    {
      rampDemandVph: interchangeFields.rampDemandVph,
      freewayUpstreamVph: interchangeFields.freewayUpstreamVph,
      freewayLanes: interchangeFields.freewayLanes,
      accelDecelLaneLengthFt: interchangeFields.accelLaneFt,
      phf: interchangeFields.phf,
      heavyVehiclePercent: interchangeFields.heavyPct,
      passengerCarEquivalent: interchangeFields.pce,
      rampFfsMph: interchangeFields.rampFfs,
      mainlineFfsMph: interchangeFields.mainlineFfs,
    },
    "merge"
  );
  const weavingResults = computeWeaving({
    weavingVolumeVph: interchangeFields.weaveVph,
    nonWeavingVolumeVph: interchangeFields.nonWeaveVph,
    weavingSegmentLengthFt: interchangeFields.weaveLengthFt,
    minWeavingLanes: interchangeFields.minWeaveLanes,
    totalLanes: interchangeFields.totalWeaveLanes,
    freewayFfsMph: interchangeFields.mainlineFfs,
    phf: interchangeFields.phf,
    heavyVehiclePercent: interchangeFields.heavyPct,
    passengerCarEquivalent: interchangeFields.pce,
  });
  const rampTerminalResults = computeRampTerminal({
    criticalMovements: [
      { name: "N-S Through/Left", volumeVph: interchangeFields.criticalNS, saturationFlowVphpl: interchangeFields.satNS },
      { name: "E-W Ramp Approach", volumeVph: interchangeFields.criticalEW, saturationFlowVphpl: interchangeFields.satEW },
    ],
    numberOfPhases: interchangeFields.numPhases,
    lostTimePerPhaseSec: interchangeFields.lostTimePerPhase,
  });
  const earthworkResults = computeEarthwork({
    rows: earthworkFields.rows,
    soilClass: earthworkFields.soilClass,
    shrinkagePercent: earthworkFields.shrinkagePercent,
    swellPercent: earthworkFields.swellPercent,
    applyPrismoidalCorrection: earthworkFields.applyPrismoidal,
    excavationUnitCostPerCy: earthworkFields.excavationCost,
    freeHaulDistanceFt: earthworkFields.freeHaulDistanceFt,
    overhaulUnitCostPerStationYd: earthworkFields.overhaulCost,
    borrowUnitCostPerCy: earthworkFields.borrowCost,
    wasteUnitCostPerCy: earthworkFields.wasteCost,
  });
  const pavementResults = computePavement(pavementInputs);
  const networkStats = computeNetworkStats(networkBuilderState);

  const now = Date.now();

  localStorage.setItem(
    "highwaylab.project",
    JSON.stringify({
      state: {
        corridorName: CORRIDOR_NAME,
        unitSystem: "us",
        designSpeedMph: DESIGN_SPEED_MPH,
        designVehicle: DESIGN_VEHICLE,
        designStandard: DESIGN_STANDARD,
        stationStart: STATION_START,
        stationEnd: STATION_END,
      },
      version: 0,
    })
  );

  localStorage.setItem("highwaylab.horizontal-alignment", JSON.stringify(horizontalInputs));
  localStorage.setItem("highwaylab.vertical-alignment", JSON.stringify({
    curveClass: verticalInputs.curveClass,
    pvcStationFt: verticalInputs.pvcStationFt,
    pvcElevationFt: verticalInputs.pvcElevationFt,
    g1Percent: verticalInputs.g1Percent,
    g2Percent: verticalInputs.g2Percent,
    lengthMode: verticalInputs.lengthMode,
    manualLengthFt: verticalInputs.manualLengthFt,
    sagCurbedUrban: verticalInputs.sagCurbedUrban,
    hasStructure: true,
    structureStationFt: verticalInputs.structure!.stationFt,
    girderElevationFt: verticalInputs.structure!.girderElevationFt,
    structureWidthFt: verticalInputs.structure!.widthFt,
    requiredClearanceFt: verticalInputs.structure!.requiredClearanceFt,
  }));
  localStorage.setItem("highwaylab.interchange-ops", JSON.stringify(interchangeFields));
  localStorage.setItem("highwaylab.earthwork", JSON.stringify(earthworkFields));
  localStorage.setItem("highwaylab.pavement", JSON.stringify(pavementInputs));
  localStorage.setItem("highwaylab.networkBuilder.v1", JSON.stringify(networkBuilderState));

  localStorage.setItem(
    "highwaylab.corridor",
    JSON.stringify({
      state: {
        horizontal: {
          curveRadiusFt: horizontalInputs.curveRadiusFt,
          tsStationFt: STATION_START,
          scStationFt: STATION_START + horizontalResults.totalTransitionFt,
          eDesignPercent: horizontalResults.eDesignPercent,
          meetsRMin: horizontalResults.meetsRMin,
          designSpeedMph: DESIGN_SPEED_MPH,
          pavementWidthFt: horizontalInputs.lanesPerDirection * horizontalInputs.laneWidthFt,
          updatedAt: now,
        },
        vertical: {
          curveClass: verticalInputs.curveClass,
          pvcStationFt: verticalInputs.pvcStationFt,
          pviStationFt: verticalResults.pviStationFt,
          pvtStationFt: verticalResults.pvtStationFt,
          highLowStationFt: verticalResults.extremaStationFt,
          meetsKMin: verticalResults.meetsKMin,
          structurePass: verticalResults.structureCheck ? verticalResults.structureCheck.pass : null,
          updatedAt: now,
        },
        interchange: {
          stationFt: interchangeFields.interchangeStationFt,
          topologyLabel: TOPOLOGIES[interchangeFields.topologyId].label,
          mergeLOS: mergeResults.los,
          weaveLOS: weavingResults.los,
          rampSignalLOS: rampTerminalResults.los,
          updatedAt: now,
        },
        earthwork: {
          startStationFt: earthworkFields.rows[0].stationFt,
          endStationFt: earthworkFields.rows[earthworkFields.rows.length - 1].stationFt,
          netEndOrdinateCy: earthworkResults.netEndOrdinateCy,
          borrowRequiredCy: earthworkResults.borrowRequiredCy,
          wasteRequiredCy: earthworkResults.wasteRequiredCy,
          grandTotalCost: earthworkResults.grandTotalCost,
          updatedAt: now,
        },
        pavement: {
          snRequired: pavementResults.snRequired,
          snProvided: pavementResults.snProvided,
          pass: pavementResults.pass,
          updatedAt: now,
        },
        network: {
          totalMiles: networkStats.totalMiles,
          interchangeCount: networkStats.interchangeStampCount,
          estimatedCost: networkStats.estimatedCost,
          updatedAt: now,
        },
      },
      version: 0,
    })
  );

  window.location.href = "/overview";
}
