"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Account, AppState, Meeting } from "@/lib/types";
import { genId } from "@/lib/ids";

interface Props {
  state: AppState;
  onMutateMeetings: (updater: (prev: Meeting[]) => Meeting[]) => void;
  isHeldSectionOpen: boolean;
  onToggleHeldSection: () => void;
}

const monthDay = (iso: string): string => {
  if (!iso) return "no date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "invalid date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const heldStamp = (ms: number | undefined): string => {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const linkHref = (raw: string): string => {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("http") ? t : `https://${t}`;
};

function isPastDue(iso: string, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

export function MeetingsTracker({
  state,
  onMutateMeetings,
  isHeldSectionOpen,
  onToggleHeldSection,
}: Props) {
  const [modalMode, setModalMode] = useState<
    { kind: "create" } | { kind: "edit"; meeting: Meeting } | null
  >(null);

  const accountNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of state.accounts) {
      m[a.id] = a.name || a.accountData.companyName || "(unnamed)";
    }
    return m;
  }, [state.accounts]);

  const activeAccounts = useMemo(
    () => state.accounts.filter((a) => !a.isArchived),
    [state.accounts],
  );

  const booked = useMemo(
    () =>
      state.meetings
        .filter((m) => m.status === "booked")
        .slice()
        .sort((a, b) => {
          // Ascending by scheduledFor; empties last.
          if (!a.scheduledFor) return 1;
          if (!b.scheduledFor) return -1;
          return a.scheduledFor.localeCompare(b.scheduledFor);
        }),
    [state.meetings],
  );

  const held = useMemo(
    () =>
      state.meetings
        .filter((m) => m.status === "held")
        .slice()
        .sort((a, b) => (b.heldAt ?? 0) - (a.heldAt ?? 0)),
    [state.meetings],
  );

  const upsertMeeting = (m: Meeting) => {
    onMutateMeetings((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) return [...prev, m];
      const next = prev.slice();
      next[idx] = m;
      return next;
    });
    setModalMode(null);
  };

  const convertToHeld = (id: number) => {
    if (
      !window.confirm(
        "Mark this meeting as held? It will move to the Held section.",
      )
    ) {
      return;
    }
    onMutateMeetings((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: "held", heldAt: Date.now() } : m,
      ),
    );
  };

  const moveBackToBooked = (id: number) => {
    onMutateMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: "booked", heldAt: undefined }
          : m,
      ),
    );
  };

  const deleteMeeting = (id: number) => {
    const m = state.meetings.find((x) => x.id === id);
    const label =
      m && (m.firstName || m.lastName)
        ? `${m.firstName} ${m.lastName}`.trim()
        : "this meeting";
    if (!window.confirm(`Delete meeting with ${label}?`)) return;
    onMutateMeetings((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" /> Meetings Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track meetings you&apos;ve booked and move them to Held when they
            actually happen.
          </p>
        </div>
        <button
          onClick={() => setModalMode({ kind: "create" })}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> New meeting
        </button>
      </div>

      {/* Booked (upcoming) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Upcoming — Booked ({booked.length})
        </h2>
        {booked.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No booked meetings. Use{" "}
            <em>New meeting</em> above to add one.
          </p>
        ) : (
          <ul className="space-y-2">
            {booked.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                accountNameById={accountNameById}
                onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                onConvert={() => convertToHeld(m.id)}
                onMoveBack={() => moveBackToBooked(m.id)}
                onDelete={() => deleteMeeting(m.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Held (collapsible) */}
      <section className="space-y-3">
        <button
          onClick={onToggleHeldSection}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
        >
          <span>Held ({held.length})</span>
          {isHeldSectionOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {isHeldSectionOpen && (
          held.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No meetings held yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {held.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  accountNameById={accountNameById}
                  onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                  onConvert={() => convertToHeld(m.id)}
                  onMoveBack={() => moveBackToBooked(m.id)}
                  onDelete={() => deleteMeeting(m.id)}
                />
              ))}
            </ul>
          )
        )}
      </section>

      {modalMode && (
        <MeetingModal
          mode={modalMode}
          accounts={activeAccounts}
          onClose={() => setModalMode(null)}
          onSave={upsertMeeting}
        />
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  accountNameById,
  onEdit,
  onConvert,
  onMoveBack,
  onDelete,
}: {
  meeting: Meeting;
  accountNameById: Record<string, string>;
  onEdit: () => void;
  onConvert: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
}) {
  const fullName =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed contact)";
  const accountName = meeting.accountId
    ? accountNameById[meeting.accountId] ?? "(deleted account)"
    : null;
  const pastDue = meeting.status === "booked" && isPastDue(meeting.scheduledFor);

  return (
    <li className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {fullName}
            </span>
            {meeting.title && (
              <span className="text-xs text-slate-500">
                · {meeting.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-500">
            {accountName && (
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />
                {accountName}
              </span>
            )}
            {meeting.status === "booked" && (
              <span className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {monthDay(meeting.scheduledFor)}
              </span>
            )}
            {meeting.status === "held" && (
              <>
                <span className="flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  {monthDay(meeting.scheduledFor)}
                </span>
                {meeting.heldAt && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Held {heldStamp(meeting.heldAt)}
                  </span>
                )}
              </>
            )}
            {pastDue && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                Past due — mark held?
              </span>
            )}
            {meeting.linkedinUrl && (
              <a
                href={linkHref(meeting.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        </div>
      </div>

      {meeting.notes && (
        <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-md p-2 leading-relaxed">
          {meeting.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onEdit}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        {meeting.status === "booked" ? (
          <button
            onClick={onConvert}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
          >
            <CheckCircle2 className="w-3 h-3" /> Convert to Held
          </button>
        ) : (
          <button
            onClick={onMoveBack}
            className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
          >
            <RotateCcw className="w-3 h-3" /> Move back to Booked
          </button>
        )}
        <button
          onClick={onDelete}
          className="ml-auto text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-red-50"
          title="Delete meeting"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </li>
  );
}

function MeetingModal({
  mode,
  accounts,
  onClose,
  onSave,
}: {
  mode: { kind: "create" } | { kind: "edit"; meeting: Meeting };
  accounts: Account[];
  onClose: () => void;
  onSave: (m: Meeting) => void;
}) {
  const isEdit = mode.kind === "edit";
  const source = isEdit ? mode.meeting : null;

  const [firstName, setFirstName] = useState(source?.firstName ?? "");
  const [lastName, setLastName] = useState(source?.lastName ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(source?.linkedinUrl ?? "");
  const [accountId, setAccountId] = useState(source?.accountId ?? "");
  const [scheduledFor, setScheduledFor] = useState(source?.scheduledFor ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (
      !firstName.trim() &&
      !lastName.trim() &&
      !title.trim() &&
      !linkedinUrl.trim()
    ) {
      setError("Provide at least a name, title, or LinkedIn URL.");
      return;
    }
    const now = Date.now();
    const meeting: Meeting = {
      id: source?.id ?? genId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      linkedinUrl: linkedinUrl.trim(),
      scheduledFor: scheduledFor.trim(),
      notes: notes.trim(),
      status: source?.status ?? "booked",
      createdAt: source?.createdAt ?? now,
    };
    if (accountId) meeting.accountId = accountId;
    if (source?.heldAt) meeting.heldAt = source.heldAt;
    onSave(meeting);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 text-slate-800"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isEdit ? "Edit meeting" : "New meeting"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First name">
            <input
              autoFocus
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>
        </div>

        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. VP of Engineering"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>

        <Field label="Account">
          {accounts.length === 0 ? (
            <p className="text-xs italic text-slate-500 px-3 py-2 border border-slate-200 rounded-md bg-slate-50">
              No accounts yet. Create one from the sidebar first.
            </p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">— No account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.accountData.companyName || "(unnamed)"}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="LinkedIn URL">
          <input
            type="text"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="linkedin.com/in/..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>

        <Field label="Scheduled for (date and time)">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context, mutual connections, agenda..."
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y custom-scrollbar"
          />
        </Field>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm"
          >
            {isEdit ? "Save changes" : "Add meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
