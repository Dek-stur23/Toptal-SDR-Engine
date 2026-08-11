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
import { DateTime15Picker } from "@/components/DateTime15Picker";
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
  insertWeeklyGoalSnapshots,
  listGoalLogs,
  listQuarterlyGoals,
  listSavedWeeks,
  listWeeklyGoalSnapshots,
  clearSavedWeek,
  markSavedWeek,
  updateGoalLog,
  upsertQuarterlyGoals,
} from "@/lib/data/goals";
import { listAccounts } from "@/lib/data/accounts";
import { listMeetings, quickLogMeeting } from "@/lib/data/meetings";
import type {
  Account,
  GoalLogEntry,
  GoalMetricKind,
  Meeting,
  QuarterlyGoals,
  SavedWeek,
  WeeklyGoalSnapshot,
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

// Given a week-start ISO date, return the weekly goals + benchmarks
// that were in effect for that week. Past weeks pull from the frozen
// snapshot if one exists; the current week and anything without a
// snapshot fall back to the current quarterly goals.
function effectiveWeeklyGoalsFor(
  weekStartIso: string,
  snapshots: WeeklyGoalSnapshot[],
  currentGoals: QuarterlyGoals,
  isCurrent: boolean
): QuarterlyGoals {
  if (isCurrent) return currentGoals;
  const snap = snapshots.find((s) => s.weekStart === weekStartIso);
  if (!snap) return currentGoals;
  return {
    ...currentGoals,
    weeklyDialsGoal: snap.weeklyDialsGoal,
    weeklyDialsBenchmark: snap.weeklyDialsBenchmark,
    weeklyProspectsGoal: snap.weeklyProspectsGoal,
    weeklyProspectsBenchmark: snap.weeklyProspectsBenchmark,
    weeklyMeetingsBookedGoal: snap.weeklyMeetingsBookedGoal,
    weeklyMeetingsBookedBenchmark: snap.weeklyMeetingsBookedBenchmark,
    weeklyMeetingsHeldGoal: snap.weeklyMeetingsHeldGoal,
    weeklyMeetingsHeldBenchmark: snap.weeklyMeetingsHeldBenchmark,
  };
}

// Weeks remaining in the current calendar quarter (rounded up, min 1).
// Used as the default "Over this many weeks" value in Calculate Goals
// so a user opening the modal mid-quarter gets a sensible number.
function weeksRemainingInQuarter(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarterIdx = Math.floor(month / 3);
  const quarterEndMonth = quarterIdx * 3 + 2; // 0-based last month of quarter
  const quarterEnd = new Date(year, quarterEndMonth + 1, 0, 23, 59, 59, 999);
  const diffMs = quarterEnd.getTime() - now.getTime();
  if (diffMs <= 0) return 1;
  const days = diffMs / (24 * 60 * 60 * 1000);
  return Math.max(1, Math.ceil(days / 7));
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
  const [snapshots, setSnapshots] = useState<WeeklyGoalSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, m, q, l, s, snaps] = await Promise.all([
          listAccounts(supabase),
          listMeetings(supabase),
          listQuarterlyGoals(supabase),
          listGoalLogs(supabase),
          listSavedWeeks(supabase),
          listWeeklyGoalSnapshots(supabase),
        ]);
        if (cancelled) return;
        setAccounts(a);
        setMeetings(m);
        setQuarterly(q);
        setLogs(l);
        setSavedWeeks(s);
        setSnapshots(snaps);
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
  const [meetingLogOpen, setMeetingLogOpen] = useState(false);

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
    // Freeze past weeks before overwriting the goals. Any past week
    // in the current quarter that doesn't yet have a snapshot gets
    // one created with the OLD goals (currentQuarterGoals in state,
    // which reflects the DB state pre-update).
    const currentWeekIso = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    );
    const quarterStart = new Date(
      now.getFullYear(),
      (getQuarterOf(now).quarter - 1) * 3,
      1
    );
    const existingSnapshots = new Set(snapshots.map((s) => s.weekStart));
    const isoDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    // Walk each Monday from the quarter start to (but excluding) the
    // current week — those are the past weeks that need freezing.
    const pastWeekStarts: string[] = [];
    let cursor = new Date(quarterStart);
    // Nudge cursor forward to the Monday of the quarter-start week.
    const day = cursor.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    cursor.setDate(cursor.getDate() + (day <= 1 ? (day === 1 ? 0 : 1) : diff));
    const thisWeekMonday = (() => {
      const d = new Date(currentWeekIso);
      const wd = d.getDay();
      const off = wd === 0 ? -6 : 1 - wd;
      d.setDate(d.getDate() + off);
      return isoDate(d);
    })();
    while (isoDate(cursor) < thisWeekMonday) {
      const iso = isoDate(cursor);
      if (!existingSnapshots.has(iso)) pastWeekStarts.push(iso);
      cursor.setDate(cursor.getDate() + 7);
    }
    if (pastWeekStarts.length > 0 && currentQuarterGoals) {
      const newRows = await insertWeeklyGoalSnapshots(
        supabase,
        pastWeekStarts,
        currentQuarterGoals
      );
      setSnapshots((prev) => [...newRows, ...prev]);
    }

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
              <button
                onClick={() => setMeetingLogOpen(true)}
                className="w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Log meeting
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
          snapshots={snapshots}
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
                quarterly={
                  effectiveWeeklyGoalsFor(
                    b.weekStartIso,
                    snapshots,
                    currentQuarterGoals,
                    b.isCurrent
                  )
                }
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
            // Save the per-week numbers straight to the current quarter's
            // weekly goals and close.
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

      {meetingLogOpen && (
        <QuickLogMeetingModal
          accounts={accounts.filter((a) => !a.isArchived)}
          defaultWhenMs={suggestedWhenMs}
          onClose={() => setMeetingLogOpen(false)}
          onSubmit={async (status, accountId, whenMs) => {
            const saved = await quickLogMeeting(supabase, {
              status,
              accountId,
              when: new Date(whenMs).toISOString(),
            });
            setMeetings((prev) => [saved, ...prev]);
            setMeetingLogOpen(false);
          }}
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
  snapshots,
}: {
  logs: GoalLogEntry[];
  meetings: Meeting[];
  period: ReturnType<typeof resolveViewPeriod>;
  quarterly: QuarterlyGoals;
  snapshots: WeeklyGoalSnapshot[];
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

  // For weekly-granularity charts, resolve each bucket's goal +
  // benchmark by looking up the snapshot for that week (past weeks)
  // or falling back to the current quarterly goal (current + future).
  // Day-granularity charts stick with the single-value goal because
  // day buckets never straddle a goal change (they're all within one
  // week).
  const buildPerBucket = (
    buckets: import("@/lib/goals").ChartBucket[],
    picker: (g: QuarterlyGoals) => number
  ): number[] => {
    return buckets.map((b) => {
      const start = new Date(b.startMs);
      const iso = isoDateFor(start);
      const isCurrent = b.isCurrent;
      const eff = effectiveWeeklyGoalsFor(iso, snapshots, quarterly, isCurrent);
      return picker(eff);
    });
  };

  const dialsGoals =
    granularity === "week"
      ? buildPerBucket(dialBuckets, (g) => g.weeklyDialsGoal)
      : undefined;
  const dialsBenchmarks =
    granularity === "week"
      ? buildPerBucket(dialBuckets, (g) => g.weeklyDialsBenchmark)
      : undefined;
  const prospectsGoals =
    granularity === "week"
      ? buildPerBucket(prospectBuckets, (g) => g.weeklyProspectsGoal)
      : undefined;
  const prospectsBenchmarks =
    granularity === "week"
      ? buildPerBucket(prospectBuckets, (g) => g.weeklyProspectsBenchmark)
      : undefined;
  const meetingsBookedGoals =
    granularity === "week"
      ? buildPerBucket(meetingsBookedBuckets, (g) => g.weeklyMeetingsBookedGoal)
      : undefined;
  const meetingsBookedBenchmarks =
    granularity === "week"
      ? buildPerBucket(
          meetingsBookedBuckets,
          (g) => g.weeklyMeetingsBookedBenchmark
        )
      : undefined;
  const meetingsHeldGoals =
    granularity === "week"
      ? buildPerBucket(meetingsHeldBuckets, (g) => g.weeklyMeetingsHeldGoal)
      : undefined;
  const meetingsHeldBenchmarks =
    granularity === "week"
      ? buildPerBucket(
          meetingsHeldBuckets,
          (g) => g.weeklyMeetingsHeldBenchmark
        )
      : undefined;

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
          bucketGoals={dialsGoals}
          bucketBenchmarks={dialsBenchmarks}
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
          bucketGoals={prospectsGoals}
          bucketBenchmarks={prospectsBenchmarks}
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
          bucketGoals={meetingsBookedGoals}
          bucketBenchmarks={meetingsBookedBenchmarks}
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
          bucketGoals={meetingsHeldGoals}
          bucketBenchmarks={meetingsHeldBenchmarks}
          barColorClass="fill-purple-500"
          currentBarColorClass="fill-purple-700"
          goalStrokeClass="stroke-purple-700"
          benchmarkStrokeClass="stroke-purple-300"
        />
      </div>
    </section>
  );
}

