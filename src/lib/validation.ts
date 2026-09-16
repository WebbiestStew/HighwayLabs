import type { z } from "zod";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** Runs a Zod schema against a raw data object and returns a flat field->message error map. */
export function validateInputs<T extends z.ZodTypeAny>(schema: T, data: unknown): ValidationResult {
  const result = schema.safeParse(data);
  if (result.success) return { valid: true, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

export function clampNum(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
