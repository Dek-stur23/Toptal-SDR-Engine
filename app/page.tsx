"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountHeader } from "@/components/AccountHeader";
import { Sidebar } from "@/components/Sidebar";
import { Timeline } from "@/components/Timeline";
import { StepPanel } from "@/components/StepPanel";
import {
  createAccount,
  loadAppState,
  saveAppState,
} from "@/lib/storage";
import type {
  Account,
  AppState,
  StepKind,
  StepRecord,
} from "@/lib/types";
import { WORKFLOW_BY_ID } from "@/lib/workflow";

const SIDEBAR_WIDTH_EXPANDED = 288;
const SIDEBAR_WIDTH_COLLAPSED = 48;

export default function Page() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeStep, setActiveStep] = useState<StepKind>("account_research");

  useEffect(() => {
    setState(loadAppState());
  }, []);

  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const activeAccount: Account | null = useMemo(() => {
    if (!state || !state.activeAccountId) return null;
    return state.accounts.find((a) => a.id === state.activeAccountId) ?? null;
  }, [state]);

  const handleCreateAccount = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const acct = createAccount("");
      return {
        ...prev,
        accounts: [acct, ...prev.accounts],
        activeAccountId: acct.id,
      };
    });
    setActiveStep("account_research");
  }, []);

  const handleSelectAccount = useCallback((id: string) => {
    setState((prev) => (prev ? { ...prev, activeAccountId: id } : prev));
    setActiveStep("account_research");
  }, []);

  const handleArchiveAccount = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const accounts = prev.accounts.map((a) =>
        a.id === id ? { ...a, status: "archived" as const, updatedAt: now } : a,
      );
      const activeAccountId =
        prev.activeAccountId === id
          ? (accounts.find((a) => a.status === "active")?.id ?? null)
          : prev.activeAccountId;
      return { ...prev, accounts, activeAccountId };
    });
  }, []);

  const handleRestoreAccount = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const accounts = prev.accounts.map((a) =>
        a.id === id ? { ...a, status: "active" as const, updatedAt: now } : a,
      );
      return { ...prev, accounts, activeAccountId: id };
    });
  }, []);

  const handleDeleteAccount = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const accounts = prev.accounts.filter((a) => a.id !== id);
      const activeAccountId =
        prev.activeAccountId === id
          ? (accounts.find((a) => a.status === "active")?.id ??
            accounts[0]?.id ??
            null)
          : prev.activeAccountId;
      return { ...prev, accounts, activeAccountId };
    });
  }, []);

  const handleRenameActive = useCallback((name: string) => {
    setState((prev) => {
      if (!prev || !prev.activeAccountId) return prev;
      const now = new Date().toISOString();
      const accounts = prev.accounts.map((a) =>
        a.id === prev.activeAccountId ? { ...a, name, updatedAt: now } : a,
      );
      return { ...prev, accounts };
    });
  }, []);

  const handleToggleCollapsed = useCallback(() => {
    setState((prev) =>
      prev ? { ...prev, sidebarCollapsed: !prev.sidebarCollapsed } : prev,
    );
  }, []);

  const handleStepChange = useCallback(
    (id: StepKind, partial: Partial<StepRecord>) => {
      setState((prev) => {
        if (!prev || !prev.activeAccountId) return prev;
        const now = new Date().toISOString();
        const accounts = prev.accounts.map((a) => {
          if (a.id !== prev.activeAccountId) return a;
          const existing = a.steps[id];
          return {
            ...a,
            updatedAt: now,
            steps: { ...a.steps, [id]: { ...existing, ...partial } },
          };
        });
        return { ...prev, accounts };
      });
    },
    [],
  );

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center text-ink-500">
        Loading…
      </main>
    );
  }

  const leftOffset = state.sidebarCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  const step = WORKFLOW_BY_ID[activeStep];
  const record: StepRecord | null = activeAccount
    ? activeAccount.steps[activeStep]
    : null;

  return (
    <main className="min-h-screen">
      <Sidebar
        accounts={state.accounts}
        activeAccountId={state.activeAccountId}
        collapsed={state.sidebarCollapsed}
        onToggleCollapsed={handleToggleCollapsed}
        onCreateAccount={handleCreateAccount}
        onSelectAccount={handleSelectAccount}
        onArchiveAccount={handleArchiveAccount}
        onRestoreAccount={handleRestoreAccount}
        onDeleteAccount={handleDeleteAccount}
      />

      <div
        style={{ paddingLeft: leftOffset }}
        className="transition-[padding]"
      >
        {activeAccount ? (
          <>
            <AccountHeader
              account={activeAccount}
              onAccountNameChange={handleRenameActive}
              leftOffset={0}
            />
            <div className="mx-auto max-w-5xl px-6 py-8 grid gap-8 lg:grid-cols-[320px_1fr]">
              <aside className="lg:sticky lg:top-[110px] h-fit">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
                    Workflow
                  </h2>
                  <span className="text-xs text-ink-500">6 steps</span>
                </div>
                <Timeline
                  account={activeAccount}
                  activeStep={activeStep}
                  onSelectStep={setActiveStep}
                />
              </aside>

              <div>
                {record ? (
                  <StepPanel
                    step={step}
                    account={activeAccount}
                    record={record}
                    onChange={handleStepChange}
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <EmptyState onCreateAccount={handleCreateAccount} />
        )}
      </div>
    </main>
  );
}

function EmptyState({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl">
          T
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">
          Toptal SDR Engine
        </h1>
        <p className="mt-2 text-ink-400">
          Spin up a new account to start a dedicated six-step outreach
          workflow. Your accounts live in the sidebar until you archive or
          delete them.
        </p>
        <button
          onClick={onCreateAccount}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 hover:bg-brand-500 transition px-4 py-2.5 text-sm font-medium text-white"
        >
          <span className="text-base leading-none">+</span>
          New Account
        </button>
      </div>
    </div>
  );
}
