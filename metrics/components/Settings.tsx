"use client";

import { useState } from "react";
import { Upload, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { importFromLegacyExport, type ImportSummary } from "@/lib/import/legacy";
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
      <ImportSection />
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

function ImportSection() {
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJson(text);
    e.target.value = "";
  };

  const run = async () => {
    if (!json.trim()) {
      setError("Paste the export JSON or upload the file first.");
      return;
    }
    if (
      !window.confirm(
        "Import this export into your account? Existing data won't be deleted, and duplicate accounts (matched by name) get reused."
      )
    )
      return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const supabase = createClient();
      const result = await importFromLegacyExport(supabase, json);
      setSummary(result);
      setJson("");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-900">
          Import from SDR Launchpad export
        </h2>
      </div>
      <p className="text-xs text-slate-500">
        One-shot import of a JSON file exported from your personal SDR
        Launchpad. Brings across accounts, meetings, meeting updates, goal
        logs, quarterly goals, and saved-week markers. Screenshots stay in
        the Launchpad (they live in IndexedDB and aren&apos;t part of the
        export).
      </p>
      <input type="file" accept="application/json" onChange={onFile} className="text-xs" />
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={8}
        placeholder="Or paste the JSON here"
        className="w-full font-mono text-xs text-slate-700 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {summary && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
          <p className="font-semibold">Import complete.</p>
          <p>{summary.accounts} accounts, {summary.meetings} meetings, {summary.meetingUpdates} updates, {summary.goalLogs} log entries, {summary.quarterlyGoals} quarterly goals, {summary.savedWeeks} saved-week markers.</p>
          {(summary.skipped.accountsWithoutName +
            summary.skipped.meetingsWithoutContact +
            summary.skipped.goalLogsWithoutKind >
            0) && (
            <p className="text-emerald-900/70">
              Skipped: {summary.skipped.accountsWithoutName} unnamed accounts,{" "}
              {summary.skipped.meetingsWithoutContact} empty meetings,{" "}
              {summary.skipped.goalLogsWithoutKind} unkeyed log entries.
            </p>
          )}
        </div>
      )}
      <div>
        <button
          onClick={() => void run()}
          disabled={busy || !json.trim()}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded-md shadow-sm"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
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
