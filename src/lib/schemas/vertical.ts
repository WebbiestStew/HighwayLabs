import { z } from "zod";

export const verticalSchema = z.object({
  curveClass: z.enum(["crest", "sag"]),
  pvcStationFt: z.number(),
  pvcElevationFt: z.number(),
  g1Percent: z.number().min(-15).max(15),
  g2Percent: z.number().min(-15).max(15),
  lengthMode: z.enum(["auto", "manual"]),
  manualLengthFt: z.number().positive().max(20000),
  sagCurbedUrban: z.boolean(),
});

export type VerticalFormInputs = z.infer<typeof verticalSchema>;
