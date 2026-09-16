"use client";

// A minimal global toast bus — no context provider needed. Any client
// component can call toast(...) and the <Toaster/> mounted once in the root
// layout picks it up via a plain DOM CustomEvent.

export type ToastKind = "info" | "ok" | "warn" | "fail";

export interface ToastPayload {
  id: string;
  kind: ToastKind;
  message: string;
}

const EVENT_NAME = "highwaylab:toast";

export function toast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  const payload: ToastPayload = { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, message };
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT_NAME, { detail: payload }));
}

export function subscribeToasts(cb: (t: ToastPayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ToastPayload>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
