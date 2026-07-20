"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile } from "@/lib/data/profile";
import type { Profile } from "@/lib/types";

// Shown by AppShell when profile.onboardedAt is null (i.e. the user
// just signed up). Collects a display name and marks the profile as
// onboarded so it never shows again. Non-dismissable: the flow is
// short and skipping it just leaves the header showing the raw email
// forever.
export function OnboardingModal({
  initialEmail,
  initialDisplayName,
}: {
  initialEmail: string;
  initialDisplayName: string | null;
}) {
  const [visible, setVisible] = useState(true);
  const [displayName, setDisplayName] = useState(
    initialDisplayName ?? initialEmail.split("@")[0] ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const submit = async () => {
    const clean = displayName.trim();
    if (!clean) {
      setError("Please enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await updateMyProfile(supabase, {
        displayName: clean,
        onboardedAt: new Date().toISOString(),
      });
      setVisible(false);
      // Trigger the server layout to re-fetch the profile so the
      // header shows the new name immediately.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
            <UserRound className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Welcome to SDR Metrics</h3>
        </div>
        <p className="text-sm text-slate-600">
          What should we call you? This shows up in the header and helps
          teammates find your name when we add sharing later.
        </p>
        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Display name
          </span>
          <input
            autoFocus
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end pt-1">
          <button
            onClick={() => void submit()}
            disabled={busy || !displayName.trim()}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
          >
            {busy ? "Saving…" : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
