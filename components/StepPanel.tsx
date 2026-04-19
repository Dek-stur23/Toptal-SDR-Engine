"use client";

import type {
  StepDefinition,
  StepKind,
  StepRecord,
  WorkflowState,
} from "@/lib/types";
import { AccountResearch } from "./steps/AccountResearch";
import { GenericStep } from "./steps/GenericStep";

interface Props {
  step: StepDefinition;
  state: WorkflowState;
  record: StepRecord;
  onChange: (id: StepKind, partial: Partial<StepRecord>) => void;
}

export function StepPanel({ step, state, record, onChange }: Props) {
  return (
    <section className="rounded-xl border border-ink-800 bg-ink-900/60">
      <div className="px-6 py-5 border-b border-ink-800">
        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Step {step.order} of 6
          </span>
          <span>~{step.estMinutes} min</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-white">{step.title}</h2>
        <p className="text-ink-400 mt-1">{step.subtitle}</p>
        <p className="text-sm text-ink-400 mt-3 leading-relaxed">
          {step.description}
        </p>
      </div>

      <div className="p-6">
        {step.id === "account_research" ? (
          <AccountResearch
            state={state}
            record={record}
            onChange={(partial) => onChange(step.id, partial)}
          />
        ) : (
          <GenericStep
            step={step}
            state={state}
            record={record}
            onChange={(partial) => onChange(step.id, partial)}
          />
        )}
      </div>
    </section>
  );
}
