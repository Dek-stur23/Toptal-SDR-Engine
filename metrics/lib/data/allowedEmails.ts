import type { SupabaseClient } from "@supabase/supabase-js";

export interface AllowedEmail {
  id: string;
  email: string;
  addedBy: string | null;
  addedAt: string;
}

interface Row {
  id: string;
  email: string;
  added_by: string | null;
  added_at: string;
}

function toEntry(row: Row): AllowedEmail {
  return {
    id: row.id,
    email: row.email,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

// Anyone (signed in or not) can read the list — the invite-gate
// trigger needs it. Ordered newest-first for the admin page.
export async function listAllowedEmails(
  supabase: SupabaseClient
): Promise<AllowedEmail[]> {
  const { data, error } = await supabase
    .from("allowed_emails")
    .select("id, email, added_by, added_at")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toEntry);
}

// Admin-only. RLS enforces this at the DB level; the app just needs
// the callable.
export async function addAllowedEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AllowedEmail> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("allowed_emails")
    .insert({ email: email.trim().toLowerCase(), added_by: user?.id ?? null })
    .select("id, email, added_by, added_at")
    .single();
  if (error) throw error;
  return toEntry(data as Row);
}

export async function removeAllowedEmail(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("allowed_emails").delete().eq("id", id);
  if (error) throw error;
}
