import { createClient } from "@/lib/supabase/server";

// Placeholder home page. Middleware already redirects unauthenticated
// visitors to /login, so anything rendered here assumes a session.
// Subsequent commits replace this with the Goals & Metrics + Meetings
// Tracker UI.
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">SDR Metrics</h1>
      <p className="mt-2 text-slate-600">
        Signed in as <span className="font-mono">{user?.email}</span>.
      </p>
      <p className="mt-6 text-sm text-slate-500">
        Goals &amp; Metrics and the Meetings Tracker land here in the next
        commit.
      </p>
    </main>
  );
}
