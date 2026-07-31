import type { SupabaseClient } from "@supabase/supabase-js";

// Lightweight, fire-and-forget usage logging for client-side tools.
//
// Some tools (the ZoomInfo → Lusha CSV workflow especially) run entirely
// in the browser and otherwise write nothing to the database, so they
// never appeared in usage reporting. A row in `activity_events` is the
// minimal "user X used tool Y at time T" signal — no prospect data, just
// the tool name, the action, and a timestamp. RLS plus the table's
// user_id default (auth.uid()) scope every row to the caller, so the
// client never sends a user id.
//
// Instrumenting a tool must never break it: this swallows errors instead
// of throwing, and callers should invoke it fire-and-forget (`void
// logActivityEvent(...)`).
export async function logActivityEvent(
  supabase: SupabaseClient,
  event: { tool: string; action: string }
): Promise<void> {
  try {
    const { error } = await supabase
      .from("activity_events")
      .insert({ tool: event.tool, action: event.action });
    if (error) {
      console.warn("activity_events insert failed:", error.message);
    }
  } catch (e) {
    console.warn("activity_events insert threw:", e);
  }
}
