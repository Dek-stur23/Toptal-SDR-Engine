import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "@/lib/types";

interface AccountRow {
  id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function listAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, is_archived, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as AccountRow[]).map(toAccount);
}

export async function createAccount(
  supabase: SupabaseClient,
  name: string
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ name })
    .select("id, name, is_archived, created_at")
    .single();
  if (error) throw error;
  return toAccount(data as AccountRow);
}

// Bulk insert with case-insensitive dedup against existing rows and
// within the input. Returns the created rows only (skips duplicates
// silently — the caller decides how to surface that count).
export async function bulkCreateAccounts(
  supabase: SupabaseClient,
  names: string[]
): Promise<{ created: Account[]; skipped: string[] }> {
  const cleaned = Array.from(
    new Map(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n])
    ).values()
  );
  if (cleaned.length === 0) return { created: [], skipped: [] };

  const existing = await listAccounts(supabase);
  const existingLower = new Set(existing.map((a) => a.name.toLowerCase()));

  const fresh: string[] = [];
  const skipped: string[] = [];
  for (const n of cleaned) {
    if (existingLower.has(n.toLowerCase())) skipped.push(n);
    else fresh.push(n);
  }
  if (fresh.length === 0) return { created: [], skipped };

  const { data, error } = await supabase
    .from("accounts")
    .insert(fresh.map((name) => ({ name })))
    .select("id, name, is_archived, created_at");
  if (error) throw error;
  return { created: (data as AccountRow[]).map(toAccount), skipped };
}

export async function renameAccount(
  supabase: SupabaseClient,
  id: string,
  name: string
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

export async function setAccountArchived(
  supabase: SupabaseClient,
  id: string,
  isArchived: boolean
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: isArchived })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccount(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}
