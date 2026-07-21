"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Loader2,
  Play,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type {
  Meeting,
  Opportunity,
  OpportunityNextStepOwner,
  OpportunitySolutionArea,
  OpportunityStatus,
  OpportunityTimeline,
  OpportunityUpdate,
} from "@/lib/types";

// Inline section rendered on a held meeting card when outcome =
// "opportunity-identified". Empty state gives a single "Set up this
// opportunity" button; once created, shows the summary + updates log +
// terminal buttons. Terminal-status opportunities are hidden here (they
// live in the tracker-level Closed opportunities section instead).

const SOLUTION_AREA_LABEL: Record<OpportunitySolutionArea, string> = {
  "staff-augmentation": "Staff Augmentation",
  "professional-services": "Professional Services",
};

const TIMELINE_LABEL: Record<OpportunityTimeline, string> = {
  now: "Now",
  "next-month": "Next month",
  "next-quarter": "Next quarter",
};

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  open: "Open",
  "won-sta": "STA Opp",
  "won-job": "Job Started",
  lost: "Closed Lost",
};

export const OPPORTUNITY_STATUS_BADGE: Record<OpportunityStatus, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  "won-sta": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "won-job": "bg-emerald-100 text-emerald-800 border-emerald-300",
  lost: "bg-slate-100 text-slate-600 border-slate-300",
};

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function isOverdue(opp: Opportunity, now: Date = new Date()): boolean {
  if (opp.status !== "open") return false;
  const updated = new Date(opp.updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return now.getTime() - updated > TWO_DAYS_MS;
}

function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = now.getTime() - t;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type OpportunityDraftFields = {
  title: string;
  pain: string;
  solutionArea: OpportunitySolutionArea | null;
  timeline: OpportunityTimeline | null;
  nextStepText: string;
  nextStepOwner: OpportunityNextStepOwner | null;
};

export function OpportunitySection({
  meeting,
  opportunity,
  updates,
  onCreate,
  onUpdate,
  onSetStatus,
  onDelete,
  onAddUpdate,
  onRemoveUpdate,
}: {
  meeting: Meeting;
  opportunity: Opportunity | null;
  updates: OpportunityUpdate[];
  onCreate: (draft: OpportunityDraftFields) => void | Promise<void>;
  onUpdate: (
    id: string,
    patch: Partial<OpportunityDraftFields>
  ) => void | Promise<void>;
  onSetStatus: (id: string, status: OpportunityStatus) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAddUpdate: (id: string, text: string) => void | Promise<void>;
  onRemoveUpdate: (
    opportunityId: string,
    updateId: string
  ) => void | Promise<void>;
}) {
  const acceptSuggestion = async (id: string, suggestion: string) => {
    await onUpdate(id, { nextStepText: suggestion });
    await onAddUpdate(id, `AI suggested next step: ${suggestion}`);
  };
  const [editing, setEditing] = useState(false);

  // Terminal-status opportunities render as a tiny reference row —
  // they live in the tracker's "Closed opportunities" section for the
  // full view. Keeping a stub here so the user isn't confused about
  // where the opportunity went.
  if (opportunity && opportunity.status !== "open") {
    return (
      <div className="border border-slate-200 rounded-md bg-slate-50 px-3 py-2 flex items-center gap-2 text-xs">
        <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-slate-700 font-semibold truncate">
          {opportunity.title || "Opportunity"}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${OPPORTUNITY_STATUS_BADGE[opportunity.status]}`}
        >
          {OPPORTUNITY_STATUS_LABEL[opportunity.status]}
        </span>
        <span className="text-slate-500 ml-auto">
          {relativeTime(opportunity.updatedAt)}
        </span>
      </div>
    );
  }

  if (!opportunity) {
    if (editing) {
      const draft = defaultDraft();
      return (
        <OpportunityForm
          heading="New opportunity"
          initial={draft}
          onCancel={() => setEditing(false)}
          onSave={async (fields) => {
            await onCreate(fields);
            setEditing(false);
          }}
        />
      );
    }
    return (
      <div className="border border-blue-200 bg-blue-50/50 rounded-md p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-900">
            Opportunity identified
          </p>
          <p className="text-[11px] text-blue-800/70">
            Capture the deal so it doesn&apos;t get lost.
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded shadow-sm flex items-center gap-1"
        >
          Set up this opportunity <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Existing open opportunity.
  if (editing) {
    return (
      <OpportunityForm
        heading="Edit opportunity"
        initial={toDraft(opportunity)}
        onCancel={() => setEditing(false)}
        onSave={async (fields) => {
          await onUpdate(opportunity.id, fields);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <OpportunityCard
      meeting={meeting}
      opportunity={opportunity}
      updates={updates}
      onEdit={() => setEditing(true)}
      onSetStatus={(status) => onSetStatus(opportunity.id, status)}
      onDelete={() => onDelete(opportunity.id)}
      onAddUpdate={(text) => onAddUpdate(opportunity.id, text)}
      onRemoveUpdate={(uid) => onRemoveUpdate(opportunity.id, uid)}
      onAcceptSuggestion={(text) => acceptSuggestion(opportunity.id, text)}
    />
  );
}

function defaultDraft(): OpportunityDraftFields {
  return {
    title: "",
    pain: "",
    solutionArea: null,
    timeline: null,
    nextStepText: "",
    nextStepOwner: null,
  };
}

function toDraft(opp: Opportunity): OpportunityDraftFields {
  return {
    title: opp.title,
    pain: opp.pain,
    solutionArea: opp.solutionArea,
    timeline: opp.timeline,
    nextStepText: opp.nextStepText,
    nextStepOwner: opp.nextStepOwner,
  };
}

function OpportunityForm({
  heading,
  initial,
  onCancel,
  onSave,
}: {
  heading: string;
  initial: OpportunityDraftFields;
  onCancel: () => void;
  onSave: (fields: OpportunityDraftFields) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [pain, setPain] = useState(initial.pain);
  const [solutionArea, setSolutionArea] = useState<
    OpportunitySolutionArea | ""
  >(initial.solutionArea ?? "");
  const [timeline, setTimeline] = useState<OpportunityTimeline | "">(
    initial.timeline ?? ""
  );
  const [nextStepText, setNextStepText] = useState(initial.nextStepText);
  const [nextStepOwner, setNextStepOwner] = useState<
    OpportunityNextStepOwner | ""
  >(initial.nextStepOwner ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("Give the opportunity a short title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        pain: pain.trim(),
        solutionArea: solutionArea || null,
        timeline: timeline || null,
        nextStepText: nextStepText.trim(),
        nextStepOwner: nextStepOwner || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-blue-700" />
        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
          {heading}
        </h4>
      </div>

      <Field label="Title">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short label (e.g. Acme — data platform staffing)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </Field>

      <Field label="Pain / problem statement">
        <textarea
          value={pain}
          onChange={(e) => setPain(e.target.value)}
          rows={3}
          placeholder="What are they trying to solve?"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Solution area">
          <select
            value={solutionArea}
            onChange={(e) =>
              setSolutionArea(e.target.value as OpportunitySolutionArea | "")
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— Select —</option>
            <option value="staff-augmentation">Staff Augmentation</option>
            <option value="professional-services">Professional Services</option>
          </select>
        </Field>

        <Field label="Timeline">
          <select
            value={timeline}
            onChange={(e) => setTimeline(e.target.value as OpportunityTimeline | "")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— Select —</option>
            <option value="now">Now</option>
            <option value="next-month">Next month</option>
            <option value="next-quarter">Next quarter</option>
          </select>
        </Field>
      </div>

      <Field label="Next step">
        <input
          type="text"
          value={nextStepText}
          onChange={(e) => setNextStepText(e.target.value)}
          placeholder="e.g. Send Acme case study, ask for intro to CTO"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </Field>

      <Field label="Who owns the next step">
        <select
          value={nextStepOwner}
          onChange={(e) =>
            setNextStepOwner(e.target.value as OpportunityNextStepOwner | "")
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">— Select —</option>
          <option value="SDR">SDR</option>
          <option value="ESE">ESE</option>
        </select>
      </Field>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
        >
          {busy ? "Saving…" : "Save opportunity"}
        </button>
      </div>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  updates,
  onEdit,
  onSetStatus,
  onDelete,
  onAddUpdate,
  onRemoveUpdate,
  onAcceptSuggestion,
}: {
  meeting: Meeting;
  opportunity: Opportunity;
  updates: OpportunityUpdate[];
  onEdit: () => void;
  onSetStatus: (status: OpportunityStatus) => void | Promise<void>;
  onDelete: () => void;
  onAddUpdate: (text: string) => void | Promise<void>;
  onRemoveUpdate: (id: string) => void | Promise<void>;
  onAcceptSuggestion: (text: string) => void | Promise<void>;
}) {
  const overdue = isOverdue(opportunity);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const askForSuggestion = async () => {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "opportunity-next-step",
          context: {
            title: opportunity.title,
            pain: opportunity.pain,
            solutionArea: opportunity.solutionArea,
            timeline: opportunity.timeline,
            currentNextStep: opportunity.nextStepText,
            currentNextStepOwner: opportunity.nextStepOwner,
            recentUpdates: [...updates]
              .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
              .map((u) => u.text),
          },
        }),
      });
      const json = (await res.json()) as {
        result?: { nextStep?: string };
        error?: string;
        spentCents?: number;
        capCents?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && json.capCents != null) {
          setSuggestError(
            `Monthly AI cap reached ($${(json.capCents / 100).toFixed(2)}).`
          );
        } else {
          setSuggestError(json.error ?? "Suggestion failed.");
        }
        return;
      }
      const nextStep = json.result?.nextStep?.trim();
      if (!nextStep) {
        setSuggestError("No suggestion returned.");
        return;
      }
      setSuggestion(nextStep);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : String(e));
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    await onAcceptSuggestion(suggestion);
    setSuggestion(null);
  };

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-md p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="w-4 h-4 text-blue-700 shrink-0" />
          <h4 className="text-sm font-bold text-blue-900 truncate">
            {opportunity.title || "Untitled opportunity"}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {overdue && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1"
              title="No updates in more than 2 days"
            >
              <AlertTriangle className="w-3 h-3" /> Action overdue
            </span>
          )}
          <button
            onClick={onEdit}
            className="text-slate-500 hover:text-blue-700 p-1"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Delete this opportunity? Its update log goes with it. The parent meeting is untouched."
                )
              ) {
                void onDelete();
              }
            }}
            className="text-slate-500 hover:text-red-600 p-1"
            title="Delete opportunity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {opportunity.solutionArea && (
          <SummaryRow label="Solution area">
            {SOLUTION_AREA_LABEL[opportunity.solutionArea]}
          </SummaryRow>
        )}
        {opportunity.timeline && (
          <SummaryRow label="Timeline">
            {TIMELINE_LABEL[opportunity.timeline]}
          </SummaryRow>
        )}
      </div>

      {opportunity.pain && (
        <div className="text-xs">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
            Pain
          </p>
          <p className="text-slate-700 whitespace-pre-wrap">{opportunity.pain}</p>
        </div>
      )}

      <div className="text-xs">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Next step
          </p>
          <button
            onClick={() => void askForSuggestion()}
            disabled={suggesting}
            className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Ask AI to suggest a next step based on this opportunity's context"
          >
            {suggesting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            {suggesting ? "Thinking…" : "Suggest next step"}
          </button>
        </div>
        {opportunity.nextStepText ? (
          <p className="text-slate-700">
            {opportunity.nextStepText}
            {opportunity.nextStepOwner && (
              <span className="ml-2 text-[10px] font-semibold bg-white text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                Owner: {opportunity.nextStepOwner}
              </span>
            )}
          </p>
        ) : (
          <p className="italic text-slate-500">No next step set yet.</p>
        )}
        {suggestError && (
          <p className="text-[11px] text-red-600 mt-1">{suggestError}</p>
        )}
        {suggestion && (
          <div className="mt-2 rounded-md border border-blue-300 bg-white p-2 space-y-2">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> Suggested next step
            </p>
            <p className="text-xs text-slate-700">{suggestion}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void acceptSuggestion()}
                className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> Use as next step
              </button>
              <button
                onClick={() => setSuggestion(null)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500">
        Updated {relativeTime(opportunity.updatedAt)}
      </p>

      <OpportunityUpdatesSection
        updates={updates}
        onAdd={onAddUpdate}
        onRemove={onRemoveUpdate}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => {
            if (window.confirm("Mark as STA Opp (won)? Moves to Closed opportunities.")) {
              void onSetStatus("won-sta");
            }
          }}
          className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
        >
          <CheckCircle2 className="w-3 h-3" /> Convert to STA Opp
        </button>
        <button
          onClick={() => {
            if (window.confirm("Mark as Job Started (won)? Moves to Closed opportunities.")) {
              void onSetStatus("won-job");
            }
          }}
          className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
        >
          <Play className="w-3 h-3" /> Job Started
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                "Mark as Closed Lost? Moves to Closed opportunities."
              )
            ) {
              void onSetStatus("lost");
            }
          }}
          className="text-xs font-semibold text-white bg-slate-600 hover:bg-slate-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
        >
          <Ban className="w-3 h-3" /> Closed Lost
        </button>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function OpportunityUpdatesSection({
  updates,
  onAdd,
  onRemove,
}: {
  updates: OpportunityUpdate[];
  onAdd: (text: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const clean = draft.trim();
    if (!clean) return;
    void onAdd(clean);
    setDraft("");
  };
  const sorted = [...updates].sort((a, b) =>
    b.loggedAt.localeCompare(a.loggedAt)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Updates{updates.length > 0 ? ` (${updates.length})` : ""}
        </span>
      </div>
      <div className="flex gap-2 mb-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Log an update (e.g. Sent case study, awaiting CTO reply)"
          rows={1}
          className="flex-1 text-xs text-slate-700 bg-white border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none p-2 rounded resize-y"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-md shadow-sm flex items-center gap-1 self-start"
          title="Log update (Cmd/Ctrl+Enter)"
        >
          <Plus className="w-3 h-3" /> Log
        </button>
      </div>
      {sorted.length > 0 && (
        <ul className="space-y-1.5">
          {sorted.map((u) => (
            <li
              key={u.id}
              className={`flex items-start gap-2 text-xs border rounded-md p-2 ${
                u.isSystem
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 flex items-center gap-1.5">
                  {u.isSystem && (
                    <span
                      className="inline-flex items-center gap-0.5 bg-slate-200 text-slate-600 uppercase tracking-wider text-[9px] font-bold px-1 py-px rounded"
                      title="Auto-logged"
                    >
                      Auto
                    </span>
                  )}
                  {relativeTime(u.loggedAt)}
                </div>
                <div
                  className={`whitespace-pre-wrap leading-relaxed ${
                    u.isSystem ? "text-slate-600 italic" : "text-slate-700"
                  }`}
                >
                  {u.text}
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Delete this update?")) void onRemove(u.id);
                }}
                className="text-slate-400 hover:text-red-600 shrink-0"
                title="Delete update"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
