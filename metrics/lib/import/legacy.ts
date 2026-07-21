// One-shot import from the parent SDR Launchpad's exported JSON.
//
// The export envelope shape is { app: "toptal-sdr-engine", version,
// exportedAt, state } where `state` is the full AppState from the
// personal tool. We only pull out what the metrics app cares about:
// accounts, meetings, meeting updates, goal logs, quarterly goals,
// and saved-week markers. Everything else in the export (per-account
// engines, hotlist, images, etc.) is ignored.

import type { SupabaseClient } from "@supabase/supabase-js";

// ---- Legacy export shape (subset) ---------------------------------

interface LegacyMeetingUpdate {
  id?: unknown;
  timestamp?: number;
  text?: string;
  system?: boolean;
}

interface LegacyMeeting {
  id?: unknown;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;
  accountId?: string;
  scheduledFor?: string;
  notes?: string;
  status?: string;
  createdAt?: number;
  heldAt?: number;
  deadEndedAt?: number;
  prospectResponse?: string;
  ese?: string;
  heldOutcome?: string;
  bookedCategory?: string;
  updates?: LegacyMeetingUpdate[];
}

interface LegacyAccount {
  id?: unknown;
  name?: string;
  isArchived?: boolean;
  accountData?: { companyName?: string };
}

interface LegacyGoalLog {
  id?: unknown;
  kind?: string;
  timestamp?: number;
  count?: number;
  note?: string;
  accountId?: string;
}

interface LegacyQuarterlyGoals {
  year?: number;
  quarter?: number;
  dailyDialsGoal?: number;
  dailyDialsBenchmark?: number;
  weeklyDialsGoal?: number;
  weeklyDialsBenchmark?: number;
  weeklyProspectsGoal?: number;
  weeklyProspectsBenchmark?: number;
  weeklyMeetingsBookedGoal?: number;
  weeklyMeetingsBookedBenchmark?: number;
  weeklyMeetingsHeldGoal?: number;
  weeklyMeetingsHeldBenchmark?: number;
}

interface LegacyGoalsState {
  quarterly?: LegacyQuarterlyGoals[];
  logs?: LegacyGoalLog[];
  unlockedWeekStarts?: string[];
  manuallySavedWeekStarts?: string[];
}

interface LegacyAppState {
  accounts?: LegacyAccount[];
  meetings?: LegacyMeeting[];
  goals?: LegacyGoalsState;
}

// ---- Parse ----