// YYYY-MM-DD helper matching the DB week_start format.
function isoDateFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [whenMs, setWhenMs] = useState<number>(defaultWhenMs);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = Number.parseInt(countStr, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 1;
  const nowMs = Date.now();
  const isBackdated = Math.abs(whenMs - nowMs) > 60_000;

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
        timestamp: whenMs,
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
          <DateTime15Picker
            valueMs={whenMs}
            onChange={setWhenMs}
            focusRingClass={accentRing}
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
  // "Over this many weeks" is the timespan the entered target covers.
  // Defaults to the number of full weeks remaining in the current
  // quarter, so a user opening the modal mid-quarter gets a sensible
  // default without any thinking.
  const [weeksStr, setWeeksStr] = useState(() =>
    String(weeksRemainingInQuarter())
  );

  const parse = (s: string) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const weeksInPeriod = Math.max(1, parse(weeksStr) || 1);

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
  const showsWeeklyColumn = weeksInPeriod !== 1;

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
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Historical numbers
          </p>
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
          <NumberField
            label="Over this many weeks"
            value={parse(weeksStr)}
            onChange={(v) => setWeeksStr(String(v))}
            placeholder="e.g. 13"
          />
          <p className="text-[10px] text-slate-500 italic -mt-1">
            Defaults to the number of weeks left in the current quarter. The
            per-week goals are computed by dividing the total suggestion by
            this number.
          </p>
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

        {suggested && weekly && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
              Suggested goals to hit {suggested.meetingsHeldTarget} meetings
              held over {weeksInPeriod} week{weeksInPeriod === 1 ? "" : "s"}
            </p>
            <table className="w-full text-xs">
              <thead>
                {showsWeeklyColumn && (
                  <tr className="text-[10px] uppercase tracking-wider text-blue-700/70">
                    <th className="text-left font-semibold py-1"></th>
                    <th className="text-right font-semibold py-1">
                      Total over {weeksInPeriod} wks
                    </th>
                    <th className="text-right font-semibold py-1 pl-3">Per week</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <SuggestRow
                  label="Dials"
                  value={suggested.dials}
                  weeklyValue={showsWeeklyColumn ? weekly.dials : undefined}
                />
                <SuggestRow
                  label="Connects"
                  value={suggested.connects}
                  weeklyValue={showsWeeklyColumn ? weekly.connects : undefined}
                />
                <SuggestRow
                  label="Prospects dialed"
                  value={suggested.prospects}
                  weeklyValue={showsWeeklyColumn ? weekly.prospects : undefined}
                />
                <SuggestRow
                  label="Meetings booked"
                  value={suggested.meetingsBooked}
                  weeklyValue={showsWeeklyColumn ? weekly.meetingsBooked : undefined}
                />
                <SuggestRow
                  label="Meetings held"
                  value={suggested.meetingsHeldTarget}
                  weeklyValue={showsWeeklyColumn ? weekly.meetingsHeldTarget : undefined}
                />
              </tbody>
            </table>
            <p className="text-[10px] text-blue-700/80 italic pt-1">
              Apply saves the per-week numbers to the current quarter&apos;s
              weekly goals right away. Connects is used for the calc but
              isn&apos;t stored as a quarterly goal.
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

// Small modal used by the "Log meeting" button on the Log Activity
// card. Skips every prospect-details field of the full Meetings
// Tracker modal — just status, account (optional), when. Backdating
// works because quickLogMeeting sets created_at + held_at from
// whichever timestamp the user picks, so counts land in the right
// weekly bucket.
function QuickLogMeetingModal({
  accounts,
  defaultWhenMs,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  defaultWhenMs: number;
  onClose: () => void;
  onSubmit: (
    status: "booked" | "held",
    accountId: string | null,
    whenMs: number
  ) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<"booked" | "held">("booked");
  const [accountId, setAccountId] = useState("");
  const [whenMs, setWhenMs] = useState<number>(defaultWhenMs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowMs = Date.now();
  const isBackdated = Math.abs(whenMs - nowMs) > 60_000;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(status, accountId || null, whenMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Log meeting</h3>
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
            Status
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus("booked")}
              className={`text-xs font-semibold py-2 px-3 rounded-md border transition-colors ${
                status === "booked"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Booked
            </button>
            <button
              type="button"
              onClick={() => setStatus("held")}
              className={`text-xs font-semibold py-2 px-3 rounded-md border transition-colors ${
                status === "held"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Held
            </button>
          </div>
        </label>

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Account (optional)
          </span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">— No account tag —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || "(unnamed)"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            When
          </span>
          <DateTime15Picker
            valueMs={whenMs}
            onChange={setWhenMs}
            focusRingClass="focus:ring-indigo-500"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Defaults to now. Change to backlog a past meeting.
            {isBackdated && (
              <span className="ml-1 font-semibold text-amber-700">
                (Backdated entry)
              </span>
            )}
          </p>
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
            disabled={busy}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
          >
            {busy ? "Saving…" : "Log meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
