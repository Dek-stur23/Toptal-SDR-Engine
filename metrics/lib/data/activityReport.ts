import type { SupabaseClient } from "@supabase/supabase-js";

// Cross-user usage aggregation for the admin dashboard. Reads
// activity_events for every user in a time window and rolls it up two
// ways: per rep (engagement) and per tool (what's being used).
//
// SERVICE-ROLE ONLY. This bypasses RLS to see all users' rows, so
// callers MUST verify the caller is an admin before invoking it.

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

interface EventRow {
  user_id: string;
  tool: string;
  action: string;
  created_at: string;
}

export async function buildActivityReport(
  service: SupabaseClient,
  fromISO: string,
  toISO: string
): Promise<ActivityReport> {
  const { data, error } = await service
    .from("activity_events")
    .select("user_id, tool, action, created_at")
    .gte("created_at", fromISO)
    .lt("created_at", toISO);
  if (error) throw error;
  const events = (data ?? []) as EventRow[];

  // Resolve display names (profiles) and emails (auth.users, via the
  // admin API) so leadership sees people, not UUIDs.
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

  for (const e of events) {
    const rep =
      repMap.get(e.user_id) ??
      { events: 0, tools: new Set<string>(), days: new Set<string>(), last: e.created_at };
    rep.events += 1;
    rep.tools.add(e.tool);
    rep.days.add(e.created_at.slice(0, 10)); // YYYY-MM-DD
    if (e.created_at > rep.last) rep.last = e.created_at;
    repMap.set(e.user_id, rep);

    const tool = toolMap.get(e.tool) ?? { events: 0, users: new Set<string>() };
    tool.events += 1;
    tool.users.add(e.user_id);
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
    totalEvents: events.length,
    activeUsers: repMap.size,
    topTool: perTool[0]?.tool ?? null,
    perRep,
    perTool,
  };
}
