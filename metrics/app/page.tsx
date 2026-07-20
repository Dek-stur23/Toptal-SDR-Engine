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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SDR Metrics</h1>
          <p className="mt-2 text-slate-600">
            Signed in as <span className="font-mono">{user?.email}</span>.
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Goals &amp; Metrics and the Meetings Tracker land here in the next
        commit.
      </p>
    </main>
  );
}
