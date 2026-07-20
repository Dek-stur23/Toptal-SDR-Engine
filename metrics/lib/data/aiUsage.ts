import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiUsageEntry } from "@/lib/types";

interface AiUsageRow {
  id: string;
  endpoint: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_cents: number;
  created_at: string;
}

function toAiUsage(row: AiUsageRow): AiUsageEntry {
  return {
    id: row.id,
    endpoint: row.endpoint as "autofill",
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    estimatedCostCents: row.estimated_cost_cents,
    createdAt: row.created_at,
  };
}

// Reads the calling user's current-calendar-month spend in cents. Uses
// the anon-scoped client so RLS filters to the caller automatically.
export async function getMyMonthSpendCents(
  supabase: SupabaseClient
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data, error } = await supabase
    .from("ai_usage")
    .select("estimated_cost_cents")
    .gte("created_at", monthStart.toISOString());
  if (error) throw error;
  return (data as { estimated_cost_cents: number }[]).reduce(
    (acc, r) => acc + r.estimated_cost_cents,
    0
  );
}

// Server-only. Uses whichever client is passed — normally the
// service-role client (bypasses RLS so the server can insert on behalf
// of a user without impersonating them).
export async function insertAiUsage(
  supabase: SupabaseClient,
  entry: {
    userId: string;
    endpoint: "autofill";
    tokensIn: number;
    tokensOut: number;
    estimatedCostCents: number;
  }
): Promise<AiUsageEntry> {
  const { data, error } = await supabase
    .from("ai_usage")
    .insert({
      user_id: entry.userId,
      endpoint: entry.endpoint,
      tokens_in: entry.tokensIn,
      tokens_out: entry.tokensOut,
      estimated_cost_cents: entry.estimatedCostCents,
    })
    .select("id, endpoint, tokens_in, tokens_out, estimated_cost_cents, created_at")
    .single();
  if (error) throw error;
  return toAiUsage(data as AiUsageRow);
}
