"use client";

import type {
  Account,
  AppState,
  StepKind,
  StepRecord,
} from "./types";
import { WORKFLOW } from "./workflow";

const ROOT_KEY = "toptal-sdr-engine::app";
const LEGACY_KEY = "toptal-sdr-engine::workflow";

function emptyStepRecord(): StepRecord {
  return { status: "not_started", updatedAt: null, data: {} };
}

function emptySteps(): Record<StepKind, StepRecord> {
  return WORKFLOW.reduce(
    (acc, step) => {
      acc[step.id] = emptyStepRecord();
      return acc;
    },
    {} as Record<StepKind, StepRecord>,
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAccount(name: string = ""): Account {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name.trim(),
    status: "active",
    createdAt: now,
    updatedAt: now,
    steps: emptySteps(),
  };
}

function emptyApp(): AppState {
  return { accounts: [], activeAccountId: null, sidebarCollapsed: false };
}

function migrateLegacy(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw) as {
      accountName?: string;
      steps?: Record<string, StepRecord>;
    };
    const hasContent =
      (parsed.accountName && parsed.accountName.trim().length > 0) ||
      Object.values(parsed.steps ?? {}).some(
        (s) => s && s.status !== "not_started",
      );
    if (!hasContent) return null;
    const acct = createAccount(parsed.accountName ?? "");
    acct.steps = { ...acct.steps, ...(parsed.steps ?? {}) };
    return {
      accounts: [acct],
      activeAccountId: acct.id,
      sidebarCollapsed: false,
    };
  } catch {
    return null;
  }
}

export function loadAppState(): AppState {
  if (typeof window === "undefined") return emptyApp();
  try {
    const raw = window.localStorage.getItem(ROOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        accounts: (parsed.accounts ?? []).map((a) => ({
          ...a,
          steps: { ...emptySteps(), ...(a.steps ?? {}) },
        })),
        activeAccountId: parsed.activeAccountId ?? null,
        sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      };
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateLegacy(legacy);
      if (migrated) return migrated;
    }
    return emptyApp();
  } catch {
    return emptyApp();
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOT_KEY, JSON.stringify(state));
}

export function resetAppState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROOT_KEY);
  window.localStorage.removeItem(LEGACY_KEY);
}

export function accountProgress(account: Account): {
  complete: number;
  total: number;
} {
  const total = WORKFLOW.length;
  const complete = WORKFLOW.filter(
    (s) => account.steps[s.id]?.status === "complete",
  ).length;
  return { complete, total };
}
