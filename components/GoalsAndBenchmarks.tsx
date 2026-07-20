"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarPlus,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Lock,
  Phone,
  Save,
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
  bucketLogsForChart,
  bucketMeetingsForChart,
  chartGranularityFor,
  createLog,
  defaultQuarterlyGoals,
  findQuarterlyGoals,
  formatIsoDate,
  getQuarterOf,
  groupLogsByWeek,
  isWeekLocked,
  isWeekManuallySaved,
  removeLog,
  resolveViewPeriod,
  saveWeek,
  sumLogsInRange,
  sumMeetingsInRange,
  toggleWeekUnlock,
  unsaveWeek,
  updateLog,
  upsertQuarterlyGoals,
  weekStartFor,
  type ViewPeriodKind,
  type WeeklyBucket,
} from "@/lib/goals";
import { PacingChart } from "@/components/PacingChart";

interface Props {
  state: AppState;
  setGoals: (updater: (prev: UserGoalsState) => UserGoalsState) => void;
}

const NOW = () => new Date();

const monthShort = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric" });

function formatDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function parseDatetimeLocal(s: string): number | null {
  if (!s) return null;
  const ts = new Date(s).getTime();
  return Number.isFinite(ts) ? ts : null;
}

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
  const [calculatingGoals, setCalculatingGoals] = useState(false);
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

  // Goal targets for the selected period. "Today" uses the dedicated
  // daily dial goal + a 1/7 approximation for weekly prospects. Every
  // other range multiplies the weekly goal by the number of weeks it
  // covers.
  const periodDialsGoal =
    periodKind === "today"
      ? currentQuarterGoals.dailyDialsGoal
      : currentQuarterGoals.weeklyDialsGoal * period.weeks;
  const periodDialsBenchmark =
    periodKind === "today"
      ? currentQuarterGoals.dailyDialsBenchmark
      : currentQuarterGoals.weeklyDialsBenchmark * period.weeks;
  const periodProspectsGoal = Math.round(
    currentQuarterGoals.weeklyProspectsGoal * period.weeks,
  );
  const periodProspectsBenchmark = Math.round(
    currentQuarterGoals.weeklyProspectsBenchmark * period.weeks,
  );
  const periodMeetingsBookedGoal = Math.round(
    currentQuarterGoals.weeklyMeetingsBookedGoal * period.weeks,
  );
  const periodMeetingsBookedBenchmark = Math.round(
    currentQuarterGoals.weeklyMeetingsBookedBenchmark * period.weeks,
  );
  const periodMeetingsHeldGoal = Math.round(
    currentQuarterGoals.weeklyMeetingsHeldGoal * period.weeks,
  );
  const periodMeetingsHeldBenchmark = Math.round(
    currentQuarterGoals.weeklyMeetingsHeldBenchmark * period.weeks,
  );

  const meetingsRollup = useMemo(
    () => sumMeetingsInRange(state.meetings, period.fromMs, period.toMs),
    [state.meetings, period.fromMs, period.toMs],
  );

  const buckets = useMemo(() => groupLogsByWeek(goals, now), [goals, now]);

  // Map Account.id -> display name for the weekly archive tag chips.
  const accountNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of state.accounts) {
      m[a.id] = a.name || a.accountData.companyName || "(unnamed)";
    }
    return m;
  }, [state.accounts]);

  const [logModalKind, setLogModalKind] = useState<GoalLogEntry["kind"] | null>(
    null,
  );

  const openLogModal = (kind: GoalLogEntry["kind"]) => {
    setLogModalKind(kind);
  };

  const submitLog = (
    kind: GoalLogEntry["kind"],
    count: number,
    opts: { note?: string; accountId?: string; timestamp?: number },
  ) => {
    setGoals((prev) => appendLog(prev, createLog(kind, count, opts)));
    setLogModalKind(null);
  };

  // Suggested default "When?" for the log modal. If the currently viewed
  // period contains right-now, use now. If the period is fully in the
  // past (e.g. "Last week"), default to 5 PM on the last day of that
  // period so the entry lands inside the range the user is looking at.
  const suggestedWhenMs = useMemo(() => {
    const nowMs = now.getTime();
    if (nowMs >= period.fromMs && nowMs <= period.toMs) return nowMs;
    const end = new Date(period.toMs);
    end.setHours(17, 0, 0, 0);
    return end.getTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.fromMs, period.toMs, now.getTime()]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" /> Goals &amp; Metrics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Q{quarter} {year} · goals apply across every account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalculatingGoals(true)}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-sm"
            title="Back-calculate weekly goals from your historical performance and a meetings-held target"
          >
            <Calculator className="w-3.5 h-3.5" /> Calculate goals
          </button>
          <button
            onClick={() => setEditingGoals(true)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit goals
          </button>
        </div>
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
            <option value="today">Today</option>
            <option value="this-week">This week</option>
            <option value="last-week">Last week</option>
            <option value="this-quarter">This quarter</option>
            <option value="all-time">All time</option>
          </select>
          <span className="text-xs text-slate-500 ml-auto">
            Range covers {period.weeks} week{period.weeks === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <MetricCard
            icon={<CalendarPlus className="w-4 h-4 text-indigo-500" />}
            label={`Meetings booked · ${period.label}`}
            actual={meetingsRollup.booked}
            goal={periodMeetingsBookedGoal}
            benchmark={periodMeetingsBookedBenchmark}
          />
          <MetricCard
            icon={<CalendarCheck className="w-4 h-4 text-purple-500" />}
            label={`Meetings held · ${period.label}`}
            actual={meetingsRollup.held}
            goal={periodMeetingsHeldGoal}
            benchmark={periodMeetingsHeldBenchmark}
          />
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Log activity
            </span>
            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={() => openLogModal("dial")}
                className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Log dials
              </button>
              <button
                onClick={() => openLogModal("prospect-added")}
                className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" /> Log prospects added
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pacing */}
      {periodKind !== "today" && (
        <PacingSection
          logs={goals.logs}
          meetings={state.meetings}
          period={period}
          quarterly={currentQuarterGoals}
        />
      )}

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
                accountNameById={accountNameById}
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

      {calculatingGoals && (
        <CalculateGoalsModal
          onClose={() => setCalculatingGoals(false)}
          onApply={(suggested) => {
            setGoals((prev) =>
              upsertQuarterlyGoals(prev, {
                ...currentQuarterGoals,
                weeklyDialsGoal: suggested.dials,
                weeklyProspectsGoal: suggested.prospects,
                weeklyMeetingsBookedGoal: suggested.meetingsBooked,
                weeklyMeetingsHeldGoal: suggested.meetingsHeldTarget,
              }),
            );
            setCalculatingGoals(false);
          }}
        />
      )}

      {logModalKind && (
        <LogEntryModal
          kind={logModalKind}
          accounts={state.accounts.filter((a) => !a.isArchived)}
          defaultWhenMs={suggestedWhenMs}
          periodLabel={period.label}
          onClose={() => setLogModalKind(null)}
          onSubmit={(count, opts) => submitLog(logModalKind, count, opts)}
        />
      )}
    </div>
  );
}

