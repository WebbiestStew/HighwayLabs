import { z } from "zod";

export const earthworkControlsSchema = z.object({
  shrinkagePercent: z.number().min(10).max(25),
  swellPercent: z.number().min(15).max(35),
  excavationCost: z.number().nonnegative().max(1000),
  freeHaulDistanceFt: z.number().nonnegative().max(20000),
  overhaulCost: z.number().nonnegative().max(50),
  borrowCost: z.number().nonnegative().max(1000),
  wasteCost: z.number().nonnegative().max(1000),
});
export type EarthworkControlsInputs = z.infer<typeof earthworkControlsSchema>;

export const stationRowSchema = z.object({
  stationFt: z.number(),
  cutAreaSqFt: z.number().nonnegative().max(1_000_000),
  fillAreaSqFt: z.number().nonnegative().max(1_000_000),
});
