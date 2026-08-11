"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  ChevronRight,
  Edit2,
  List,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  bulkCreateAccounts,
  createAccount,
  deleteAccount,
  listAccounts,
  renameAccount,
  setAccountArchived,
  setAccountDefaultEse,
} from "@/lib/data/accounts";
import { createEse, deleteEse, listEses, type Ese } from "@/lib/data/eses";
import { AccountActivityView } from "@/components/AccountActivityView";
import type { Account } from "@/lib/types";

export function Accounts() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [eses, setEses] = useState<Ese[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [view, setView] = useState<"list" | "activity">("list");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [as, es] = await Promise.all([
          listAccounts(supabase),
          listEses(supabase),
        ]);
        if (cancelled) return;
        setAccounts(as);
        setEses(es);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (!showArchived && a.isArchived) return false;
      if (showArchived && !a.isArchived) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accounts, query, showArchived]);

  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  const submitAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    setAddBusy(true);
    try {
      const created = await createAccount(supabase, name);
      setAccounts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setAddName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddBusy(false);
    }
  };

  const rename = async (id: string, next: string) => {
    const clean = next.trim();
    if (!clean) return;
    await renameAccount(supabase, id, clean);
    setAccounts((prev) =>
      prev
        .map((a) => (a.id === id ? { ...a, name: clean } : a))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const toggleArchive = async (id: string) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) return;
    await setAccountArchived(supabase, id, !a.isArchived);
    setAccounts((prev) =>
      prev.map((x) => (x.id === id ? { ...x, isArchived: !a.isArchived } : x))
    );
  };

  const setEseFor = async (id: string, ese: string | null) => {
    const saved = await setAccountDefaultEse(supabase, id, ese);
    setAccounts((prev) => prev.map((x) => (x.id === id ? saved : x)));
  };

  const del = async (id: string) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) return;
    if (
      !window.confirm(
        `Delete "${a.name}"? Meetings and logs tagged with this account will lose the tag but stay in place.`
      )
    )
      return;
    await deleteAccount(supabase, id);
    setAccounts((prev) => prev.filter((x) => x.id !== id));
  };

  const applyBulk = async (names: string[]) => {
    const { created } = await bulkCreateAccounts(supabase, names);
    setAccounts((prev) =>
      [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) return <p className="text-sm text-rose-700">Failed to load: {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" /> Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Companies you can tag meetings and prospect-added logs against.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm"
            role="tablist"
            aria-label="Accounts view"
          >
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
                view === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={view === "list"}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setView("activity")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
                view === "activity"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={view === "activity"}
            >
              <PhoneCall className="w-3.5 h-3.5" /> Activity
            </button>
          </div>
          {view === "list" && (
            <button
              onClick={() => setBulkOpen(true)}
              className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" /> Bulk add
            </button>
          )}
        </div>
      </div>

      {view === "activity" && <AccountActivityView />}

      {view === "list" && (
        <>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitAdd();
            }}
            placeholder="Add an account (e.g. Acme Corp)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={() => void submitAdd()}
            disabled={addBusy || !addName.trim()}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-2 rounded-md shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            {showArchived ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {showArchived
              ? `Showing archived (${archived.length})`
              : `Active (${active.length}) — click to show archived`}
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            {showArchived ? "No archived accounts." : "No accounts yet."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                eses={eses}
                onRename={(next) => rename(a.id, next)}
                onSetDefaultEse={(ese) => setEseFor(a.id, ese)}
                onToggleArchive={() => toggleArchive(a.id)}
                onDelete={() => del(a.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {bulkOpen && (
        <BulkAddModal
          onClose={() => setBulkOpen(false)}
          onSubmit={async (names) => {
            await applyBulk(names);
            setBulkOpen(false);
          }}
          existingLowercase={new Set(accounts.map((a) => a.name.toLowerCase()))}
        />
      )}

          <EseSection />
        </>
      )}
    </div>
  );
}

function EseSection() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eses, setEses] = useState<Ese[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listEses(supabase);
        if (!cancelled) setEses(rows);
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
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createEse(supabase, name);
      setEses((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Remove "${name}" from your ESE list? Meetings already tagged with this ESE keep the tag.`
      )
    )
      return;
    await deleteEse(supabase, id);
    setEses((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <section className="space-y-3 pt-4">
      <div className="flex items-center gap-2">
        <UserRound className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          ESEs ({eses.length})
        </h2>
      </div>
      <p className="text-xs text-slate-500 -mt-1">
        Enterprise Sales Executives you can tag meetings against. Changes show
        up immediately in the Meetings Tracker dropdowns.
      </p>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="Add an ESE (e.g. Dan Weldon)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={() => void add()}
            disabled={busy || !draft.trim()}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 px-3 py-2 rounded-md shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-slate-500 italic">Loading…</p>
      ) : eses.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No ESEs yet. Add one above and it&apos;ll show up in the Meetings
          Tracker.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {eses.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-md px-3 py-2"
            >
              <span className="flex-1 text-slate-800 truncate">{e.name}</span>
              <button
                onClick={() => void remove(e.id, e.name)}
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
  );
}

function AccountRow({
  account,
  eses,
  onRename,
  onSetDefaultEse,
  onToggleArchive,
  onDelete,
}: {
  account: Account;
  eses: Ese[];
  onRename: (next: string) => void | Promise<void>;
  onSetDefaultEse: (ese: string | null) => void | Promise<void>;
  onToggleArchive: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.name);

  const save = async () => {
    if (draft.trim() && draft.trim() !== account.name) {
      await onRename(draft.trim());
    }
    setEditing(false);
  };

  // Preserve a currently-set ESE even if it's since been removed from
  // the user's list — mirrors what the Meeting modal already does.
  const currentEseMissing =
    !!account.defaultEse && !eses.some((e) => e.name === account.defaultEse);

  return (
    <li className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-md px-3 py-2">
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") {
                setDraft(account.name);
                setEditing(false);
              }
            }}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={() => void save()}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
          >
            Save
          </button>
          <button
            onClick={() => {
              setDraft(account.name);
              setEditing(false);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-slate-800 truncate">{account.name}</span>
          {account.isArchived && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
              Archived
            </span>
          )}
          <label
            className="inline-flex items-center gap-1 text-xs text-slate-500"
            title="Default ESE — auto-fills the ESE field on new meetings for this account"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              ESE
            </span>
            <select
              value={account.defaultEse ?? ""}
              onChange={(e) =>
                void onSetDefaultEse(e.target.value ? e.target.value : null)
              }
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none max-w-40 truncate"
            >
              <option value="">— None —</option>
              {eses.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
              {currentEseMissing && account.defaultEse && (
                <option value={account.defaultEse}>
                  {account.defaultEse} (removed)
                </option>
              )}
            </select>
          </label>
          <button
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-blue-600 p-1"
            title="Rename"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => void onToggleArchive()}
            className="text-slate-400 hover:text-amber-600 p-1"
            title={account.isArchived ? "Unarchive" : "Archive"}
          >
            {account.isArchived ? (
              <ArchiveRestore className="w-3.5 h-3.5" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => void onDelete()}
            className="text-slate-400 hover:text-red-600 p-1"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </li>
  );
}

// Bulk-add modal. Accepts a paste of company names (one per line or
// comma-separated, or a CSV with a header row like "name" or
// "company"). Dedupes case-insensitively against existing accounts.
function BulkAddModal({
  onClose,
  onSubmit,
  existingLowercase,
}: {
  onClose: () => void;
  onSubmit: (names: string[]) => void | Promise<void>;
  existingLowercase: Set<string>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseNames(text), [text]);
  const fresh: string[] = [];
  const dupes: string[] = [];
  const seen = new Set<string>();
  for (const n of parsed) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (existingLowercase.has(key)) dupes.push(n);
    else fresh.push(n);
  }

  const submit = async () => {
    if (fresh.length === 0) return;
    setBusy(true);
    try {
      await onSubmit(fresh);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Bulk add accounts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Paste one company name per line, or a comma-separated list, or a CSV
          with a header row (name / company / company name / account).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Acme Corp&#10;Beta Systems&#10;Gamma Industries"
          className="w-full text-sm text-slate-700 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y font-mono"
        />
        <div className="text-xs text-slate-600 flex items-center gap-3">
          <span>
            <span className="font-semibold text-emerald-700">{fresh.length}</span> new
          </span>
          <span>
            <span className="font-semibold text-amber-700">{dupes.length}</span> duplicate
            {dupes.length === 1 ? "" : "s"}
          </span>
          {dupes.length > 0 && (
            <span className="text-slate-400 truncate">
              (skipped: {dupes.slice(0, 4).join(", ")}
              {dupes.length > 4 ? `, +${dupes.length - 4}` : ""})
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || fresh.length === 0}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
          >
            {busy ? "Adding…" : `Add ${fresh.length} account${fresh.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Very forgiving name parser: newlines, commas, and semicolons split
// values; the first line is treated as a header row when it matches
// one of the common header names.
const HEADER_TOKENS = new Set(["name", "company", "company name", "account"]);

function parseNames(text: string): string[] {
  const rawLines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return [];
  let lines = rawLines;
  const firstLower = rawLines[0].toLowerCase();
  if (HEADER_TOKENS.has(firstLower)) lines = rawLines.slice(1);
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) out.push(p);
  }
  return out;
}