function PacingSection({
  logs,
  meetings,
  period,
  quarterly,
}: {
  logs: import("@/lib/types").GoalLogEntry[];
  meetings: import("@/lib/types").Meeting[];
  period: ReturnType<typeof resolveViewPeriod>;
  quarterly: QuarterlyGoals;
}) {
  const now = new Date();
  const dialBuckets = useMemo(
    () => bucketLogsForChart(logs, period, "dial", now),
    [logs, period, now.getTime()],
  );
  const prospectBuckets = useMemo(
    () => bucketLogsForChart(logs, period, "prospect-added", now),
    [logs, period, now.getTime()],
  );
  const meetingsBookedBuckets = useMemo(
    () => bucketMeetingsForChart(meetings, period, "booked", now),
    [meetings, period, now.getTime()],
  );
  const meetingsHeldBuckets = useMemo(
    () => bucketMeetingsForChart(meetings, period, "held", now),
    [meetings, period, now.getTime()],
  );
  // Reference-line values in the same unit as the bars. Bars are per-day
  // for week views, per-week for quarter/all-time views.
  const granularity = chartGranularityFor(period.kind);
  const dialsGoalPerBucket =
    granularity === "day"
      ? quarterly.dailyDialsGoal
      : quarterly.weeklyDialsGoal;
  const dialsBenchmarkPerBucket =
    granularity === "day"
      ? quarterly.dailyDialsBenchmark
      : quarterly.weeklyDialsBenchmark;
  // No dedicated daily prospect/meeting goals — approximate weekly / 7.
  const prospectsGoalPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyProspectsGoal / 7)
      : quarterly.weeklyProspectsGoal;
  const prospectsBenchmarkPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyProspectsBenchmark / 7)
      : quarterly.weeklyProspectsBenchmark;
  const meetingsBookedGoalPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyMeetingsBookedGoal / 7)
      : quarterly.weeklyMeetingsBookedGoal;
  const meetingsBookedBenchmarkPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyMeetingsBookedBenchmark / 7)
      : quarterly.weeklyMeetingsBookedBenchmark;
  const meetingsHeldGoalPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyMeetingsHeldGoal / 7)
      : quarterly.weeklyMeetingsHeldGoal;
  const meetingsHeldBenchmarkPerBucket =
    granularity === "day"
      ? Math.round(quarterly.weeklyMeetingsHeldBenchmark / 7)
      : quarterly.weeklyMeetingsHeldBenchmark;

  const subtitle =
    granularity === "day" ? "Per day" : "Per week";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
        Pacing · {period.label}
      </h2>
      <div className="space-y-3">
        <PacingChart
          title="Dials"
          subtitle={subtitle}
          buckets={dialBuckets}
          goal={dialsGoalPerBucket}
          benchmark={dialsBenchmarkPerBucket}
          barColorClass="fill-blue-500"
          currentBarColorClass="fill-blue-700"
          goalStrokeClass="stroke-blue-700"
          benchmarkStrokeClass="stroke-blue-300"
        />
        <PacingChart
          title="Prospects added"
          subtitle={subtitle}
          buckets={prospectBuckets}
          goal={prospectsGoalPerBucket}
          benchmark={prospectsBenchmarkPerBucket}
          barColorClass="fill-emerald-500"
          currentBarColorClass="fill-emerald-700"
          goalStrokeClass="stroke-emerald-700"
          benchmarkStrokeClass="stroke-emerald-300"
        />
        <PacingChart
          title="Meetings booked"
          subtitle={subtitle}
          buckets={meetingsBookedBuckets}
          goal={meetingsBookedGoalPerBucket}
          benchmark={meetingsBookedBenchmarkPerBucket}
          barColorClass="fill-indigo-500"
          currentBarColorClass="fill-indigo-700"
          goalStrokeClass="stroke-indigo-700"
          benchmarkStrokeClass="stroke-indigo-300"
        />
        <PacingChart
          title="Meetings held"
          subtitle={subtitle}
          buckets={meetingsHeldBuckets}
          goal={meetingsHeldGoalPerBucket}
          benchmark={meetingsHeldBenchmarkPerBucket}
          barColorClass="fill-purple-500"
          currentBarColorClass="fill-purple-700"
          goalStrokeClass="stroke-purple-700"
          benchmarkStrokeClass="stroke-purple-300"
        />
      </div>
    </section>
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
  accountNameById,
}: {
  bucket: WeeklyBucket;
  quarterly: QuarterlyGoals;
  state: UserGoalsState;
  setGoals: (u: (prev: UserGoalsState) => UserGoalsState) => void;
  now: Date;
  accountNameById: Record<string, string>;
}) {
  const [open, setOpen] = useState(bucket.isCurrent);
  const locked = isWeekLocked(state, bucket.weekStart, now);
  const explicitlyUnlocked = state.unlockedWeekStarts.includes(
    bucket.weekStartIso,
  );
  const isManuallySaved = isWeekManuallySaved(state, bucket.weekStart);

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
            {bucket.isCurrent && !isManuallySaved && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                Current
              </span>
            )}
            {isManuallySaved && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Save className="w-2.5 h-2.5" /> Saved
              </span>
            )}
            {!bucket.isCurrent && !isManuallySaved && locked && (
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
          <div className="flex items-center gap-3 flex-wrap">
            {bucket.isCurrent && !isManuallySaved && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Save this week? It will be locked in the archive. You can reopen it later if needed.",
                    )
                  ) {
                    setGoals((prev) => saveWeek(prev, bucket.weekStart));
                  }
                }}
                className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
              >
                <Save className="w-3 h-3" /> Save week
              </button>
            )}
            {bucket.isCurrent && isManuallySaved && (
              <button
                onClick={() =>
                  setGoals((prev) => unsaveWeek(prev, bucket.weekStart))
                }
                className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
              >
                <Unlock className="w-3 h-3" /> Reopen this week
              </button>
            )}
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
          </div>
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
                  accountNameById={accountNameById}
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
  accountNameById,
  onDelete,
  onUpdate,
}: {
  entry: GoalLogEntry;
  locked: boolean;
  accountNameById: Record<string, string>;
  onDelete: () => void;
  onUpdate: (patch: {
    count?: number;
    note?: string;
    accountId?: string;
  }) => void;
}) {
  const accountName = entry.accountId
    ? accountNameById[entry.accountId] ?? "(deleted account)"
    : null;
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
          {accountName && (
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
              <Building2 className="w-2.5 h-2.5" />
              {accountName}
            </span>
          )}
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

function LogEntryModal({
  kind,
  accounts,
  defaultWhenMs,
  periodLabel,
  onClose,
  onSubmit,
}: {
  kind: GoalLogEntry["kind"];
  accounts: import("@/lib/types").Account[];
  defaultWhenMs: number;
  periodLabel: string;
  onClose: () => void;
  onSubmit: (
    count: number,
    opts: { note?: string; accountId?: string; timestamp?: number },
  ) => void;
}) {
  const isDial = kind === "dial";
  const [countStr, setCountStr] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [when, setWhen] = useState(formatDatetimeLocal(defaultWhenMs));
  const [error, setError] = useState<string | null>(null);

  const parsed = Number.parseInt(countStr, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 1;
  const whenTs = parseDatetimeLocal(when);
  const nowMs = Date.now();
  const isBackdated =
    Number.isFinite(whenTs) && whenTs !== null && Math.abs(whenTs - nowMs) > 60_000;

  const submit = () => {
    if (!isValid) {
      setError("Enter a whole number of 1 or more.");
      return;
    }
    onSubmit(parsed, {
      note: note.trim() || undefined,
      accountId: !isDial && accountId ? accountId : undefined,
      timestamp:
        whenTs !== null && Number.isFinite(whenTs) ? whenTs : undefined,
    });
  };

  const accentBg = isDial ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700";
  const accentRing = isDial ? "focus:ring-blue-500" : "focus:ring-emerald-500";
  const iconRingBg = isDial ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconRingBg}`}>
              {isDial ? (
                <Phone className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isDial ? "Log dials" : "Log prospects added"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            How many?
          </span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            autoFocus
            value={countStr}
            onChange={(e) => {
              setCountStr(e.target.value);
              if (error) setError(null);
            }}
            placeholder={isDial ? "e.g. 15" : "e.g. 3"}
            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 ${accentRing} outline-none`}
          />
        </label>

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            When?
          </span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 ${accentRing} outline-none`}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Default matches the current view ({periodLabel}). Change to
            backdate an entry.
            {isBackdated && (
              <span className="ml-1 font-semibold text-amber-700">
                (Backdated entry)
              </span>
            )}
          </p>
        </label>

        {!isDial && accounts.length > 0 && (
          <label className="block">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Account (optional)
            </span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 ${accentRing} outline-none`}
            >
              <option value="">— No account tag —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.accountData.companyName || "(unnamed)"}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Shows up in the weekly archive so you can see which account
              these prospects came from.
            </p>
          </label>
        )}

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Note (optional)
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. cold call blitz, referral batch"
            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 ${accentRing} outline-none`}
          />
        </label>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!isValid}
            className={`text-xs font-semibold text-white px-3 py-1.5 rounded-md shadow-sm transition-colors ${accentBg} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Save entry
          </button>
        </div>
      </div>
    </div>
  );
}

