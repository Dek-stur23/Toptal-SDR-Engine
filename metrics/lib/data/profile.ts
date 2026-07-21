import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface ProfileRow {
  id: string;
  display_name: string | null;
  is_admin: boolean;
  onboarded_at: string | null;
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
  };
}

const COLS = "id, display_name, is_admin, onboarded_at, created_at";

// Reads the current user's profile row. Returns null if the row
// hasn't been created yet — the auth.users trigger creates it on
// signup, so this should only happen for accounts made before the
// trigger existed. Callers can create one on demand if so.
export async function getMyProfile(
  supabase: SupabaseClient
): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(COLS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

export async function updateMyProfile(
  supabase: SupabaseClient,
  patch: Partial<Pick<Profile, "displayName" | "onboardedAt">>
): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const dbPatch: Record<string, unknown> = {};
  if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName;
  if (patch.onboardedAt !== undefined) dbPatch.onboarded_at = patch.onboardedAt;

  const { data, error } = await supabase
    .from("profiles")
    .update(dbPatch)
    .eq("id", user.id)
    .select(COLS)
    .single();
  if (error) throw error;
  return toProfile(data as ProfileRow);
}
