import type { SupabaseClient } from "@supabase/supabase-js";

// Cross-user usage aggregation for the admin dashboard. Rolls activity
// up two ways: per rep (engagement) and per tool (what's being used).
//
// Sources are BLENDED so the dashboard reflects the whole team, not just
// whoever has generated activity_events rows:
//   1. activity_events — page-view + client-tool events (carries its own
//      tool labels). Only accrues from when the tracker went live.
//   2. Derived product activity — one synthetic event per row in the
//      core tables (meetings, goal_logs, ai_usage, …), which gives full
//      history and every rep who has ever used the product.
//
// SERVICE-ROLE ONLY. This bypasses RLS to see all users' rows, so the
// caller MUST verify the caller is an admin before invoking it.

export interface PerRep {
  userId: string;
  name: string;
  email: string;
  events: number;
  toolsUsed: string[]; // distinct tool labels, sorted
  activeDays: number; // distinct calendar days with activity
  lastActive: string; // ISO
}

export interface PerTool {
  tool: string;
  events: number;
  users: number; // distinct users who touched it
}

export interface ActivityReport {
  fromISO: string;
  toISO: string;
  totalEvents: number;
  activeUsers: number;
  topTool: string | null;
  perRep: PerRep[];
  perTool: PerTool[];
}

interface Activity {
  userId: string;
  tool: string;
  at: string; // ISO
}

// Internal admin navigation is not "platform usage" — an admin loading
// the Usage or Invites pages shouldn't inflate the report or show up as a
// top tool. Events whose tool label is an Admin surface are dropped from
// every rollup (per-rep, per-tool, totals, active users).
function isInternalTool(tool: string): boolean {
  return tool === "Admin" || tool.startsWith("Admin:");
}

// Product tables that carry a per-user timestamp, mapped to the tool
// label their activity should count toward. (meeting_updates /
// opportunity_updates are omitted — their parent rows already count, and
// they'd need a join for user_id.)
const DERIVED_SOURCES: { table: string; ts: string; tool: string }[] = [
  { table: "goal_logs", ts: "logged_at", tool: "Goals & Metrics" },
  { table: "saved_weeks", ts: "created_at", tool: "Goals & Metrics" },
  { table: "quarterly_goals", ts: "updated_at", tool: "Goals & Metrics" },
  { table: "meetings", ts: "created_at", tool: "Meetings Tracker" },
  { table: "opportunities", ts: "updated_at", tool: "Opportunities" },
  { table: "accounts", ts: "created_at", tool: "Accounts" },
  { table: "eses", ts: "created_at", tool: "Accounts" },
  { table: "ai_usage", ts: "created_at", tool: "AI Autofill" },
];

// Page through a table in 1000-row batches so counts stay accurate even
// for high-volume sources (e.g. goal_logs) over long windows.
async function fetchPaged(
  service: SupabaseClient,
  table: string,
  cols: string,
  tsCol: string,
  fromISO: string,
  toISO: string
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  let offset = 0;
  const rows: Record<string, unknown>[] = [];
  for (;;) {
    const { data, error } = await service
      .from(table)
      .select(cols)
      .gte(tsCol, fromISO)
      .lt(tsCol, toISO)
      .order(tsCol, { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function buildActivityReport(
  service: SupabaseClient,
  fromISO: string,
  toISO: string
): Promise<ActivityReport> {
  // activity_events carries its own tool labels.
  const eventsPromise = fetchPaged(
    service,
    "activity_events",
    "user_id, tool, created_at",
    "created_at",
    fromISO,
    toISO
  )
    .then((rows) =>
      rows.map((r) => ({
        userId: r.user_id as string,
        tool: r.tool as string,
        at: r.created_at as string,
      }))
    )
    .catch(() => [] as Activity[]);

  // Each derived source contributes one synthetic event per row. A
  // missing table (e.g. a fresh replica) is skipped, not fatal.
  const derivedPromise = Promise.all(
    DERIVED_SOURCES.map(async (src) => {
      try {
        const rows = await fetchPaged(
          service,
          src.table,
          `user_id, ${src.ts}`,
          src.ts,
          fromISO,
          toISO
        );
        return rows.map((r) => ({
          userId: r.user_id as string,
          tool: src.tool,
          at: r[src.ts] as string,
        }));
      } catch {
        return [] as Activity[];
      }
    })
  ).then((groups) => groups.flat());

  const [events, derived] = await Promise.all([eventsPromise, derivedPromise]);
  const all: Activity[] = [...events, ...derived].filter(
    (a) => a.userId && a.at && !isInternalTool(a.tool)
  );

  // Resolve display names (profiles) and emails (auth admin API) so
  // leadership sees people, not UUIDs.
  const [profilesRes, usersRes] = await Promise.all([
    service.from("profiles").select("id, display_name"),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as {
    id: string;
    display_name: string | null;
  }[]) {
    if (p.display_name) nameById.set(p.id, p.display_name);
  }
  const emailById = new Map<string, string>();
  for (const u of usersRes.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  const repMap = new Map<
    string,
    { events: number; tools: Set<string>; days: Set<string>; last: string }
  >();
  const toolMap = new Map<string, { events: number; users: Set<string> }>();

  for (const e of all) {
    const rep =
      repMap.get(e.userId) ??
      { events: 0, tools: new Set<string>(), days: new Set<string>(), last: e.at };
    rep.events += 1;
    rep.tools.add(e.tool);
    rep.days.add(e.at.slice(0, 10)); // YYYY-MM-DD
    if (e.at > rep.last) rep.last = e.at;
    repMap.set(e.userId, rep);

    const tool = toolMap.get(e.tool) ?? { events: 0, users: new Set<string>() };
    tool.events += 1;
    tool.users.add(e.userId);
    toolMap.set(e.tool, tool);
  }

  const perRep: PerRep[] = [...repMap.entries()]
    .map(([userId, v]) => ({
      userId,
      name: nameById.get(userId) ?? emailById.get(userId) ?? "Unknown user",
      email: emailById.get(userId) ?? "",
      events: v.events,
      toolsUsed: [...v.tools].sort(),
      activeDays: v.days.size,
      lastActive: v.last,
    }))
    .sort((a, b) => b.events - a.events);

  const perTool: PerTool[] = [...toolMap.entries()]
    .map(([tool, v]) => ({ tool, events: v.events, users: v.users.size }))
    .sort((a, b) => b.events - a.events);

  return {
    fromISO,
    toISO,
    totalEvents: all.length,
    activeUsers: repMap.size,
    topTool: perTool[0]?.tool ?? null,
    perRep,
    perTool,
  };
}
