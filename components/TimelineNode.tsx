"use client";

import type { StepDefinition, StepStatus } from "@/lib/types";

interface Props {
  step: StepDefinition;
  status: StepStatus;
  isActive: boolean;
  onClick: () => void;
}

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: "bg-ink-800 border-ink-600",
  in_progress: "bg-amber-500/20 border-amber-400",
  complete: "bg-emerald-500/25 border-emerald-400",
};

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

const STATUS_LABEL_CLS: Record<StepStatus, string> = {
  not_started: "text-ink-500",
  in_progress: "text-amber-300",
  complete: "text-emerald-300",
};

export function TimelineNode({ step, status, isActive, onClick }: Props) {
  return (
    <li className="relative">
      <button
        onClick={onClick}
        className={[
          "group w-full text-left pl-14 pr-4 py-4 rounded-xl border transition-all",
          isActive
            ? "border-brand-500/60 bg-ink-800/80 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
            : "border-ink-800 bg-ink-900/40 hover:bg-ink-800/60 hover:border-ink-700",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-2 top-4 h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold text-white",
            STATUS_DOT[status],
          ].join(" ")}
        >
          {status === "complete" ? "\u2713" : step.order}
        </span>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{step.title}</div>
            <div className="text-sm text-ink-400 truncate">{step.subtitle}</div>
          </div>
          <div className="flex flex-col items-end text-xs shrink-0">
            <span className={STATUS_LABEL_CLS[status]}>
              {STATUS_LABEL[status]}
            </span>
            <span className="text-ink-500">~{step.estMinutes}m</span>
          </div>
        </div>
      </button>
    </li>
  );
}