function unwrap(raw: unknown): LegacyAppState {
  if (!raw || typeof raw !== "object") {
    throw new Error("File is not a valid JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (
    obj.app === "toptal-sdr-engine" &&
    typeof obj.version === "number" &&
    obj.state &&
    typeof obj.state === "object"
  ) {
    return obj.state as LegacyAppState;
  }
  if (Array.isArray((obj as LegacyAppState).accounts)) {
    return obj as LegacyAppState;
  }
  throw new Error(
    "File doesn't look like a Toptal SDR Engine export. Expected an envelope with { app, version, state } or a bare state with an accounts array."
  );
}

// ---- Small helpers ----

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isoOrNull = (ms: unknown): string | null =>
  isNum(ms) ? new Date(ms).toISOString() : null;

const KNOWN_STATUSES = new Set(["booked", "held", "dead-end"]);
const KNOWN_RESPONSES = new Set([
  "no-response",
  "accepted",
  "declined",
  "no-show",
  "rescheduled",
  "still-scheduling",
]);
const KNOWN_HELD_OUTCOMES = new Set([
  "opportunity-identified",
  "future-follow-up",
  "dead-end",
]);
const KNOWN_BOOKED_CATEGORIES = new Set(["confirmed", "soft"]);

// ---- Summary + Import ----

export interface ImportSummary {
  accounts: number;
  meetings: number;
  meetingUpdates: number;
  goalLogs: number;
  quarterlyGoals: number;
  savedWeeks: number;
  skipped: {
    accountsWithoutName: number;
    meetingsWithoutContact: number;
    goalLogsWithoutKind: number;
  };
}

// Runs the import. Everything the caller can see under RLS gets
// written to the DB; there is no dry-run. `abort` may be checked
// between phases to bail early if the caller sets it.
export async function importFromLegacyExport(
  supabase: SupabaseClient,
  json: string
): Promise<ImportSummary> {
  const parsed = unwrap(JSON.parse(json));

  const summary: ImportSummary = {
    accounts: 0,
    meetings: 0,
    meetingUpdates: 0,
    goalLogs: 0,
    quarterlyGoals: 0,
    savedWeeks: 0,
    skipped: {
      accountsWithoutName: 0,
      meetingsWithoutContact: 0,
      goalLogsWithoutKind: 0,
    },
  };

  // ---- Accounts (map legacy id -> new uuid) ----
  const legacyToNewAccountId = new Map<string, string>();

  const existingAccounts = await supabase
    .from("accounts")
    .select("id, name")
    .then((r) => {
      if (r.error) throw r.error;
      return (r.data ?? []) as { id: string; name: string }[];
    });
  const existingByLower = new Map<string, string>();
  for (const a of existingAccounts) existingByLower.set(a.name.toLowerCase(), a.id);

  const accountsToInsert: { legacyId: string | null; name: string }[] = [];
  for (const a of parsed.accounts ?? []) {
    const name = (a.name || a.accountData?.companyName || "").trim();
    if (!name) {
      summary.skipped.accountsWithoutName++;
      continue;
    }
    const legacyId = a.id == null ? null : String(a.id);
    const existing = existingByLower.get(name.toLowerCase());
    if (existing) {
      if (legacyId) legacyToNewAccountId.set(legacyId, existing);
      continue;
    }
    accountsToInsert.push({ legacyId, name });
  }
  if (accountsToInsert.length > 0) {
    const { data, error } = await supabase
      .from("accounts")
      .insert(accountsToInsert.map((a) => ({ name: a.name })))
      .select("id, name");
    if (error) throw error;
    const inserted = (data ?? []) as { id: string; name: string }[];
    // Match inserted rows back to the pre-insert order by name+index.
    // supabase-js preserves order for a bulk insert, so we can zip.
    for (let i = 0; i < accountsToInsert.length; i++) {
      const legacy = accountsToInsert[i];
      const row = inserted[i];
      if (!row) continue;
      if (legacy.legacyId) legacyToNewAccountId.set(legacy.legacyId, row.id);
      existingByLower.set(row.name.toLowerCase(), row.id);
    }
    summary.accounts = inserted.length;
  }

  const resolveAccountId = (legacy: unknown): string | null => {
    if (legacy == null) return null;
    const key = String(legacy);
    return legacyToNewAccountId.get(key) ?? null;
  };

  // ---- Meetings + their updates ----
  const meetingsIn = parsed.meetings ?? [];
  const legacyToNewMeetingId = new Map<string, string>();

  const meetingRows = meetingsIn
    .map((m) => {
      const first = (m.firstName ?? "").trim();
      const last = (m.lastName ?? "").trim();
      const title = (m.title ?? "").trim();
      const linkedin = (m.linkedinUrl ?? "").trim();
      if (!first && !last && !title && !linkedin) {
        summary.skipped.meetingsWithoutContact++;
        return null;
      }
      return {
        legacyId: m.id == null ? null : String(m.id),
        row: {
          first_name: first,
          last_name: last,
          title,
          linkedin_url: linkedin,
          account_id: resolveAccountId(m.accountId),
          scheduled_for:
            isStr(m.scheduledFor) && m.scheduledFor
              ? new Date(m.scheduledFor).toISOString()
              : null,
          notes: (m.notes ?? "").toString(),
          status:
            isStr(m.status) && KNOWN_STATUSES.has(m.status) ? m.status : "booked",
          created_at: isoOrNull(m.createdAt) ?? new Date().toISOString(),
          held_at: isoOrNull(m.heldAt),
          dead_ended_at: isoOrNull(m.deadEndedAt),
          image_key: null, // legacy images live in IndexedDB — not migrated
          prospect_response:
            isStr(m.prospectResponse) && KNOWN_RESPONSES.has(m.prospectResponse)
              ? m.prospectResponse
              : null,
          ese: isStr(m.ese) && m.ese ? m.ese : null,
          held_outcome:
            isStr(m.heldOutcome) && KNOWN_HELD_OUTCOMES.has(m.heldOutcome)
              ? m.heldOutcome
              : null,
          booked_category:
            isStr(m.bookedCategory) && KNOWN_BOOKED_CATEGORIES.has(m.bookedCategory)
              ? m.bookedCategory
              : null,
        },
        updates: m.updates ?? [],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (meetingRows.length > 0) {
    // Insert in batches of 500 so a very large history doesn't blow
    // the request size.
    const BATCH = 500;
    for (let i = 0; i < meetingRows.length; i += BATCH) {
      const slice = meetingRows.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("meetings")
        .insert(slice.map((s) => s.row))
        .select("id");
      if (error) throw error;
      const inserted = (data ?? []) as { id: string }[];
      for (let j = 0; j < slice.length; j++) {
        const s = slice[j];
        const row = inserted[j];
        if (row && s.legacyId) legacyToNewMeetingId.set(s.legacyId, row.id);
        if (row) summary.meetings++;
      }
    }

    // ---- Meeting updates (need the new meeting IDs) ----
    const updateRows: {
      meeting_id: string;
      logged_at: string;
      text: string;
      is_system: boolean;
    }[] = [];
    for (const s of meetingRows) {
      if (!s.legacyId) continue;
      const newId = legacyToNewMeetingId.get(s.legacyId);
      if (!newId) continue;
      for (const u of s.updates) {
        if (!isStr(u.text) || !u.text.trim()) continue;
        updateRows.push({
          meeting_id: newId,
          logged_at: isoOrNull(u.timestamp) ?? new Date().toISOString(),
          text: u.text,
          is_system: !!u.system,
        });
      }
    }
    if (updateRows.length > 0) {
      for (let i = 0; i < updateRows.length; i += BATCH) {
        const { error } = await supabase
          .from("meeting_updates")
          .insert(updateRows.slice(i, i + BATCH));
        if (error) throw error;
      }
      summary.meetingUpdates = updateRows.length;
    }
  }

  // ---- Goal logs ----
  const legacyLogs = parsed.goals?.logs ?? [];
  const logRows = legacyLogs
    .map((l) => {
      const kind = l.kind;
      if (kind !== "dial" && kind !== "prospect-added") {
        summary.skipped.goalLogsWithoutKind++;
        return null;
      }
      const count = isNum(l.count) && l.count >= 1 ? Math.floor(l.count) : 1;
      return {
        kind,
        logged_at: isoOrNull(l.timestamp) ?? new Date().toISOString(),
        count,
        note: isStr(l.note) && l.note ? l.note : null,
        account_id: resolveAccountId(l.accountId),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (logRows.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < logRows.length; i += BATCH) {
      const { error } = await supabase
        .from("goal_logs")
        .insert(logRows.slice(i, i + BATCH));
      if (error) throw error;
    }
    summary.goalLogs = logRows.length;
  }

  // ---- Quarterly goals ----
  const legacyQuarterly = parsed.goals?.quarterly ?? [];
  const quarterlyRows = legacyQuarterly
    .filter((q) => isNum(q.year) && isNum(q.quarter))
    .map((q) => ({
      year: q.year!,
      quarter: q.quarter!,
      daily_dials_goal: q.dailyDialsGoal ?? 0,
      daily_dials_benchmark: q.dailyDialsBenchmark ?? 0,
      weekly_dials_goal: q.weeklyDialsGoal ?? 0,
      weekly_dials_benchmark: q.weeklyDialsBenchmark ?? 0,
      weekly_prospects_goal: q.weeklyProspectsGoal ?? 0,
      weekly_prospects_benchmark: q.weeklyProspectsBenchmark ?? 0,
      weekly_meetings_booked_goal: q.weeklyMeetingsBookedGoal ?? 0,
      weekly_meetings_booked_benchmark: q.weeklyMeetingsBookedBenchmark ?? 0,
      weekly_meetings_held_goal: q.weeklyMeetingsHeldGoal ?? 0,
      weekly_meetings_held_benchmark: q.weeklyMeetingsHeldBenchmark ?? 0,
      updated_at: new Date().toISOString(),
    }));
  if (quarterlyRows.length > 0) {
    const { error } = await supabase
      .from("quarterly_goals")
      .upsert(quarterlyRows, { onConflict: "user_id,year,quarter" });
    if (error) throw error;
    summary.quarterlyGoals = quarterlyRows.length;
  }

  // ---- Saved weeks ----
  const unlocked = (parsed.goals?.unlockedWeekStarts ?? []).filter(isStr);
  const savedManually = (parsed.goals?.manuallySavedWeekStarts ?? []).filter(isStr);
  const weekRows = [
    ...unlocked.map((w) => ({ week_start: w, kind: "unlocked" as const })),
    ...savedManually.map((w) => ({
      week_start: w,
      kind: "manually-saved" as const,
    })),
  ];
  if (weekRows.length > 0) {
    const { error } = await supabase
      .from("saved_weeks")
      .upsert(weekRows, {
        onConflict: "user_id,week_start,kind",
        ignoreDuplicates: true,
      });
    if (error) throw error;
    summary.savedWeeks = weekRows.length;
  }

  return summary;
}
