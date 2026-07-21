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

export async function deleteEse(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("eses").delete().eq("id", id);
  if (error) throw error;
}
