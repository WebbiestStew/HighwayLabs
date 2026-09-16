import { z } from "zod";

export const pavementSchema = z.object({
  w18: z.number().positive().max(500_000_000),
  reliabilityPercent: z.number().min(50).max(99.99),
  s0: z.number().min(0.3).max(0.5),
  p0: z.number().min(2).max(5),
  pt: z.number().min(1.5).max(3.5),
  mrPsi: z.number().min(500).max(50000),
  a1: z.number().min(0.1).max(0.6),
  d1: z.number().min(0.5).max(20),
  a2: z.number().min(0.02).max(0.4),
  d2: z.number().min(0).max(30),
  m2: z.number().min(0.4).max(1.4),
  a3: z.number().min(0.01).max(0.3),
  d3: z.number().min(0).max(30),
  m3: z.number().min(0.4).max(1.4),
}).refine((v) => v.p0 > v.pt, {
  message: "Initial PSI (p0) must exceed terminal PSI (pt)",
  path: ["p0"],
});

export type PavementFormInputs = z.infer<typeof pavementSchema>;
