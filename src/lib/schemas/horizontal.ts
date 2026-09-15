import { z } from "zod";

export const horizontalSchema = z.object({
  designSpeedMph: z.number().min(15).max(85),
  designVehicle: z.enum(["P", "SU-30", "WB-40", "WB-62", "WB-67"]),
  lanesPerDirection: z.number().int().min(1).max(6),
  laneWidthFt: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  shoulderInsideFt: z.number().min(2).max(12),
  shoulderOutsideFt: z.number().min(2).max(12),
  eNCPercent: z.number().min(-3).max(0),
  eMaxPercent: z.union([
    z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12),
  ]),
  axisOfRotation: z.enum(["centerline", "inside-edge", "outside-edge"]),
  lateralAccelC: z.number().min(1).max(3),
  transitionType: z.enum(["spiral", "linear"]),
  curveRadiusFt: z.number().positive().max(1_000_000),
  sightObstructionSSDFt: z.number().positive().optional(),
});

export type HorizontalFormInputs = z.infer<typeof horizontalSchema>;

export function safeParseHorizontal(data: unknown) {
  return horizontalSchema.safeParse(data);
}
