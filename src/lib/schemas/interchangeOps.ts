import { z } from "zod";

export const interchangeOpsSchema = z.object({
  rampDemandVph: z.number().min(0).max(10000),
  freewayUpstreamVph: z.number().min(0).max(20000),
  freewayLanes: z.number().int().min(2).max(8),
  accelLaneFt: z.number().positive().max(5000),
  phf: z.number().min(0.8).max(0.98),
  heavyPct: z.number().min(0).max(40),
  pce: z.number().min(1.5).max(2.5),

  weaveVph: z.number().min(0).max(10000),
  nonWeaveVph: z.number().min(0).max(20000),
  weaveLengthFt: z.number().positive().max(10000),
  minWeaveLanes: z.number().int().min(1).max(3),
  totalWeaveLanes: z.number().int().min(2).max(8),
  rampFfs: z.number().min(25).max(55),
  mainlineFfs: z.number().min(55).max(75),

  criticalNS: z.number().min(0).max(5000),
  satNS: z.number().positive().max(2200),
  criticalEW: z.number().min(0).max(5000),
  satEW: z.number().positive().max(2200),
  numPhases: z.number().int().min(2).max(8),
  lostTimePerPhase: z.number().min(2).max(6),

  oversatDurationMin: z.number().min(1).max(180),
  postPeakVph: z.number().min(0).max(10000),
});

export type InterchangeOpsFormInputs = z.infer<typeof interchangeOpsSchema>;
