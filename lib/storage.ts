"use client";

import type { StepKind, StepRecord, WorkflowState } from "./types";
import { WORKFLOW } from "./workflow";

const ROOT_KEY = "toptal-sdr-engine::workflow";

function emptyRecord(): StepRecord {
  return { status: "not_started", updatedAt: null, data: {} };
}

function emptyState(): WorkflowState {
  const steps = WORKFLOW.reduce(
    (acc, step) => {
      acc[step.id] = emptyRecord();
      return acc;
    },
    {} as Record<StepKind, StepRecord>,
  );
  return { accountName: "", steps };
}

export function loadState(): WorkflowState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(ROOT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<WorkflowState>;
    const base = emptyState();
    return {
      accountName: parsed.accountName ?? "",
      steps: { ...base.steps, ...(parsed.steps ?? {}) },
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: WorkflowState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOT_KEY, JSON.stringify(state));
}

export function resetState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROOT_KEY);
}
