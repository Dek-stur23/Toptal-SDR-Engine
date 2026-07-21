"use client";

import { useEffect, useMemo, useState } from "react";
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
import { PacingChart } from "@/components/PacingChart";
import { createClient } from "@/lib/supabase/client";
import {
  bucketLogsForChart,
  bucketMeetingsForChart,
  chartGranularityFor,
  defaultQuarterlyGoals,
  findQuarterlyGoals,
  getQuarterOf,
  groupLogsByWeek,
  isWeekExplicitlyUnlocked,
  isWeekLocked,
  isWeekManuallySaved,
  resolveViewPeriod,
  sumLogsInRange,
  sumMeetingsInRange,
  type ViewPeriodKind,
  type WeeklyBucket,
} from "@/lib/goals";
import {
  deleteGoalLog,
  insertGoalLog,
  listGoalLogs,
  listQuarterlyGoals,
  listSavedWeeks,
  clearSavedWeek,
  markSavedWeek,
  updateGoalLog,
  upsertQuarterlyGoals,
} from "@/lib/data/goals";
import { listAccounts } from "@/lib/data/accounts";
import { listMeetings } from "@/lib/data/meetings";
import type {
  Account,
  GoalLogEntry,
  GoalMetricKind,
  Meeting,
  QuarterlyGoals,
  SavedWeek,
} from "@/lib/types";

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

