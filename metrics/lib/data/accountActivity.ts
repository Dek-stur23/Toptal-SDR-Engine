import type { SupabaseClient } from "@supabase/supabase-js";

// One stored row per (account, prospect, day). See migration 011.
export interface AccountActivityRow {
  id: string;
  accountId: string;
  prospectKey: string;
  prospectName: string;
  activityDate: string; // YYYY-MM-DD
  dials: number;
  connects: number;
  meetingsBooked: number;
}

interface Row {
  id: string;
  account_id: string;
  prospect_key: string;
  prospect_name: string;
  activity_date: string;
  dials: number;
  connects: number;
  meetings_booked: number;
}

const COLS =
  "id, account_id, prospect_key, prospect_name, activity_date, dials, connects, meetings_booked";

function toRow(r: Row): AccountActivityRow {
  return {
    id: r.id,
    accountId: r.account_id,
    prospectKey: r.prospect_key,
    prospectName: r.prospect_name,
    activityDate: r.activity_date,
    dials: r.dials,
    connects: r.connects,
    meetingsBooked: r.meetings_booked,
  };
}

// Fetch activity rows in an inclusive [fromDate, toDate] window (or all
// rows if the bounds are omitted). RLS scopes to the caller.
export async function listAccountActivity(
  supabase: SupabaseClient,
  range?: { fromDate?: string; toDate?: string }
): Promise<AccountActivityRow[]> {
  let q = supabase.from("account_activity").select(COLS);
  if (range?.fromDate) q = q.gte("activity_date", range.fromDate);
  if (range?.toDate) q = q.lte("activity_date", range.toDate);
  const { data, error } = await q.order("activity_date", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toRow);
}

// Delete the caller's rows whose activity_date falls in [fromDate,
// toDate]. Used to make a re-import of the same period idempotent
// (replace-by-range) rather than double-counting.
export async function deleteAccountActivityInRange(
  supabase: SupabaseClient,
  fromDate: string,
  toDate: string
): Promise<void> {
  const { error } = await supabase
    .from("account_activity")
    .delete()
    .gte("activity_date", fromDate)
    .lte("activity_date", toDate);
  if (error) throw error;
}

export interface AccountActivityInsert {
  accountId: string;
  prospectKey: string;
  prospectName: string;
  activityDate: string;
  dials: number;
  connects: number;
  meetingsBooked: number;
}

export async function bulkInsertAccountActivity(
  supabase: SupabaseClient,
  rows: AccountActivityInsert[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const CHUNK = 400;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      account_id: r.accountId,
      prospect_key: r.prospectKey,
      prospect_name: r.prospectName,
      activity_date: r.activityDate,
      dials: r.dials,
      connects: r.connects,
      meetings_booked: r.meetingsBooked,
    }));
    const { data, error } = await supabase
      .from("account_activity")
      .insert(chunk)
      .select("id");
    if (error) throw error;
    inserted += (data as { id: string }[]).length;
  }
  return inserted;
}
