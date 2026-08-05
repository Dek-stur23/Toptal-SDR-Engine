import type { SupabaseClient } from "@supabase/supabase-js";

export interface Ese {
  id: string;
  name: string;
  createdAt: string;
}

interface Row {
  id: string;
  name: string;
  created_at: string;
}

function toEse(row: Row): Ese {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function listEses(supabase: SupabaseClient): Promise<Ese[]> {
  const { data, error } = await supabase
    .from("eses")
    .select("id, name, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toEse);
}

export async function createEse(
  supabase: SupabaseClient,
  name: string
): Promise<Ese> {
  const { data, error } = await supabase
    .from("eses")
    .insert({ name: name.trim() })
    .select("id, name, created_at")
    .single();
  if (error) throw error;
  return toEse(data as Row);
}

// Bulk insert with case-insensitive dedup against existing rows and
// within the input — mirrors bulkCreateAccounts. Used by the CSV
// importer so an ESE column populates the ESE list, not just each
// meeting's ese field. Returns only the rows created.
export async function bulkCreateEses(
  supabase: SupabaseClient,
  names: string[]
): Promise<{ created: Ese[]; skipped: string[] }> {
  const cleaned = Array.from(
    new Map(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n])
    ).values()
  );
  if (cleaned.length === 0) return { created: [], skipped: [] };

  const existing = await listEses(supabase);
  const existingLower = new Set(existing.map((e) => e.name.toLowerCase()));

  const fresh: string[] = [];
  const skipped: string[] = [];
  for (const n of cleaned) {
    if (existingLower.has(n.toLowerCase())) skipped.push(n);
    else fresh.push(n);
  }
  if (fresh.length === 0) return { created: [], skipped };

  const { data, error } = await supabase
    .from("eses")
    .insert(fresh.map((name) => ({ name })))
    .select("id, name, created_at");
  if (error) throw error;
  return { created: (data as Row[]).map(toEse), skipped };
}

export async function deleteEse(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("eses").delete().eq("id", id);
  if (error) throw error;
}
