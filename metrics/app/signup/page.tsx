"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // The invite-gate trigger surfaces as a generic auth error —
      // rewrite it into something friendlier.
      const msg = /allowlist/i.test(error.message)
        ? "This email isn't invited yet. Ask an admin to add you."
        : error.message;
      setError(msg);
      setBusy(false);
      return;
    }

    // If email confirmations are on in the Supabase project, there's
    // no session yet — tell the user to check their inbox. If off,
    // a session already exists and we can go straight in.
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setNeedsConfirm(true);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-6">
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signup is invite-only. Your email must be on the allowlist.
        </p>

        {needsConfirm ? (
          <div className="mt-8 rounded border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-800">
            Check your inbox for a confirmation link. Once you click it, you'll
            be signed in.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <span className="mt-1 block text-xs text-slate-500">
                At least 8 characters.
              </span>
            </label>

            {error && (
              <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
