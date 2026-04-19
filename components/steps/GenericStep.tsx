"use client";

import { useEffect, useState } from "react";
import type {
  Account,
  AccountResearchData,
  StepDefinition,
  StepRecord,
} from "@/lib/types";

interface Props {
  step: StepDefinition;
  account: Account;
  record: StepRecord;
  onChange: (partial: Partial<StepRecord>) => void;
}

export function GenericStep({ step, account, record, onChange }: Props) {
  const initial = (record.data?.notes as string) ?? "";
  const [notes, setNotes] = useState(initial);

  useEffect(() => {
    setNotes((record.data?.notes as string) ?? "");
  }, [record.updatedAt, record.data]);

  const research = account.steps.account_research
    .data as Partial<AccountResearchData>;
  const hasResearch = Boolean(
    research.companyOverview || research.toptalFitHypothesis,
  );

  function save(status: StepRecord["status"] = "in_progress") {
    onChange({
      status,
      updatedAt: new Date().toISOString(),
      data: { notes },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-5">
        <div className="text-xs uppercase tracking-wide text-ink-400 font-semibold">
          Context from Account Research
        </div>
        {hasResearch ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            {research.companyOverview ? (
              <ContextCard label="Company" body={research.companyOverview} />
            ) : null}
            {research.recentSignals ? (
              <ContextCard label="Signals" body={research.recentSignals} />
            ) : null}
            {research.toptalFitHypothesis ? (
              <ContextCard
                label="Toptal fit hypothesis"
                body={research.toptalFitHypothesis}
              />
            ) : null}
            {research.techStack ? (
              <ContextCard label="Tech stack" body={research.techStack} />
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-ink-400">
            Complete Step 1 (Account Research) first. Its output will be pinned
            here so every subsequent step builds on the same brief.
          </p>
        )}
      </div>

      <label className="block">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-white">
            {step.title} — working notes
          </span>
          <span className="text-xs text-ink-500">
            Captured to the shared account record.
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => save()}
          rows={10}
          placeholder="Drop your work for this step here..."
          className="scroll-soft w-full bg-ink-900 border border-ink-800 rounded-md px-3 py-2 text-sm text-ink-300 placeholder-ink-500 focus:outline-none focus:border-brand-500 resize-y"
        />
      </label>

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

function ContextCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3">
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-ink-300 whitespace-pre-wrap line-clamp-5">
        {body}
      </dd>
    </div>
  );
}
