"use client";

import { WORKFLOW } from "@/lib/workflow";
import type { WorkflowState } from "@/lib/types";

interface Props {
  state: WorkflowState;
  onAccountNameChange: (name: string) => void;
  onReset: () => void;
}

export function AccountHeader({ state, onAccountNameChange, onReset }: Props) {
  const total = WORKFLOW.length;
  const complete = WORKFLOW.filter(
    (s) => state.steps[s.id]?.status === "complete",
  ).length;
  const pct = Math.round((complete / total) * 100);

  return (
    <header className="border-b border-ink-800 bg-ink-900/60 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-5xl px-6 py-5 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="text-sm text-ink-400">Toptal</div>
            <div className="text-lg font-semibold text-white">SDR Engine</div>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-ink-400 mb-1">Active account</label>
          <input
            value={state.accountName}
            onChange={(e) => onAccountNameChange(e.target.value)}
            placeholder="e.g. Acme Global Holdings"
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-white placeholder-ink-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="w-48">
          <div className="flex items-center justify-between text-xs text-ink-400 mb-1">
            <span>Progress</span>
            <span>
              {complete}/{total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={onReset}
          className="text-xs text-ink-400 hover:text-white transition"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
