"use client";

import type { StepDefinition, StepKind, WorkflowState } from "@/lib/types";
import { WORKFLOW } from "@/lib/workflow";
import { TimelineNode } from "./TimelineNode";

interface Props {
  state: WorkflowState;
  activeStep: StepKind | null;
  onSelectStep: (id: StepKind) => void;
}

export function Timeline({ state, activeStep, onSelectStep }: Props) {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-ink-700" />
      <ol className="space-y-3">
        {WORKFLOW.map((step: StepDefinition) => {
          const record = state.steps[step.id];
          return (
            <TimelineNode
              key={step.id}
              step={step}
              status={record?.status ?? "not_started"}
              isActive={activeStep === step.id}
              onClick={() => onSelectStep(step.id)}
            />
          );
        })}
      </ol>
    </div>
  );
}