interface CalculatedSuggestion {
  dials: number;
  connects: number;
  prospects: number;
  meetingsBooked: number;
  meetingsHeldTarget: number;
}

function CalculateGoalsModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (s: CalculatedSuggestion) => void;
}) {
  const [dials, setDials] = useState("");
  const [connects, setConnects] = useState("");
  const [prospects, setProspects] = useState("");
  const [meetingsBooked, setMeetingsBooked] = useState("");
  const [meetingsHeld, setMeetingsHeld] = useState("");
  const [target, setTarget] = useState("");

  const parse = (s: string) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const nDials = parse(dials);
  const nConnects = parse(connects);
  const nProspects = parse(prospects);
  const nMeetingsBooked = parse(meetingsBooked);
  const nMeetingsHeld = parse(meetingsHeld);
  const nTarget = parse(target);

  // We can compute a suggestion once we have (a) all five historical
  // numbers > 0 and (b) a target > 0. The ratios all scale linearly:
  // to hit `target` meetings held per week, you need every other
  // stat scaled by (target / historicalHeld).
  const canCompute =
    nMeetingsHeld > 0 &&
    nTarget > 0 &&
    (nDials > 0 || nConnects > 0 || nProspects > 0 || nMeetingsBooked > 0);
  const ratio = canCompute ? nTarget / nMeetingsHeld : 0;
  const suggested: CalculatedSuggestion | null = canCompute
    ? {
        dials: Math.ceil(nDials * ratio),
        connects: Math.ceil(nConnects * ratio),
        prospects: Math.ceil(nProspects * ratio),
        meetingsBooked: Math.ceil(nMeetingsBooked * ratio),
        meetingsHeldTarget: nTarget,
      }
    : null;

  // Derived ratios for display, if the inputs support them.
  // Note: "Prospects dialed" is the unique-prospects count — dials
  // usually exceeds it because a single prospect may take multiple
  // attempts, so "% of unique dials" = prospects / dials tells you
  // your redial density.
  const pct = (numer: number, denom: number): string =>
    denom > 0 ? `${((numer / denom) * 100).toFixed(1)}%` : "—";
  const connectRate = pct(nConnects, nDials);
  const connectToBookedRate = pct(nMeetingsBooked, nConnects);
  const bookedToHeldRate = pct(nMeetingsHeld, nMeetingsBooked);
  const percentUniqueDials = pct(nProspects, nDials);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calculate goals
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter your historical numbers, then a target for
                meetings held.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Historical average
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Dials"
              value={parse(dials)}
              onChange={(v) => setDials(String(v))}
            />
            <NumberField
              label="Connects"
              value={parse(connects)}
              onChange={(v) => setConnects(String(v))}
            />
            <NumberField
              label="Prospects dialed (unique)"
              value={parse(prospects)}
              onChange={(v) => setProspects(String(v))}
            />
            <NumberField
              label="Meetings booked"
              value={parse(meetingsBooked)}
              onChange={(v) => setMeetingsBooked(String(v))}
            />
            <NumberField
              label="Meetings held"
              value={parse(meetingsHeld)}
              onChange={(v) => setMeetingsHeld(String(v))}
            />
          </div>

          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pt-2">
            Target
          </p>
          <NumberField
            label="Meetings held — target"
            value={parse(target)}
            onChange={(v) => setTarget(String(v))}
          />
        </div>

        {(nDials > 0 || nConnects > 0 || nProspects > 0 || nMeetingsBooked > 0) &&
          nMeetingsHeld > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Your funnel ratios
              </p>
              <p>
                <span className="text-slate-500">Connect rate:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {connectRate}
                </span>{" "}
                <span className="text-slate-400">(connects ÷ dials)</span>
              </p>
              <p>
                <span className="text-slate-500">Connect to booked rate:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {connectToBookedRate}
                </span>{" "}
                <span className="text-slate-400">
                  (meetings booked ÷ connects)
                </span>
              </p>
              <p>
                <span className="text-slate-500">Booked to held rate:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {bookedToHeldRate}
                </span>{" "}
                <span className="text-slate-400">
                  (meetings held ÷ meetings booked)
                </span>
              </p>
              <p>
                <span className="text-slate-500">
                  Percent of unique dials:
                </span>{" "}
                <span className="font-semibold text-slate-800">
                  {percentUniqueDials}
                </span>{" "}
                <span className="text-slate-400">
                  (prospects dialed ÷ dials)
                </span>
              </p>
            </div>
          )}

        {suggested && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
              Suggested goals to hit {suggested.meetingsHeldTarget} meetings
              held
            </p>
            <table className="w-full text-xs">
              <tbody>
                <SuggestRow label="Dials" value={suggested.dials} />
                <SuggestRow label="Connects" value={suggested.connects} />
                <SuggestRow
                  label="Prospects dialed"
                  value={suggested.prospects}
                />
                <SuggestRow
                  label="Meetings booked"
                  value={suggested.meetingsBooked}
                />
                <SuggestRow
                  label="Meetings held"
                  value={suggested.meetingsHeldTarget}
                />
              </tbody>
            </table>
            <p className="text-[10px] text-blue-700/80 italic pt-1">
              Note: Connects is used for the calc but isn&apos;t stored as a
              quarterly goal — the other four update the current
              quarter&apos;s goals when you Apply.
            </p>
          </div>
        )}

        {!suggested && (
          <p className="text-[11px] text-slate-500 italic">
            Fill in at least Meetings held (historical) plus the Target, and
            one of the funnel numbers, to see a suggestion.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => suggested && onApply(suggested)}
            disabled={!suggested}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md shadow-sm"
          >
            Apply as weekly goals
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="text-slate-700 py-0.5">{label}</td>
      <td className="text-right font-bold text-slate-900 py-0.5 tabular-nums">
        {value}
      </td>
    </tr>
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
          <NumberField
            label="Weekly meetings booked — goal"
            value={draft.weeklyMeetingsBookedGoal}
            onChange={(v) => set({ weeklyMeetingsBookedGoal: v })}
          />
          <NumberField
            label="Weekly meetings booked — benchmark"
            value={draft.weeklyMeetingsBookedBenchmark}
            onChange={(v) => set({ weeklyMeetingsBookedBenchmark: v })}
          />
          <NumberField
            label="Weekly meetings held — goal"
            value={draft.weeklyMeetingsHeldGoal}
            onChange={(v) => set({ weeklyMeetingsHeldGoal: v })}
          />
          <NumberField
            label="Weekly meetings held — benchmark"
            value={draft.weeklyMeetingsHeldBenchmark}
            onChange={(v) => set({ weeklyMeetingsHeldBenchmark: v })}
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
