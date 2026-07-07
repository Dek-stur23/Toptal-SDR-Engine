"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Lock,
  Phone,
  Target,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from "lucide-react";
import type {
  AppState,
  GoalLogEntry,
  QuarterlyGoals,
  UserGoalsState,
} from "@/lib/types";
import {
  appendLog,
  createLog,
  defaultQuarterlyGoals,
  findQuarterlyGoals,
  formatIsoDate,
  getQuarterOf,
  groupLogsByWeek,
  isWeekLocked,
  removeLog,
  resolveViewPeriod,
  sumLogsInRange,
  toggleWeekUnlock,
  updateLog,
  upsertQuarterlyGoals,
  weekStartFor,
  type ViewPeriodKind,
  type WeeklyBucket,
} from "@/lib/goals";

interface Props {
  state: AppState;
  setGoals: (updater: (prev: UserGoalsState) => UserGoalsState) => void;
}

const NOW = () => new Date();

const monthShort = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric" });

function formatWeekLabel(bucket: WeeklyBucket): string {
  return `Week of ${monthShort(bucket.weekStart)} – ${monthShort(bucket.weekEnd)}`;
}

function pct(actual: number, target: number): number {
  if (!target) return 0;
  return Math.round((actual / target) * 100);
}

export function GoalsAndBenchmarks({ state, setGoals }: Props) {
  const goals = state.goals;
  const now = NOW();
  const { year, quarter } = getQuarterOf(now);
  const currentQuarterGoals =
    findQuarterlyGoals(goals, year, quarter) ??
    defaultQuarterlyGoals(year, quarter);

  const [editingGoals, setEditingGoals] = useState(false);
  const [periodKind, setPeriodKind] = useState<ViewPeriodKind>("this-week");
  const period = useMemo(() => resolveViewPeriod(periodKind, now), [
    periodKind,
    // now recomputed on every render is fine — the label may shift when the clock rolls
  ]);
  const periodRollup = useMemo(
    () => sumLogsInRange(goals.logs, period.fromMs, period.toMs),
    [goals.logs, period.fromMs, period.toMs],
  );
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayRollupNow = sumLogsInRange(
    goals.logs,
    todayStart.getTime(),
    todayEnd.getTime(),
  );

  // Goal targets for the selected period (multiply weekly by weeks in range)
  const periodDialsGoal =
    currentQuarterGoals.weeklyDialsGoal * period.weeks;
  const periodDialsBenchmark =
    currentQuarterGoals.weeklyDialsBenchmark * period.weeks;
  const periodProspectsGoal =
    currentQuarterGoals.weeklyProspectsGoal * period.weeks;
  const periodProspectsBenchmark =
    currentQuarterGoals.weeklyProspectsBenchmark * period.weeks;

  const buckets = useMemo(() => groupLogsByWeek(goals, now), [goals, now]);

  const logQuick = (kind: GoalLogEntry["kind"], count: number) => {
    setGoals((prev) => appendLog(prev, createLog(kind, count)));
  };
  const logBatch = (kind: GoalLogEntry["kind"]) => {
    const raw = window.prompt(
      `How many ${kind === "dial" ? "dials" : "new prospects"} to log?`,
      "5",
    );
    if (!raw) return;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setGoals((prev) => appendLog(prev, createLog(kind, n)));
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" /> Goals &amp; Benchmarks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Q{quarter} {year} · goals apply across every account.
          </p>
        </div>
        <button
          onClick={() => setEditingGoals(true)}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg shadow-sm"
        >
          <Edit2 className="w-3.5 h-3.5" /> Edit goals
        </button>
      </div>

      {/* Filter + rollup cards */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            View
          </label>
          <select
            value={periodKind}
            onChange={(e) => setPeriodKind(e.target.value as ViewPeriodKind)}
            className="text-sm rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="this-week">This week</option>
            <option value="last-week">Last week</option>
            <option value="this-quarter">This quarter</option>
            <option value="all-time">All time</option>
          </select>
          <span className="text-xs text-slate-500 ml-auto">
            Range covers {period.weeks} week{period.weeks === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            icon={<Phone className="w-4 h-4 text-blue-500" />}
            label={`Dials · ${period.label}`}
            actual={periodRollup.dials}
            goal={periodDialsGoal}
            benchmark={periodDialsBenchmark}
            sublabel={
              periodKind === "this-week"
                ? `Today: ${todayRollupNow.dials} / ${currentQuarterGoals.dailyDialsGoal || 0}`
                : undefined
            }
          />
          <MetricCard
            icon={<UserPlus className="w-4 h-4 text-emerald-500" />}
            label={`Prospects added · ${period.label}`}
            actual={periodRollup.prospects}
            goal={periodProspectsGoal}
            benchmark={periodProspectsBenchmark}
          />
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Quick log
            </span>
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => logQuick("dial", 1)}
                  className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" /> +1 dial
                </button>
                <button
                  onClick={() => logBatch("dial")}
                  className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-2 rounded-md transition-colors"
                >
                  batch…
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => logQuick("prospect-added", 1)}
                  className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> +1 prospect
                </button>
                <button
                  onClick={() => logBatch("prospect-added")}
                  className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-2 rounded-md transition-colors"
                >
                  batch…
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly archive */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Weekly archive
        </h2>
        {buckets.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No entries logged yet. Use the Quick log buttons above.
          </p>
        ) : (
          <ul className="space-y-2">
            {buckets.map((b) => (
              <WeeklyBucketCard
                key={b.weekStartIso}
                bucket={b}
                quarterly={currentQuarterGoals}
                state={goals}
                setGoals={setGoals}
                now={now}
              />
            ))}
          </ul>
        )}
      </section>

      {editingGoals && (
        <EditGoalsModal
          initial={currentQuarterGoals}
          onClose={() => setEditingGoals(false)}
          onSave={(next) => {
            setGoals((prev) => upsertQuarterlyGoals(prev, next));
            setEditingGoals(false);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  actual,
  goal,
  benchmark,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  actual: number;
  goal: number;
  benchmark: number;
  sublabel?: string;
}) {
  const goalPct = pct(actual, goal);
  const benchPct = pct(actual, benchmark);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900">
        {actual}
        <span className="text-sm text-slate-400 font-normal">
          {" "}/{" "}
          {goal || <span className="italic text-slate-400">no goal</span>}
        </span>
      </div>
      {sublabel && (
        <p className="text-[11px] text-slate-500">{sublabel}</p>
      )}
      <ProgressBar percent={goalPct} colorClass="bg-blue-500" />
      <p className="text-[11px] text-slate-500 leading-tight">
        {goal
          ? `${goalPct}% of goal`
          : "Set a goal to track progress"}
        {benchmark ? (
          <>
            <span className="mx-1.5 text-slate-300">·</span>
            benchmark {benchmark} ({benchPct}%)
          </>
        ) : null}
      </p>
    </div>
  );
}

function ProgressBar({
  percent,
  colorClass,
}: {
  percent: number;
  colorClass: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function WeeklyBucketCard({
  bucket,
  quarterly,
  state,
  setGoals,
  now,
}: {
  bucket: WeeklyBucket;
  quarterly: QuarterlyGoals;
  state: UserGoalsState;
  setGoals: (u: (prev: UserGoalsState) => UserGoalsState) => void;
  now: Date;
}) {
  const [open, setOpen] = useState(bucket.isCurrent);
  const locked = isWeekLocked(state, bucket.weekStart, now);
  const explicitlyUnlocked = state.unlockedWeekStarts.includes(
    bucket.weekStartIso,
  );

  const dialsPct = pct(bucket.totals.dials, quarterly.weeklyDialsGoal);
  const prospectsPct = pct(bucket.totals.prospects, quarterly.weeklyProspectsGoal);

  return (
    <li className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">
              {formatWeekLabel(bucket)}
            </span>
            {bucket.isCurrent && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                Current
              </span>
            )}
            {!bucket.isCurrent && locked && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            )}
            {!bucket.isCurrent && explicitlyUnlocked && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Unlock className="w-2.5 h-2.5" /> Unlocked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {bucket.totals.dials} dials
            {quarterly.weeklyDialsGoal
              ? ` (${dialsPct}% of goal)`
              : ""} · {bucket.totals.prospects} prospects
            {quarterly.weeklyProspectsGoal
              ? ` (${prospectsPct}% of goal)`
              : ""}
          </p>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50/40">
          {!bucket.isCurrent && (
            <button
              onClick={() =>
                setGoals((prev) => toggleWeekUnlock(prev, bucket.weekStart))
              }
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              {locked ? (
                <>
                  <Unlock className="w-3 h-3" /> Unlock this week for editing
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" /> Re-lock this week
                </>
              )}
            </button>
          )}
          {bucket.logs.length === 0 ? (
            <p className="text-xs italic text-slate-500">
              No entries logged this week.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {bucket.logs.map((l) => (
                <LogRow
                  key={l.id}
                  entry={l}
                  locked={locked}
                  onDelete={() => setGoals((prev) => removeLog(prev, l.id))}
                  onUpdate={(patch) =>
                    setGoals((prev) => updateLog(prev, l.id, patch))
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function LogRow({
  entry,
  locked,
  onDelete,
  onUpdate,
}: {
  entry: GoalLogEntry;
  locked: boolean;
  onDelete: () => void;
  onUpdate: (patch: { count?: number; note?: string }) => void;
}) {
  const time = new Date(entry.timestamp).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const kindLabel =
    entry.kind === "dial"
      ? entry.count === 1
        ? "1 dial"
        : `${entry.count} dials`
      : entry.count === 1
        ? "1 prospect added"
        : `${entry.count} prospects added`;
  const [editing, setEditing] = useState(false);
  const [draftCount, setDraftCount] = useState(String(entry.count));
  const [draftNote, setDraftNote] = useState(entry.note ?? "");

  const save = () => {
    const n = Number.parseInt(draftCount, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onUpdate({ count: n, note: draftNote.trim() || undefined });
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
      {editing ? (
        <>
          <input
            type="number"
            min={1}
            value={draftCount}
            onChange={(e) => setDraftCount(e.target.value)}
            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <span className="text-slate-500">
            {entry.kind === "dial" ? "dial(s)" : "prospect(s)"}
          </span>
          <input
            type="text"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="note (optional)"
            className="flex-1 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <button
            onClick={save}
            className="text-emerald-700 hover:text-emerald-900"
            title="Save"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-slate-400 hover:text-slate-700"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="font-medium text-slate-800">{kindLabel}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{time}</span>
          {entry.note && (
            <>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 italic truncate">{entry.note}</span>
            </>
          )}
          {!locked && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="text-slate-400 hover:text-blue-600"
                title="Edit"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete this entry (${kindLabel})?`)) {
                    onDelete();
                  }
                }}
                className="text-slate-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function EditGoalsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: QuarterlyGoals;
  onClose: () => void;
  onSave: (next: QuarterlyGoals) => void;
}) {
  const [draft, setDraft] = useState<QuarterlyGoals>(initial);
  const set = (patch: Partial<QuarterlyGoals>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Q{draft.quarter} {draft.year} goals
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Goal is what you commit to. Benchmark is your reference target
          (team standard, stretch goal — whatever you decide).
        </p>
        <div className="space-y-3">
          <NumberField
            label="Daily dials — goal"
            value={draft.dailyDialsGoal}
            onChange={(v) => set({ dailyDialsGoal: v })}
          />
          <NumberField
            label="Daily dials — benchmark"
            value={draft.dailyDialsBenchmark}
            onChange={(v) => set({ dailyDialsBenchmark: v })}
          />
          <NumberField
            label="Weekly dials — goal"
            value={draft.weeklyDialsGoal}
            onChange={(v) => set({ weeklyDialsGoal: v })}
          />
          <NumberField
            label="Weekly dials — benchmark"
            value={draft.weeklyDialsBenchmark}
            onChange={(v) => set({ weeklyDialsBenchmark: v })}
          />
          <NumberField
            label="Weekly new prospects — goal"
            value={draft.weeklyProspectsGoal}
            onChange={(v) => set({ weeklyProspectsGoal: v })}
          />
          <NumberField
            label="Weekly new prospects — benchmark"
            value={draft.weeklyProspectsBenchmark}
            onChange={(v) => set({ weeklyProspectsBenchmark: v })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
          >
            Save goals
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
      />
    </label>
  );
}

// Also exported: unused imports resolved by re-exporting formatIsoDate/weekStartFor
// so tests can import a stable surface via this file if needed. Keeps eslint quiet.
export { formatIsoDate as _formatIsoDate, weekStartFor as _weekStartFor };
