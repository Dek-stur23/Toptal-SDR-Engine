import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. ONLY use from server-side code
// (route handlers, server actions). Never import this into a client
// component or the service key will end up in the browser bundle.
//
// Current use: inserting into `ai_usage` after a metered Anthropic
// call, and admin-only tasks like managing the allowed_emails list.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
