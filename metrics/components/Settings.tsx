"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile } from "@/lib/data/profile";
import type { Profile } from "@/lib/types";

// Turns any thrown value into a useful string. Supabase / Postgrest
// errors are plain objects with { message, details, hint, code }, not
// Error instances, so falling back to String(e) yields "[object
// Object]". Walk the common shapes explicitly.
function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const rec = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof rec.message === "string") parts.push(rec.message);
    if (typeof rec.details === "string" && rec.details) parts.push(rec.details);
    if (typeof rec.hint === "string" && rec.hint) parts.push(`(hint: ${rec.hint})`);
    if (typeof rec.code === "string" && rec.code) parts.push(`[${rec.code}]`);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export function Settings({ profile, email }: { profile: Profile; email: string }) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
      <DisplayNameSection profile={profile} />
      <AccountInfoSection profile={profile} email={email} />
    </div>
  );
}

function DisplayNameSection({ profile }: { profile: Profile }) {
  const [value, setValue] = useState(profile.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const clean = value.trim();
    if (!clean) {
      setError("Please enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await updateMyProfile(supabase, { displayName: clean });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserRound className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-900">Display name</h2>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={() => void save()}
          disabled={busy || !value.trim()}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded-md"
        >
          {busy ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

function AccountInfoSection({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2">
      <h2 className="text-sm font-bold text-slate-900">Account</h2>
      <dl className="text-xs text-slate-600 space-y-1">
        <div className="flex gap-2">
          <dt className="font-semibold w-24">Email</dt>
          <dd className="font-mono">{email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-24">Role</dt>
          <dd>{profile.isAdmin ? "Admin" : "Member"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-24">Joined</dt>
          <dd>{new Date(profile.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </section>
  );
}
