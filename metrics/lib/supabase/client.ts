import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Reads the anon key + URL from
// NEXT_PUBLIC_* env vars (safe to ship to the browser). All queries
// through this client run as the signed-in user and are gated by RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