export function GoalsAndBenchmarks() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyGoals[]>([]);
  const [logs, setLogs] = useState<GoalLogEntry[]>([]);
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, m, q, l, s] = await Promise.all([
          listAccounts(supabase),
          listMeetings(supabase),
          listQuarterlyGoals(supabase),
          listGoalLogs(supabase),
          listSavedWeeks(supabase),
        ]);
        if (cancelled) return;
        setAccounts(a);
        setMeetings(m);
        setQuarterly(q);
        setLogs(l);
        setSavedWeeks(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const now = new Date();
  const { year, quarter } = getQuarterOf(now);
  const currentQuarterGoals: QuarterlyGoals =
    findQuarterlyGoals(quarterly, year, quarter) ??
    ({ id: "", ...defaultQuarterlyGoals(year, quarter) } as QuarterlyGoals);

  const [editingGoals, setEditingGoals] = useState(false);
  const [calculatingGoals, setCalculatingGoals] = useState(false);
  const [periodKind, setPeriodKind] = useState<ViewPeriodKind>("this-week");
  const period = useMemo(() => resolveViewPeriod(periodKind, now), [
    periodKind,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    now.getTime(),
  ]);
  const periodRollup = useMemo(
    () => sumLogsInRange(logs, period.fromMs, period.toMs),
    [logs, period.fromMs, period.toMs]
  );
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayRollupNow = sumLogsInRange(logs, todayStart.getTime(), todayEnd.getTime());

  const periodDialsGoal =
    periodKind === "today"
      ? currentQuarterGoals.dailyDialsGoal
      : currentQuarterGoals.weeklyDialsGoal * period.weeks;
  const periodDialsBenchmark =
    periodKind === "today"
      ? currentQuarterGoals.dailyDialsBenchmark
      : currentQuarterGoals.weeklyDialsBenchmark * period.weeks;
  const periodProspectsGoal = Math.round(
    currentQuarterGoals.weeklyProspectsGoal * period.weeks
  );
  const periodProspectsBenchmark = Math.round(
    currentQuarterGoals.weeklyProspectsBenchmark * period.weeks
  );
  const periodMeetingsBookedGoal = Math.round(
    currentQuarterGoals.weeklyMeetingsBookedGoal * period.weeks
  );
  const periodMeetingsBookedBenchmark = Math.round(
    currentQuarterGoals.weeklyMeetingsBookedBenchmark * period.weeks
  );
  const periodMeetingsHeldGoal = Math.round(
    currentQuarterGoals.weeklyMeetingsHeldGoal * period.weeks
  );
  const periodMeetingsHeldBenchmark = Math.round(
    currentQuarterGoals.weeklyMeetingsHeldBenchmark * period.weeks
  );

  const meetingsRollup = useMemo(
    () => sumMeetingsInRange(meetings, period.fromMs, period.toMs),
    [meetings, period.fromMs, period.toMs]
  );

  const buckets = useMemo(() => groupLogsByWeek(logs, now), [logs, now]);

  const accountNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.name || "(unnamed)";
    return m;
  }, [accounts]);

  const [logModalKind, setLogModalKind] = useState<GoalMetricKind | null>(null);

  const suggestedWhenMs = useMemo(() => {
    const nowMs = now.getTime();
    if (nowMs >= period.fromMs && nowMs <= period.toMs) return nowMs;
    const end = new Date(period.toMs);
    end.setHours(17, 0, 0, 0);
    return end.getTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.fromMs, period.toMs, now.getTime()]);

  const submitLog = async (
    kind: GoalMetricKind,
    count: number,
    opts: { note?: string; accountId?: string; timestamp?: number }
  ) => {
    const loggedAt = new Date(opts.timestamp ?? Date.now()).toISOString();
    const created = await insertGoalLog(supabase, {
      kind,
      loggedAt,
      count: Math.max(1, Math.floor(count)),
      note: opts.note ?? null,
      accountId: opts.accountId ?? null,
    });
    setLogs((prev) => [created, ...prev]);
    setLogModalKind(null);
  };

  const handleUpdateLog = async (
    id: string,
    patch: { count?: number; note?: string; accountId?: string }
  ) => {
    const updated = await updateGoalLog(supabase, id, patch);
    setLogs((prev) => prev.map((l) => (l.id === id ? updated : l)));
  };

  const handleDeleteLog = async (id: string) => {
    await deleteGoalLog(supabase, id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSaveGoals = async (next: QuarterlyGoals) => {
    const saved = await upsertQuarterlyGoals(supabase, next);
    setQuarterly((prev) => {
      const others = prev.filter(
        (q) => !(q.year === saved.year && q.quarter === saved.quarter)
      );
      return [saved, ...others];
    });
    setEditingGoals(false);
  };

  const handleSaveWeek = async (weekStart: Date) => {
    const iso = weekStart.toISOString().slice(0, 10);
    await markSavedWeek(supabase, iso, "manually-saved");
    // Also drop any explicit unlock so save takes effect.
    const explicit = savedWeeks.find(
      (s) => s.weekStart === iso && s.kind === "unlocked"
    );
    if (explicit) await clearSavedWeek(supabase, iso, "unlocked");
    setSavedWeeks(await listSavedWeeks(supabase));
  };

  const handleUnsaveWeek = async (weekStart: Date) => {
    const iso = weekStart.toISOString().slice(0, 10);
    await clearSavedWeek(supabase, iso, "manually-saved");
    setSavedWeeks(await listSavedWeeks(supabase));
  };

  const handleToggleUnlock = async (weekStart: Date) => {
    const iso = weekStart.toISOString().slice(0, 10);
    const alreadyUnlocked = savedWeeks.some(
      (s) => s.weekStart === iso && s.kind === "unlocked"
    );
    if (alreadyUnlocked) await clearSavedWeek(supabase, iso, "unlocked");
    else await markSavedWeek(supabase, iso, "unlocked");
    setSavedWeeks(await listSavedWeeks(supabase));
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">Failed to load: {error}</p>;
  }

  return (
    <div className="space-y-8">
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
                onClick={() => setLogModalKind("dial")}
                className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Log dials
              </button>
              <button
                onClick={() => setLogModalKind("prospect-added")}
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
          logs={logs}
          meetings={meetings}
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
                savedWeeks={savedWeeks}
                now={now}
                accountNameById={accountNameById}
                onSaveWeek={handleSaveWeek}
                onUnsaveWeek={handleUnsaveWeek}
                onToggleUnlock={handleToggleUnlock}
                onDeleteLog={handleDeleteLog}
                onUpdateLog={handleUpdateLog}
              />
            ))}
          </ul>
        )}
      </section>

      {editingGoals && (
        <EditGoalsModal
          initial={currentQuarterGoals}
          onClose={() => setEditingGoals(false)}
          onSave={handleSaveGoals}
        />
      )}

      {calculatingGoals && (
        <CalculateGoalsModal
          onClose={() => setCalculatingGoals(false)}
          onApply={async (suggested) => {
            await handleSaveGoals({
              ...currentQuarterGoals,
              weeklyDialsGoal: suggested.dials,
              weeklyProspectsGoal: suggested.prospects,
              weeklyMeetingsBookedGoal: suggested.meetingsBooked,
              weeklyMeetingsHeldGoal: suggested.meetingsHeldTarget,
            });
            setCalculatingGoals(false);
          }}
        />
      )}

      {logModalKind && (
        <LogEntryModal
          kind={logModalKind}
          accounts={accounts.filter((a) => !a.isArchived)}
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
  logs: GoalLogEntry[];
  meetings: Meeting[];
  period: ReturnType<typeof resolveViewPeriod>;
  quarterly: QuarterlyGoals;
}) {
  const now = new Date();
  const dialBuckets = useMemo(
    () => bucketLogsForChart(logs, period, "dial", now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, period, now.getTime()]
  );
  const prospectBuckets = useMemo(
    () => bucketLogsForChart(logs, period, "prospect-added", now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, period, now.getTime()]
  );
  const meetingsBookedBuckets = useMemo(
    () => bucketMeetingsForChart(meetings, period, "booked", now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetings, period, now.getTime()]
  );
  const meetingsHeldBuckets = useMemo(
    () => bucketMeetingsForChart(meetings, period, "held", now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetings, period, now.getTime()]
  );
  const granularity = chartGranularityFor(period.kind);
  const dialsGoalPerBucket =
    granularity === "day" ? quarterly.dailyDialsGoal : quarterly.weeklyDialsGoal;
  const dialsBenchmarkPerBucket =
    granularity === "day"
      ? quarterly.dailyDialsBenchmark
      : quarterly.weeklyDialsBenchmark;
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

  const subtitle = granularity === "day" ? "Per day" : "Per week";

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
      {sublabel && <p className="text-[11px] text-slate-500">{sublabel}</p>}
      <ProgressBar percent={goalPct} colorClass="bg-blue-500" />
      <p className="text-[11px] text-slate-500 leading-tight">
        {goal ? `${goalPct}% of goal` : "Set a goal to track progress"}
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
  savedWeeks,
  now,
  accountNameById,
  onSaveWeek,
  onUnsaveWeek,
  onToggleUnlock,
  onDeleteLog,
  onUpdateLog,
}: {
  bucket: WeeklyBucket;
  quarterly: QuarterlyGoals;
  savedWeeks: SavedWeek[];
  now: Date;
  accountNameById: Record<string, string>;
  onSaveWeek: (weekStart: Date) => void | Promise<void>;
  onUnsaveWeek: (weekStart: Date) => void | Promise<void>;
  onToggleUnlock: (weekStart: Date) => void | Promise<void>;
  onDeleteLog: (id: string) => void | Promise<void>;
  onUpdateLog: (
    id: string,
    patch: { count?: number; note?: string; accountId?: string }
  ) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(bucket.isCurrent);
  const locked = isWeekLocked(savedWeeks, bucket.weekStart, now);
  const explicitlyUnlocked = isWeekExplicitlyUnlocked(savedWeeks, bucket.weekStart);
  const isManuallySaved = isWeekManuallySaved(savedWeeks, bucket.weekStart);

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
            {quarterly.weeklyDialsGoal ? ` (${dialsPct}% of goal)` : ""} ·{" "}
            {bucket.totals.prospects} prospects
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
                      "Save this week? It will be locked in the archive. You can reopen it later if needed."
                    )
                  ) {
                    void onSaveWeek(bucket.weekStart);
                  }
                }}
                className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
              >
                <Save className="w-3 h-3" /> Save week
              </button>
            )}
            {bucket.isCurrent && isManuallySaved && (
              <button
                onClick={() => void onUnsaveWeek(bucket.weekStart)}
                className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
              >
                <Unlock className="w-3 h-3" /> Reopen this week
              </button>
            )}
            {!bucket.isCurrent && (
              <button
                onClick={() => void onToggleUnlock(bucket.weekStart)}
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
                  onDelete={() => void onDeleteLog(l.id)}
                  onUpdate={(patch) => void onUpdateLog(l.id, patch)}
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
  onUpdate: (patch: { count?: number; note?: string; accountId?: string }) => void;
}) {
  const accountName = entry.accountId
    ? accountNameById[entry.accountId] ?? "(deleted account)"
    : null;
  const time = new Date(entry.loggedAt).toLocaleString(undefined, {
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
    onUpdate({ count: n, note: draftNote.trim() });
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
  kind: GoalMetricKind;
  accounts: Account[];
  defaultWhenMs: number;
  periodLabel: string;
  onClose: () => void;
  onSubmit: (
    count: number,
    opts: { note?: string; accountId?: string; timestamp?: number }
  ) => void | Promise<void>;
}) {
  const isDial = kind === "dial";
  const [countStr, setCountStr] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [when, setWhen] = useState(formatDatetimeLocal(defaultWhenMs));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = Number.parseInt(countStr, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 1;
  const whenTs = parseDatetimeLocal(when);
  const nowMs = Date.now();
  const isBackdated =
    Number.isFinite(whenTs) && whenTs !== null && Math.abs(whenTs - nowMs) > 60_000;

  const submit = async () => {
    if (!isValid) {
      setError("Enter a whole number of 1 or more.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed, {
        note: note.trim() || undefined,
        accountId: !isDial && accountId ? accountId : undefined,
        timestamp: whenTs !== null && Number.isFinite(whenTs) ? whenTs : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const accentBg = isDial
    ? "bg-blue-600 hover:bg-blue-700"
    : "bg-emerald-600 hover:bg-emerald-700";
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
            void submit();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconRingBg}`}
            >
              {isDial ? <Phone className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
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
            Default matches the current view ({periodLabel}). Change to backdate an entry.
            {isBackdated && (
              <span className="ml-1 font-semibold text-amber-700">(Backdated entry)</span>
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
                  {a.name || "(unnamed)"}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Shows up in the weekly archive so you can see which account these prospects came from.
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

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!isValid || busy}
            className={`text-xs font-semibold text-white px-3 py-1.5 rounded-md shadow-sm transition-colors ${accentBg} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {busy ? "Saving…" : "Save entry"}
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
  onApply: (s: CalculatedSuggestion) => void | Promise<void>;
}) {
  const [dials, setDials] = useState("");
  const [connects, setConnects] = useState("");
  const [prospects, setProspects] = useState("");
  const [meetingsBooked, setMeetingsBooked] = useState("");
  const [meetingsHeld, setMeetingsHeld] = useState("");
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState<
    "weekly" | "monthly" | "quarterly" | "historical"
  >("weekly");
  const [showWeekly, setShowWeekly] = useState(false);
  // "historical" carries no built-in timespan — treat the entered
  // numbers as a single-period reference like weekly (no scaling).
  const weeksInPeriod =
    period === "weekly" || period === "historical"
      ? 1
      : period === "monthly"
        ? 4.33
        : 13;
  // Weekly + Historical share the "1 week per bucket" math, so the
  // weekly breakdown matches the suggestion 1:1 for both.
  const isSinglePeriod = period === "weekly" || period === "historical";
  // Human-readable "per X" label. Only used when isSinglePeriod is
  // false, so we don't have to handle historical here.
  const periodShortLabel =
    period === "monthly" ? "month" : period === "quarterly" ? "quarter" : period;

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

  const weekly: CalculatedSuggestion | null = suggested
    ? {
        dials: Math.ceil(suggested.dials / weeksInPeriod),
        connects: Math.ceil(suggested.connects / weeksInPeriod),
        prospects: Math.ceil(suggested.prospects / weeksInPeriod),
        meetingsBooked: Math.ceil(suggested.meetingsBooked / weeksInPeriod),
        meetingsHeldTarget: Math.ceil(suggested.meetingsHeldTarget / weeksInPeriod),
      }
    : null;

  const pctStr = (numer: number, denom: number): string =>
    denom > 0 ? `${((numer / denom) * 100).toFixed(1)}%` : "—";
  const connectRate = pctStr(nConnects, nDials);
  const connectToBookedRate = pctStr(nMeetingsBooked, nConnects);
  const bookedToHeldRate = pctStr(nMeetingsHeld, nMeetingsBooked);
  const percentUniqueDials = pctStr(nProspects, nDials);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Calculate goals</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter your historical numbers, then a target for meetings held.
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
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Historical average
            </p>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="uppercase tracking-wider font-semibold">Period</span>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(
                    e.target.value as "weekly" | "monthly" | "quarterly" | "historical"
                  );
                  setShowWeekly(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="historical">Historical</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Dials" value={parse(dials)} onChange={(v) => setDials(String(v))} />
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
                <span className="font-semibold text-slate-800">{connectRate}</span>{" "}
                <span className="text-slate-400">(connects ÷ dials)</span>
              </p>
              <p>
                <span className="text-slate-500">Connect to booked rate:</span>{" "}
                <span className="font-semibold text-slate-800">{connectToBookedRate}</span>{" "}
                <span className="text-slate-400">(meetings booked ÷ connects)</span>
              </p>
              <p>
                <span className="text-slate-500">Booked to held rate:</span>{" "}
                <span className="font-semibold text-slate-800">{bookedToHeldRate}</span>{" "}
                <span className="text-slate-400">(meetings held ÷ meetings booked)</span>
              </p>
              <p>
                <span className="text-slate-500">Percent of unique dials:</span>{" "}
                <span className="font-semibold text-slate-800">{percentUniqueDials}</span>{" "}
                <span className="text-slate-400">(prospects dialed ÷ dials)</span>
              </p>
            </div>
          )}

        {suggested && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
                Suggested goals to hit {suggested.meetingsHeldTarget} meetings held
                {!isSinglePeriod && (
                  <span className="normal-case font-normal text-blue-700/70">
                    {" "}
                    (per {periodShortLabel})
                  </span>
                )}
              </p>
              <button
                onClick={() => setShowWeekly((v) => !v)}
                className="text-[10px] font-semibold text-blue-700 hover:text-white hover:bg-blue-600 border border-blue-300 hover:border-blue-600 px-2 py-0.5 rounded transition-colors"
              >
                {showWeekly ? "Hide weekly breakdown" : "Check weekly breakdown"}
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                {showWeekly && weekly && !isSinglePeriod && (
                  <tr className="text-[10px] uppercase tracking-wider text-blue-700/70">
                    <th className="text-left font-semibold py-1"></th>
                    <th className="text-right font-semibold py-1">
                      Per {periodShortLabel}
                    </th>
                    <th className="text-right font-semibold py-1 pl-3">Per week</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <SuggestRow
                  label="Dials"
                  value={suggested.dials}
                  weeklyValue={
                    showWeekly && weekly && !isSinglePeriod ? weekly.dials : undefined
                  }
                />
                <SuggestRow
                  label="Connects"
                  value={suggested.connects}
                  weeklyValue={
                    showWeekly && weekly && !isSinglePeriod ? weekly.connects : undefined
                  }
                />
                <SuggestRow
                  label="Prospects dialed"
                  value={suggested.prospects}
                  weeklyValue={
                    showWeekly && weekly && !isSinglePeriod ? weekly.prospects : undefined
                  }
                />
                <SuggestRow
                  label="Meetings booked"
                  value={suggested.meetingsBooked}
                  weeklyValue={
                    showWeekly && weekly && !isSinglePeriod ? weekly.meetingsBooked : undefined
                  }
                />
                <SuggestRow
                  label="Meetings held"
                  value={suggested.meetingsHeldTarget}
                  weeklyValue={
                    showWeekly && weekly && !isSinglePeriod
                      ? weekly.meetingsHeldTarget
                      : undefined
                  }
                />
              </tbody>
            </table>
            {showWeekly && weekly && isSinglePeriod && (
              <p className="text-[10px] text-blue-700/80 italic">
                {period === "weekly"
                  ? "You entered weekly numbers, so the weekly breakdown matches the suggestion above 1:1."
                  : "Historical numbers are treated as a single period (no scaling), so the weekly breakdown matches the suggestion above 1:1."}
              </p>
            )}
            <p className="text-[10px] text-blue-700/80 italic pt-1">
              Note: Connects is used for the calc but isn&apos;t stored as a quarterly
              goal — the other four update the current quarter&apos;s goals when you
              Apply (using the weekly breakdown, since goals are stored weekly).
            </p>
          </div>
        )}

        {!suggested && (
          <p className="text-[11px] text-slate-500 italic">
            Fill in at least Meetings held (historical) plus the Target, and one of the
            funnel numbers, to see a suggestion.
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
            onClick={() => weekly && void onApply(weekly)}
            disabled={!weekly}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md shadow-sm"
          >
            Apply as weekly goals
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestRow({
  label,
  value,
  weeklyValue,
}: {
  label: string;
  value: number;
  weeklyValue?: number;
}) {
  return (
    <tr>
      <td className="text-slate-700 py-0.5">{label}</td>
      <td className="text-right font-bold text-slate-900 py-0.5 tabular-nums">{value}</td>
      {weeklyValue !== undefined && (
        <td className="text-right font-bold text-blue-700 py-0.5 tabular-nums pl-3">
          {weeklyValue}
        </td>
      )}
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
  onSave: (next: QuarterlyGoals) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<QuarterlyGoals>(initial);
  const set = (patch: Partial<QuarterlyGoals>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto"
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
          Goal is what you commit to. Benchmark is your reference target (team standard,
          stretch goal — whatever you decide).
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
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(draft);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
          >
            {busy ? "Saving…" : "Save goals"}
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
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value === 0 ? "" : value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number.parseFloat(raw);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
      />
    </label>
  );
}
