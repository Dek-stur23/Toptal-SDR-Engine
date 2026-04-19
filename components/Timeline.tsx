"use client";

import type { Account, StepDefinition, StepKind } from "@/lib/types";
import { WORKFLOW } from "@/lib/workflow";
import { TimelineNode } from "./TimelineNode";

interface Props {
  account: Account;
  activeStep: StepKind | null;
  onSelectStep: (id: StepKind) => void;
}

export function Timeline({ account, activeStep, onSelectStep }: Props) {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-ink-700" />
      <ol className="space-y-3">
        {WORKFLOW.map((step: StepDefinition) => {
          const record = account.steps[step.id];
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
