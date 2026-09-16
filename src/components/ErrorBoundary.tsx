"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  label: string;
}
interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors from a subtree (e.g. a canvas driven by
 * live numeric input that produced a pathological value) and shows a
 * recoverable fallback instead of taking down the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-sm border border-crimson/40 bg-crimson/5 p-4 text-center">
          <AlertTriangle size={20} className="text-crimson" />
          <div className="text-[11px] font-semibold uppercase tracking-wide text-crimson">
            {this.props.label} failed to render
          </div>
          <div className="max-w-xs text-[10px] text-text-tertiary">
            {this.state.error.message || "An unexpected error occurred with the current input values."}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 rounded-sm border border-crimson/40 px-2 py-1 text-[10px] text-crimson hover:bg-crimson/10"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
