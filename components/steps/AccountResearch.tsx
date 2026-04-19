"use client";

import { useEffect, useState } from "react";
import type {
  Account,
  AccountResearchData,
  StepRecord,
} from "@/lib/types";

interface Props {
  account: Account;
  record: StepRecord;
  onChange: (partial: Partial<StepRecord>) => void;
}

const DEFAULT_DATA: AccountResearchData = {
  projectUrl: "",
  companyOverview: "",
  industryContext: "",
  recentSignals: "",
  techStack: "",
  toptalFitHypothesis: "",
  rawNotes: "",
};

function readData(record: StepRecord): AccountResearchData {
  return { ...DEFAULT_DATA, ...(record.data as Partial<AccountResearchData>) };
}

function isEmbeddable(url: string): boolean {
  // claude.ai sends X-Frame-Options: DENY, so an iframe will be blocked.
  // Only embed URLs the user has explicitly opted in to (self-hosted proxies, etc).
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname !== "claude.ai" && u.protocol === "https:";
  } catch {
    return false;
  }
}

export function AccountResearch({ account, record, onChange }: Props) {
  const data = readData(record);
  const [local, setLocal] = useState<AccountResearchData>(data);

  useEffect(() => {
    setLocal(readData(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.updatedAt]);

  function update<K extends keyof AccountResearchData>(
    key: K,
    value: AccountResearchData[K],
  ) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function save(status: StepRecord["status"] = "in_progress") {
    onChange({
      status,
      updatedAt: new Date().toISOString(),
      data: local as unknown as Record<string, unknown>,
    });
  }

  const accountLabel = account.name.trim() || "this account";

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-brand-500 font-semibold">
              Embedded Claude Project
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Account Research Assistant
            </h3>
            <p className="mt-2 text-sm text-ink-400 max-w-xl">
              Paste your Claude Project URL below. The Project should be primed
              with Toptal ICP + research prompts. Run the research for{" "}
              <span className="text-ink-300 font-medium">{accountLabel}</span>, then
              capture the structured output in the fields below.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={local.projectUrl}
            onChange={(e) => update("projectUrl", e.target.value)}
            onBlur={() => save()}
            placeholder="https://claude.ai/project/..."
            className="bg-ink-900 border border-ink-700 rounded-md px-3 py-2 text-sm text-white placeholder-ink-500 focus:outline-none focus:border-brand-500"
          />
          <a
            href={local.projectUrl || "https://claude.ai/projects"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-brand-600 hover:bg-brand-500 transition px-4 py-2 text-sm font-medium text-white"
          >
            Open Claude Project ↗
          </a>
        </div>

        <div className="mt-4 rounded-md border border-ink-800 bg-ink-900/60 overflow-hidden">
          {isEmbeddable(local.projectUrl) ? (
            <iframe
              src={local.projectUrl}
              title="Claude Project"
              className="w-full h-[480px] bg-white"
            />
          ) : (
            <div className="p-8 text-center text-sm text-ink-400">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-ink-800 flex items-center justify-center text-lg">
                C
              </div>
              <p className="max-w-md mx-auto">
                Claude.ai blocks iframe embedding. Click{" "}
                <span className="text-ink-300">Open Claude Project</span> to run
                research in a new tab, then paste the results into the fields
                below. The results are saved locally and referenced by every
                later step.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
          Research Output
        </h3>

        <Field
          label="Company overview"
          hint="What they do, size, geos, business model."
          value={local.companyOverview}
          onChange={(v) => update("companyOverview", v)}
          onBlur={() => save()}
          rows={3}
        />
        <Field
          label="Industry context"
          hint="Market dynamics, regulatory pressure, competitive moves."
          value={local.industryContext}
          onChange={(v) => update("industryContext", v)}
          onBlur={() => save()}
          rows={3}
        />
        <Field
          label="Recent signals"
          hint="Funding, hiring bursts, M&A, leadership changes, press, earnings calls."
          value={local.recentSignals}
          onChange={(v) => update("recentSignals", v)}
          onBlur={() => save()}
          rows={4}
        />
        <Field
          label="Tech stack & talent posture"
          hint="Engineering stack, known talent gaps, contractor/FTE mix signals."
          value={local.techStack}
          onChange={(v) => update("techStack", v)}
          onBlur={() => save()}
          rows={3}
        />
        <Field
          label="Toptal fit hypothesis"
          hint="Where Toptal plausibly wins: on-demand talent, project teams, AI services, enterprise."
          value={local.toptalFitHypothesis}
          onChange={(v) => update("toptalFitHypothesis", v)}
          onBlur={() => save()}
          rows={4}
        />
        <Field
          label="Raw notes / transcript"
          hint="Optional: dump the full Claude Project output for future reference."
          value={local.rawNotes}
          onChange={(v) => update("rawNotes", v)}
          onBlur={() => save()}
          rows={6}
        />
      </div>

      <div className="flex items-center justify-between border-t border-ink-800 pt-5">
        <div className="text-xs text-ink-500">
          {record.updatedAt
            ? `Last saved ${new Date(record.updatedAt).toLocaleString()}`
            : "Not saved yet"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save("in_progress")}
            className="rounded-md border border-ink-700 hover:border-ink-600 px-4 py-2 text-sm text-ink-300"
          >
            Save draft
          </button>
          <button
            onClick={() => save("complete")}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2 text-sm font-medium text-white"
          >
            Mark complete
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  onBlur,
  rows,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  rows: number;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="text-xs text-ink-500">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        className="scroll-soft w-full bg-ink-900 border border-ink-800 rounded-md px-3 py-2 text-sm text-ink-300 placeholder-ink-500 focus:outline-none focus:border-brand-500 resize-y"
      />
    </label>
  );
}
