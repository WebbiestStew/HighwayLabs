"use client";

import { useEffect, useRef } from "react";

/**
 * Generic per-module form persistence to localStorage. Loads any saved
 * values once on mount (applied through the matching setters) and saves the
 * current values on every subsequent change. The first save pass is
 * deliberately skipped — it would otherwise fire with pre-load defaults
 * (setter calls from the load effect haven't re-rendered yet) and clobber
 * whatever was just restored from storage.
 */
export function usePersistedForm<T extends Record<string, unknown>>(
  storageKey: string,
  values: T,
  setters: { [K in keyof T]: (v: T[K]) => void }
) {
  const firstSavePass = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<T>;
        for (const key of Object.keys(saved) as (keyof T)[]) {
          const setter = setters[key];
          if (saved[key] !== undefined && typeof setter === "function") {
            setter(saved[key] as T[keyof T]);
          }
        }
      }
    } catch {
      // malformed or unavailable storage — start from defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstSavePass.current) {
      firstSavePass.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // storage unavailable — skip persistence silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);
}
