"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountHeader } from "@/components/AccountHeader";
import { Timeline } from "@/components/Timeline";
import { StepPanel } from "@/components/StepPanel";
import { loadState, resetState, saveState } from "@/lib/storage";
import type { StepKind, StepRecord, WorkflowState } from "@/lib/types";
import { WORKFLOW, WORKFLOW_BY_ID } from "@/lib/workflow";

export default function Page() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [activeStep, setActiveStep] = useState<StepKind>("account_research");

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const step = useMemo(() => WORKFLOW_BY_ID[activeStep], [activeStep]);
  const record: StepRecord | null = state ? state.steps[activeStep] : null;

  function updateStep(id: StepKind, partial: Partial<StepRecord>) {
    setState((prev) => {
      if (!prev) return prev;
      const existing = prev.steps[id];
      return {
        ...prev,
        steps: {
          ...prev.steps,
          [id]: { ...existing, ...partial },
        },
      };
    });
  }

  function handleReset() {
    if (!confirm("Reset all workflow data for this browser?")) return;
    resetState();
    setState(loadState());
    setActiveStep("account_research");
  }

  if (!state || !record) {
    return (
      <main className="min-h-screen flex items-center justify-center text-ink-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AccountHeader
        state={state}
        onAccountNameChange={(name) =>
          setState((prev) => (prev ? { ...prev, accountName: name } : prev))
        }
        onReset={handleReset}
      />

      <div className="mx-auto max-w-5xl px-6 py-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-[110px] h-fit">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Workflow
            </h2>
            <span className="text-xs text-ink-500">{WORKFLOW.length} steps</span>
          </div>
          <Timeline
            state={state}
            activeStep={activeStep}
            onSelectStep={setActiveStep}
          />
        </aside>

        <div>
          <StepPanel
            step={step}
            state={state}
            record={record}
            onChange={updateStep}
          />
        </div>
      </div>
    </main>
  );
}
