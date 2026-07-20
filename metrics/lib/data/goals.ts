import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GoalLogEntry,
  GoalMetricKind,
  QuarterlyGoals,
  SavedWeek,
  SavedWeekKind,
} from "@/lib/types";

// ---------- quarterly_goals ----------

interface QuarterlyGoalsRow {
  id: string;
  year: number;
  quarter: number;
  daily_dials_goal: number;
  daily_dials_benchmark: number;
  weekly_dials_goal: number;
  weekly_dials_benchmark: number;
  weekly_prospects_goal: number;
  weekly_prospects_benchmark: number;
  weekly_meetings_booked_goal: number;
  weekly_meetings_booked_benchmark: number;
  weekly_meetings_held_goal: number;
  weekly_meetings_held_benchmark: number;
}

function toQuarterlyGoals(row: QuarterlyGoalsRow): QuarterlyGoals {
  return {
    id: row.id,
    year: row.year,
    quarter: row.quarter as 1 | 2 | 3 | 4,
    dailyDialsGoal: row.daily_dials_goal,
    dailyDialsBenchmark: row.daily_dials_benchmark,
    weeklyDialsGoal: row.weekly_dials_goal,
    weeklyDialsBenchmark: row.weekly_dials_benchmark,
    weeklyProspectsGoal: row.weekly_prospects_goal,
    weeklyProspectsBenchmark: row.weekly_prospects_benchmark,
    weeklyMeetingsBookedGoal: row.weekly_meetings_booked_goal,
    weeklyMeetingsBookedBenchmark: row.weekly_meetings_booked_benchmark,
    weeklyMeetingsHeldGoal: row.weekly_meetings_held_goal,
    weeklyMeetingsHeldBenchmark: row.weekly_meetings_held_benchmark,
  };
}

const QUARTERLY_COLS =
  "id, year, quarter, daily_dials_goal, daily_dials_benchmark, weekly_dials_goal, weekly_dials_benchmark, weekly_prospects_goal, weekly_prospects_benchmark, weekly_meetings_booked_goal, weekly_meetings_booked_benchmark, weekly_meetings_held_goal, weekly_meetings_held_benchmark";

export async function listQuarterlyGoals(
  supabase: SupabaseClient
): Promise<QuarterlyGoals[]> {
  const { data, error } = await supabase
    .from("quarterly_goals")
    .select(QUARTERLY_COLS)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });
  if (error) throw error;
  return (data as QuarterlyGoalsRow[]).map(toQuarterlyGoals);
}

// Upsert a per-quarter row. (user_id, year, quarter) is unique, so
// the on-conflict clause reads that composite. `updated_at` is written
// by the DB default; we bump it explicitly on updates.
export async function upsertQuarterlyGoals(
  supabase: SupabaseClient,
  goals: Omit<QuarterlyGoals, "id">
): Promise<QuarterlyGoals> {
  const { data, error } = await supabase
    .from("quarterly_goals")
    .upsert(
      {
        year: goals.year,
        quarter: goals.quarter,
        daily_dials_goal: goals.dailyDialsGoal,
        daily_dials_benchmark: goals.dailyDialsBenchmark,
        weekly_dials_goal: goals.weeklyDialsGoal,
        weekly_dials_benchmark: goals.weeklyDialsBenchmark,
        weekly_prospects_goal: goals.weeklyProspectsGoal,
        weekly_prospects_benchmark: goals.weeklyProspectsBenchmark,
        weekly_meetings_booked_goal: goals.weeklyMeetingsBookedGoal,
        weekly_meetings_booked_benchmark: goals.weeklyMeetingsBookedBenchmark,
        weekly_meetings_held_goal: goals.weeklyMeetingsHeldGoal,
        weekly_meetings_held_benchmark: goals.weeklyMeetingsHeldBenchmark,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,quarter" }
    )
    .select(QUARTERLY_COLS)
    .single();
  if (error) throw error;
  return toQuarterlyGoals(data as QuarterlyGoalsRow);
}

// ---------- goal_logs ----------

interface GoalLogRow {
  id: string;
  kind: string;
  logged_at: string;
  count: number;
  note: string | null;
  account_id: string | null;
}

function toGoalLog(row: GoalLogRow): GoalLogEntry {
  return {
    id: row.id,
    kind: row.kind as GoalMetricKind,
    loggedAt: row.logged_at,
    count: row.count,
    note: row.note,
    accountId: row.account_id,
  };
}

const LOG_COLS = "id, kind, logged_at, count, note, account_id";

// Full log fetch. The UI currently keeps all logs in memory for chart
// rendering; if that gets too large later we'll switch to date-window
// queries.
export async function listGoalLogs(
  supabase: SupabaseClient
): Promise<GoalLogEntry[]> {
  const { data, error } = await supabase
    .from("goal_logs")
    .select(LOG_COLS)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return (data as GoalLogRow[]).map(toGoalLog);
}

export async function insertGoalLog(
  supabase: SupabaseClient,
  entry: Omit<GoalLogEntry, "id">
): Promise<GoalLogEntry> {
  const { data, error } = await supabase
    .from("goal_logs")
    .insert({
      kind: entry.kind,
      logged_at: entry.loggedAt,
      count: entry.count,
      note: entry.note,
      account_id: entry.accountId,
    })
    .select(LOG_COLS)
    .single();
  if (error) throw error;
  return toGoalLog(data as GoalLogRow);
}

export async function deleteGoalLog(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("goal_logs").delete().eq("id", id);
  if (error) throw error;
}

// ---------- saved_weeks ----------

interface SavedWeekRow {
  id: string;
  week_start: string;
  kind: string;
}

function toSavedWeek(row: SavedWeekRow): SavedWeek {
  return {
    id: row.id,
    weekStart: row.week_start,
    kind: row.kind as SavedWeekKind,
  };
}

export async function listSavedWeeks(
  supabase: SupabaseClient
): Promise<SavedWeek[]> {
  const { data, error } = await supabase
    .from("saved_weeks")
    .select("id, week_start, kind")
    .order("week_start", { ascending: false });
  if (error) throw error;
  return (data as SavedWeekRow[]).map(toSavedWeek);
}

// Upsert-style: adds a saved-week row if it doesn't exist, no-ops if
// it does. The DB unique constraint is (user_id, week_start, kind).
export async function markSavedWeek(
  supabase: SupabaseClient,
  weekStart: string,
  kind: SavedWeekKind
): Promise<void> {
  const { error } = await supabase
    .from("saved_weeks")
    .upsert(
      { week_start: weekStart, kind },
      { onConflict: "user_id,week_start,kind", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function clearSavedWeek(
  supabase: SupabaseClient,
  weekStart: string,
  kind: SavedWeekKind
): Promise<void> {
  const { error } = await supabase
    .from("saved_weeks")
    .delete()
    .eq("week_start", weekStart)
    .eq("kind", kind);
  if (error) throw error;
}
