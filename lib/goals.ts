// Pure helpers for the Goals & Benchmarks dashboard. No React, no
// storage — just date math and log rollups. Everything is a function
// of (state, referenceDate) so the same logic can be tested
// deterministically.

import type {
  GoalLogEntry,
  GoalMetricKind,
  QuarterlyGoals,
  UserGoalsState,
} from "./types";
import { genId } from "./ids";

// ---- Date math (Mon-Sun weeks) ------------------------------------

// Returns the Monday at 00:00 of the ISO week containing `date`.
export function weekStartFor(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekEndFor(date: Date): Date {
  const start = weekStartFor(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function dayStartFor(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayEndFor(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getQuarterOf(date: Date): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const quarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

export function quarterStartFor(date: Date): Date {
  const { year, quarter } = getQuarterOf(date);
  return new Date(year, (quarter - 1) * 3, 1, 0, 0, 0, 0);
}

// ---- Goals lookup / defaults --------------------------------------

export function emptyGoalsState(): UserGoalsState {
  return {
    quarterly: [],
    logs: [],
    unlockedWeekStarts: [],
    manuallySavedWeekStarts: [],
  };
}

export function defaultQuarterlyGoals(
  year: number,
  quarter: 1 | 2 | 3 | 4,
): QuarterlyGoals {
  return {
    year,
    quarter,
    dailyDialsGoal: 0,
    dailyDialsBenchmark: 0,
    weeklyDialsGoal: 0,
    weeklyDialsBenchmark: 0,
    weeklyProspectsGoal: 0,
    weeklyProspectsBenchmark: 0,
  };
}

export function findQuarterlyGoals(
  state: UserGoalsState,
  year: number,
  quarter: 1 | 2 | 3 | 4,
): QuarterlyGoals | null {
  return (
    state.quarterly.find((q) => q.year === year && q.quarter === quarter) ?? null
  );
}

export function upsertQuarterlyGoals(
  state: UserGoalsState,
  goals: QuarterlyGoals,
): UserGoalsState {
  const others = state.quarterly.filter(
    (q) => !(q.year === goals.year && q.quarter === goals.quarter),
  );
  return { ...state, quarterly: [...others, goals] };
}

// ---- Log mutation --------------------------------------------------

export function createLog(
  kind: GoalMetricKind,
  count: number,
  opts: { note?: string; accountId?: string; timestamp?: number } = {},
): GoalLogEntry {
  const ts =
    typeof opts.timestamp === "number" && Number.isFinite(opts.timestamp)
      ? opts.timestamp
      : Date.now();
  const entry: GoalLogEntry = {
    id: genId(),
    kind,
    timestamp: ts,
    count: Math.max(1, Math.floor(count)),
  };
  const note = opts.note?.trim();
  if (note) entry.note = note;
  if (opts.accountId) entry.accountId = opts.accountId;
  return entry;
}

export function appendLog(
  state: UserGoalsState,
  entry: GoalLogEntry,
): UserGoalsState {
  return { ...state, logs: [...state.logs, entry] };
}

export function updateLog(
  state: UserGoalsState,
  id: number,
  patch: Partial<Pick<GoalLogEntry, "count" | "note" | "accountId">>,
): UserGoalsState {
  return {
    ...state,
    logs: state.logs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  };
}

export function removeLog(state: UserGoalsState, id: number): UserGoalsState {
  return { ...state, logs: state.logs.filter((l) => l.id !== id) };
}

// ---- Locking -------------------------------------------------------

export function isWeekLocked(
  state: UserGoalsState,
  weekStart: Date,
  now: Date = new Date(),
): boolean {
  const currentWeekStart = formatIsoDate(weekStartFor(now));
  const target = formatIsoDate(weekStartFor(weekStart));
  // Explicit unlock always wins, whether the week is current or past.
  if (state.unlockedWeekStarts.includes(target)) return false;
  // Manually saved (user clicked Save week) → locked, even if it's still
  // the current week by date.
  if (state.manuallySavedWeekStarts.includes(target)) return true;
  if (target === currentWeekStart) return false; // current week always editable
  if (target > currentWeekStart) return false; // future weeks (shouldn't happen) editable
  return true; // past week, no unlock override → locked
}

export function isWeekManuallySaved(
  state: UserGoalsState,
  weekStart: Date,
): boolean {
  return state.manuallySavedWeekStarts.includes(
    formatIsoDate(weekStartFor(weekStart)),
  );
}

export function toggleWeekUnlock(
  state: UserGoalsState,
  weekStart: Date,
): UserGoalsState {
  const key = formatIsoDate(weekStartFor(weekStart));
  const isUnlocked = state.unlockedWeekStarts.includes(key);
  return {
    ...state,
    unlockedWeekStarts: isUnlocked
      ? state.unlockedWeekStarts.filter((k) => k !== key)
      : [...state.unlockedWeekStarts, key],
  };
}

// "Save week" from the current week's card — locks the week manually.
// Also clears any explicit unlock override so the save takes effect.
export function saveWeek(
  state: UserGoalsState,
  weekStart: Date,
): UserGoalsState {
  const key = formatIsoDate(weekStartFor(weekStart));
  return {
    ...state,
    manuallySavedWeekStarts: state.manuallySavedWeekStarts.includes(key)
      ? state.manuallySavedWeekStarts
      : [...state.manuallySavedWeekStarts, key],
    unlockedWeekStarts: state.unlockedWeekStarts.filter((k) => k !== key),
  };
}

// Reverses a saveWeek by removing from manuallySavedWeekStarts.
export function unsaveWeek(
  state: UserGoalsState,
  weekStart: Date,
): UserGoalsState {
  const key = formatIsoDate(weekStartFor(weekStart));
  return {
    ...state,
    manuallySavedWeekStarts: state.manuallySavedWeekStarts.filter(
      (k) => k !== key,
    ),
  };
}

// ---- Rollups -------------------------------------------------------

export interface Rollup {
  dials: number;
  prospects: number;
}

export function sumLogsInRange(
  logs: GoalLogEntry[],
  fromMs: number,
  toMs: number,
): Rollup {
  let dials = 0;
  let prospects = 0;
  for (const l of logs) {
    if (l.timestamp < fromMs || l.timestamp > toMs) continue;
    if (l.kind === "dial") dials += l.count;
    else if (l.kind === "prospect-added") prospects += l.count;
  }
  return { dials, prospects };
}

export function todayRollup(
  state: UserGoalsState,
  now: Date = new Date(),
): Rollup {
  return sumLogsInRange(
    state.logs,
    dayStartFor(now).getTime(),
    dayEndFor(now).getTime(),
  );
}

export function weekRollup(
  state: UserGoalsState,
  reference: Date = new Date(),
): Rollup {
  return sumLogsInRange(
    state.logs,
    weekStartFor(reference).getTime(),
    weekEndFor(reference).getTime(),
  );
}

// ---- Weekly archive (grouping) -----------------------------------

export interface WeeklyBucket {
  weekStart: Date;
  weekEnd: Date;
  weekStartIso: string; // YYYY-MM-DD key
  totals: Rollup;
  logs: GoalLogEntry[];
  isCurrent: boolean;
}

// Groups all logs into per-week buckets, most-recent first.
export function groupLogsByWeek(
  state: UserGoalsState,
  now: Date = new Date(),
): WeeklyBucket[] {
  const currentWeekIso = formatIsoDate(weekStartFor(now));
  const buckets = new Map<string, WeeklyBucket>();
  const ensureBucket = (ref: Date): WeeklyBucket => {
    const start = weekStartFor(ref);
    const key = formatIsoDate(start);
    const existing = buckets.get(key);
    if (existing) return existing;
    const bucket: WeeklyBucket = {
      weekStart: start,
      weekEnd: weekEndFor(ref),
      weekStartIso: key,
      totals: { dials: 0, prospects: 0 },
      logs: [],
      isCurrent: key === currentWeekIso,
    };
    buckets.set(key, bucket);
    return bucket;
  };
  // Always include the current week, even if there are no logs, so the user
  // sees a placeholder module for it.
  ensureBucket(now);
  for (const l of state.logs) {
    const b = ensureBucket(new Date(l.timestamp));
    b.logs.push(l);
    if (l.kind === "dial") b.totals.dials += l.count;
    else if (l.kind === "prospect-added") b.totals.prospects += l.count;
  }
  // Sort logs inside each bucket most-recent first.
  for (const b of buckets.values()) {
    b.logs.sort((a, b2) => b2.timestamp - a.timestamp);
  }
  return Array.from(buckets.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );
}

// ---- Chart bucketing ----------------------------------------------

export type ChartGranularity = "day" | "week";

export interface ChartBucket {
  label: string;        // "Mon", "Oct 6", ...
  startMs: number;
  endMs: number;
  count: number;        // total for this kind in this bucket
  isCurrent: boolean;   // now falls inside this bucket
}

// Choose day-vs-week bars based on the selected view. Weekly views get
// per-day resolution; quarter and all-time views get per-week resolution.
export function chartGranularityFor(
  kind: ViewPeriodKind,
): ChartGranularity {
  return kind === "this-week" || kind === "last-week" ? "day" : "week";
}

// Groups all logs of a given kind into fixed buckets appropriate for the
// current view period. Buckets always cover the full period even when no
// logs fall into them (empty bars are the "you didn't work that day" signal).
// - Week views: 7 daily buckets.
// - This quarter: every week from the quarter start through now.
// - All time: last 12 weekly buckets ending at the current week.
// - Today: single-day bucket. The dashboard skips rendering the chart in
//   that case, but returning a valid array keeps the function total.
export function bucketLogsForChart(
  logs: GoalLogEntry[],
  period: ViewPeriod,
  kind: GoalMetricKind,
  now: Date = new Date(),
): ChartBucket[] {
  const granularity = chartGranularityFor(period.kind);
  const ranges: { start: Date; end: Date }[] = [];

  if (granularity === "day") {
    if (period.kind === "today") {
      const s = dayStartFor(now);
      const e = dayEndFor(now);
      ranges.push({ start: s, end: e });
    } else {
      // this-week / last-week: 7 buckets starting from period.fromMs
      const start = new Date(period.fromMs);
      for (let i = 0; i < 7; i++) {
        const bStart = new Date(start);
        bStart.setDate(start.getDate() + i);
        bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(bStart);
        bEnd.setHours(23, 59, 59, 999);
        ranges.push({ start: bStart, end: bEnd });
      }
    }
  } else if (period.kind === "this-quarter") {
    // Every week from quarter start through now.
    let cursor = weekStartFor(new Date(period.fromMs));
    const endMs = period.toMs;
    while (cursor.getTime() <= endMs) {
      const s = new Date(cursor);
      const e = weekEndFor(s);
      ranges.push({ start: s, end: e });
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    // all-time / custom (default): last 12 weekly buckets ending at
    // the week containing `now`.
    const currentWeekStart = weekStartFor(now);
    for (let i = 11; i >= 0; i--) {
      const s = new Date(currentWeekStart);
      s.setDate(currentWeekStart.getDate() - i * 7);
      ranges.push({ start: s, end: weekEndFor(s) });
    }
  }

  const nowMs = now.getTime();
  return ranges.map((r) => {
    let count = 0;
    for (const l of logs) {
      if (l.kind !== kind) continue;
      if (l.timestamp >= r.start.getTime() && l.timestamp <= r.end.getTime()) {
        count += l.count;
      }
    }
    const label =
      granularity === "day"
        ? r.start.toLocaleString(undefined, { weekday: "short" })
        : r.start.toLocaleString(undefined, { month: "short", day: "numeric" });
    return {
      label,
      startMs: r.start.getTime(),
      endMs: r.end.getTime(),
      count,
      isCurrent: nowMs >= r.start.getTime() && nowMs <= r.end.getTime(),
    };
  });
}

// ---- View filter periods ------------------------------------------

export type ViewPeriodKind =
  | "today"
  | "this-week"
  | "last-week"
  | "this-quarter"
  | "all-time"
  | "custom";

export interface ViewPeriod {
  kind: ViewPeriodKind;
  fromMs: number;
  toMs: number;
  label: string;
  // How many weeks the range covers, for goal-vs-cumulative math.
  weeks: number;
}

export function resolveViewPeriod(
  kind: ViewPeriodKind,
  now: Date = new Date(),
  custom?: { from: Date; to: Date },
): ViewPeriod {
  switch (kind) {
    case "today": {
      const s = dayStartFor(now);
      const e = dayEndFor(now);
      return {
        kind,
        fromMs: s.getTime(),
        toMs: e.getTime(),
        label: "Today",
        // 1/7 of a week — used to scale the weekly goal into a daily target
        // when the user is filtering to today.
        weeks: 1 / 7,
      };
    }
    case "this-week": {
      const s = weekStartFor(now);
      const e = weekEndFor(now);
      return {
        kind,
        fromMs: s.getTime(),
        toMs: e.getTime(),
        label: "This week",
        weeks: 1,
      };
    }
    case "last-week": {
      const s = weekStartFor(now);
      s.setDate(s.getDate() - 7);
      const e = weekEndFor(s);
      return {
        kind,
        fromMs: s.getTime(),
        toMs: e.getTime(),
        label: "Last week",
        weeks: 1,
      };
    }
    case "this-quarter": {
      const s = quarterStartFor(now);
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      // Weeks so far = ceil((now - quarterStart) / 7d), min 1.
      const diffMs = e.getTime() - s.getTime();
      const weeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
      return {
        kind,
        fromMs: s.getTime(),
        toMs: e.getTime(),
        label: "This quarter",
        weeks,
      };
    }
    case "all-time": {
      return {
        kind,
        fromMs: 0,
        toMs: Number.MAX_SAFE_INTEGER,
        label: "All time",
        weeks: 1,
      };
    }
    case "custom": {
      if (!custom) throw new Error("custom period requires from/to");
      const s = dayStartFor(custom.from);
      const e = dayEndFor(custom.to);
      const diffMs = e.getTime() - s.getTime();
      const weeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
      return {
        kind,
        fromMs: s.getTime(),
        toMs: e.getTime(),
        label: `${formatIsoDate(s)} → ${formatIsoDate(e)}`,
        weeks,
      };
    }
  }
}
