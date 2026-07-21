"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addAllowedEmail,
  listAllowedEmails,
  removeAllowedEmail,
  type AllowedEmail,
} from "@/lib/data/allowedEmails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminInvites() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AllowedEmail[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAllowedEmails(supabase);
        if (!cancelled) setEntries(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const add = async () => {
    const clean = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await addAllowedEmail(supabase, clean);
      setEntries((prev) => [created, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, email: string) => {
    if (!window.confirm(`Remove ${email} from the invite allowlist?`)) return;
    await removeAllowedEmail(supabase, id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" /> Invites
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Email addresses on this list can sign up. Signup for anyone else is
          blocked by a database trigger.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
              placeholder="teammate@company.com"
              className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={() => void add()}
            disabled={busy || !draft.trim()}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-2 rounded-md shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Invite
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Allowlist ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No emails invited yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-md px-3 py-2"
              >
                <span className="flex-1 text-slate-800 truncate font-mono text-xs">
                  {e.email}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(e.addedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => void remove(e.id, e.email)}
                  className="text-slate-400 hover:text-red-600 p-1"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
