// Pure helpers for the Goals & Benchmarks dashboard. Ported from the
// parent SDR Launchpad's lib/goals.ts, adapted for the metrics-app
// domain types (string IDs, ISO date strings) — no React, no storage.

import type {
  GoalLogEntry,
  GoalMetricKind,
  Meeting,
  QuarterlyGoals,
  SavedWeek,
} from "./types";

// ---- Small helpers ------------------------------------------------

function toMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

// ---- Date math (Mon-Sun weeks) ------------------------------------

export function weekStartFor(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun ... 6=Sat
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

export function defaultQuarterlyGoals(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Omit<QuarterlyGoals, "id"> {
  return {
    year,
    quarter,
    dailyDialsGoal: 0,
    dailyDialsBenchmark: 0,
    weeklyDialsGoal: 0,
    weeklyDialsBenchmark: 0,
    weeklyProspectsGoal: 0,
    weeklyProspectsBenchmark: 0,
    weeklyMeetingsBookedGoal: 0,
    weeklyMeetingsBookedBenchmark: 0,
    weeklyMeetingsHeldGoal: 0,
    weeklyMeetingsHeldBenchmark: 0,
  };
}

export function findQuarterlyGoals(
  quarterly: QuarterlyGoals[],
  year: number,
  quarter: 1 | 2 | 3 | 4
): QuarterlyGoals | null {
  return quarterly.find((q) => q.year === year && q.quarter === quarter) ?? null;
}

// ---- Locking (saved_weeks logic) ---------------------------------

function findSavedWeek(
  savedWeeks: SavedWeek[],
  weekStartIso: string,
  kind: "unlocked" | "manually-saved"
): SavedWeek | undefined {
  return savedWeeks.find((s) => s.weekStart === weekStartIso && s.kind === kind);
}

export function isWeekLocked(
  savedWeeks: SavedWeek[],
  weekStart: Date,
  now: Date = new Date()
): boolean {
  const currentWeekStart = formatIsoDate(weekStartFor(now));
  const target = formatIsoDate(weekStartFor(weekStart));
  if (findSavedWeek(savedWeeks, target, "unlocked")) return false;
  if (findSavedWeek(savedWeeks, target, "manually-saved")) return true;
  if (target === currentWeekStart) return false;
  if (target > currentWeekStart) return false;
  return true;
}

export function isWeekManuallySaved(
  savedWeeks: SavedWeek[],
  weekStart: Date
): boolean {
  const target = formatIsoDate(weekStartFor(weekStart));
  return !!findSavedWeek(savedWeeks, target, "manually-saved");
}

export function isWeekExplicitlyUnlocked(
  savedWeeks: SavedWeek[],
  weekStart: Date
): boolean {
  const target = formatIsoDate(weekStartFor(weekStart));
  return !!findSavedWeek(savedWeeks, target, "unlocked");
}

// ---- Rollups -------------------------------------------------------

export interface Rollup {
  dials: number;
  prospects: number;
}

export function sumLogsInRange(
  logs: GoalLogEntry[],
  fromMs: number,
  toMs: number
): Rollup {
  let dials = 0;
  let prospects = 0;
  for (const l of logs) {
    const ts = toMs2(l.loggedAt);
    if (ts === null || ts < fromMs || ts > toMs) continue;
    if (l.kind === "dial") dials += l.count;
    else if (l.kind === "prospect-added") prospects += l.count;
  }
  return { dials, prospects };
}

// Local alias so the parameter name `toMs` doesn't shadow the helper.
function toMs2(iso: string): number | null {
  return toMs(iso);
}

// ---- Meeting rollups ----------------------------------------------

export interface MeetingRollup {
  booked: number;
  held: number;
}

export function sumMeetingsInRange(
  meetings: Meeting[],
  fromMs: number,
  toMsArg: number
): MeetingRollup {
  let booked = 0;
  let held = 0;
  for (const m of meetings) {
    const createdMs = toMs(m.createdAt);
    if (createdMs !== null && createdMs >= fromMs && createdMs <= toMsArg) {
      booked++;
    }
    const heldMs = toMs(m.heldAt);
    if (
      m.status === "held" &&
      heldMs !== null &&
      heldMs >= fromMs &&
      heldMs <= toMsArg
    ) {
      held++;
    }
  }
  return { booked, held };
}

// ---- Weekly archive (grouping) -----------------------------------

export interface WeeklyBucket {
  weekStart: Date;
  weekEnd: Date;
  weekStartIso: string;
  totals: Rollup;
  logs: GoalLogEntry[];
  isCurrent: boolean;
}

export function groupLogsByWeek(
  logs: GoalLogEntry[],
  now: Date = new Date()
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
  ensureBucket(now);
  for (const l of logs) {
    const ts = toMs(l.loggedAt);
    if (ts === null) continue;
    const b = ensureBucket(new Date(ts));
    b.logs.push(l);
    if (l.kind === "dial") b.totals.dials += l.count;
    else if (l.kind === "prospect-added") b.totals.prospects += l.count;
  }
  for (const b of buckets.values()) {
    b.logs.sort((a, c) => {
      const ta = toMs(a.loggedAt) ?? 0;
      const tc = toMs(c.loggedAt) ?? 0;
      return tc - ta;
    });
  }
  return Array.from(buckets.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
  );
}

// ---- Chart bucketing ----------------------------------------------

export type ChartGranularity = "day" | "week";

export interface ChartBucket {
  label: string;
  startMs: number;
  endMs: number;
  count: number;
  isCurrent: boolean;
}

export function chartGranularityFor(kind: ViewPeriodKind): ChartGranularity {
  return kind === "this-week" || kind === "last-week" ? "day" : "week";
}

function buildChartRanges(period: ViewPeriod, now: Date): { start: Date; end: Date }[] {
  const granularity = chartGranularityFor(period.kind);
  const ranges: { start: Date; end: Date }[] = [];

  if (granularity === "day") {
    if (period.kind === "today") {
      ranges.push({ start: dayStartFor(now), end: dayEndFor(now) });
    } else {
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
    const currentWeekStart = weekStartFor(now);
    for (let i = 11; i >= 0; i--) {
      const s = new Date(currentWeekStart);
      s.setDate(currentWeekStart.getDate() - i * 7);
      ranges.push({ start: s, end: weekEndFor(s) });
    }
  }
  return ranges;
}

function labelForRange(granularity: ChartGranularity, start: Date): string {
  return granularity === "day"
    ? start.toLocaleString(undefined, { weekday: "short" })
    : start.toLocaleString(undefined, { month: "short", day: "numeric" });
}

export function bucketLogsForChart(
  logs: GoalLogEntry[],
  period: ViewPeriod,
  kind: GoalMetricKind,
  now: Date = new Date()
): ChartBucket[] {
  const granularity = chartGranularityFor(period.kind);
  const ranges = buildChartRanges(period, now);
  const nowMs = now.getTime();
  return ranges.map((r) => {
    let count = 0;
    for (const l of logs) {
      if (l.kind !== kind) continue;
      const ts = toMs(l.loggedAt);
      if (ts !== null && ts >= r.start.getTime() && ts <= r.end.getTime()) {
        count += l.count;
      }
    }
    return {
      label: labelForRange(granularity, r.start),
      startMs: r.start.getTime(),
      endMs: r.end.getTime(),
      count,
      isCurrent: nowMs >= r.start.getTime() && nowMs <= r.end.getTime(),
    };
  });
}

export function bucketMeetingsForChart(
  meetings: Meeting[],
  period: ViewPeriod,
  status: "booked" | "held",
  now: Date = new Date()
): ChartBucket[] {
  const granularity = chartGranularityFor(period.kind);
  const ranges = buildChartRanges(period, now);
  const nowMs = now.getTime();
  return ranges.map((r) => {
    let count = 0;
    for (const m of meetings) {
      let ts: number | null = null;
      if (status === "booked") {
        ts = toMs(m.createdAt);
      } else if (m.status === "held") {
        ts = toMs(m.heldAt);
      }
      if (ts !== null && ts >= r.start.getTime() && ts <= r.end.getTime()) {
        count++;
      }
    }
    return {
      label: labelForRange(granularity, r.start),
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
  weeks: number;
}

export function resolveViewPeriod(
  kind: ViewPeriodKind,
  now: Date = new Date(),
  custom?: { from: Date; to: Date }
): ViewPeriod {
  switch (kind) {
    case "today": {
      const s = dayStartFor(now);
      const e = dayEndFor(now);
      return { kind, fromMs: s.getTime(), toMs: e.getTime(), label: "Today", weeks: 1 / 7 };
    }
    case "this-week": {
      const s = weekStartFor(now);
      const e = weekEndFor(now);
      return { kind, fromMs: s.getTime(), toMs: e.getTime(), label: "This week", weeks: 1 };
    }
    case "last-week": {
      const s = weekStartFor(now);
      s.setDate(s.getDate() - 7);
      const e = weekEndFor(s);
      return { kind, fromMs: s.getTime(), toMs: e.getTime(), label: "Last week", weeks: 1 };
    }
    case "this-quarter": {
      const s = quarterStartFor(now);
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      const diffMs = e.getTime() - s.getTime();
      const weeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
      return { kind, fromMs: s.getTime(), toMs: e.getTime(), label: "This quarter", weeks };
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
