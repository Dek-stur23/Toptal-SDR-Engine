"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  List,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteMeetingImage,
  uploadMeetingImage,
} from "@/lib/storage/images";
import { useImage } from "@/lib/hooks/useImage";
import { listAccounts } from "@/lib/data/accounts";
import {
  addMeetingUpdate,
  createMeeting,
  deleteMeeting as deleteMeetingRow,
  deleteMeetingUpdate,
  listAllMeetingUpdates,
  listMeetings,
  updateMeeting,
  type MeetingDraft,
} from "@/lib/data/meetings";
import type {
  Account,
  BookedCategory,
  HeldOutcome,
  Meeting,
  MeetingStatus,
  MeetingUpdate,
  ProspectResponse,
} from "@/lib/types";

// ---- Format helpers -----------------------------------------------

const monthDay = (iso: string | null): string => {
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

const heldStamp = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
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

function isPastDue(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

// A `datetime-local` <input> can't consume a full ISO string with
// timezone. Convert to/from the "YYYY-MM-DDTHH:MM" shape it expects,
// interpreting the value as local time (which matches the parent
// Launchpad's semantics).
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function datetimeLocalToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Enterprise Sales Executives that meetings can be tagged to. Same
// hardcoded list as the parent Launchpad.
const ESE_OPTIONS = [
  "Dan Weldon",
  "Ryan Abraham",
  "Blake Harvey",
  "Matt Schneider",
] as const;

const PROSPECT_RESPONSE_LABEL: Record<ProspectResponse, string> = {
  accepted: "Prospect accepted",
  declined: "Prospect declined",
  "no-response": "No response yet",
  "no-show": "Prospect no-showed",
  rescheduled: "Prospect rescheduled",
  "still-scheduling": "Still scheduling",
};

const PROSPECT_RESPONSE_BADGE: Record<ProspectResponse, string> = {
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  "no-response": "bg-slate-50 text-slate-600 border-slate-200",
  "no-show": "bg-amber-50 text-amber-700 border-amber-200",
  rescheduled: "bg-sky-50 text-sky-700 border-sky-200",
  "still-scheduling": "bg-teal-50 text-teal-700 border-teal-200",
};

const HELD_OUTCOME_LABEL: Record<HeldOutcome, string> = {
  "opportunity-identified": "Opportunity identified",
  "future-follow-up": "Future follow-up",
  "dead-end": "Dead end",
};

const HELD_OUTCOME_STYLE: Record<HeldOutcome, string> = {
  "opportunity-identified":
    "bg-emerald-100 text-emerald-800 border-emerald-300",
  "future-follow-up": "bg-amber-100 text-amber-800 border-amber-300",
  "dead-end": "bg-red-100 text-red-800 border-red-300",
};

// Auto-log text for edits — same helper as the parent app, adapted
// for the metrics shape.
function describeMeetingChanges(before: Meeting, after: Meeting): string {
  const changed: string[] = [];
  if (before.firstName !== after.firstName || before.lastName !== after.lastName)
    changed.push("name");
  if (before.title !== after.title) changed.push("title");
  if (before.linkedinUrl !== after.linkedinUrl) changed.push("LinkedIn URL");
  if ((before.accountId ?? "") !== (after.accountId ?? "")) changed.push("account");
  if ((before.ese ?? "") !== (after.ese ?? "")) changed.push("ESE");
  if ((before.bookedCategory ?? "") !== (after.bookedCategory ?? ""))
    changed.push("booked category");
  if ((before.scheduledFor ?? "") !== (after.scheduledFor ?? ""))
    changed.push("scheduled time");
  if (before.notes !== after.notes) changed.push("notes");
  if (changed.length === 0) return "";
  return `Meeting details updated: ${changed.join(", ")}`;
}

// ---- Root ---------------------------------------------------------

type ViewKind = "list" | "calendar";

export function MeetingsTracker() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [updatesById, setUpdatesById] = useState<Record<string, MeetingUpdate[]>>({});

  const [meetingsView, setMeetingsView] = useState<ViewKind>("list");
  const [isHeldSectionOpen, setIsHeldSectionOpen] = useState(false);
  const [isDeadEndSectionOpen, setIsDeadEndSectionOpen] = useState(false);

  const [modalMode, setModalMode] = useState<
    { kind: "create" } | { kind: "edit"; meeting: Meeting } | null
  >(null);
  const [viewingMeetingId, setViewingMeetingId] = useState<string | null>(null);
  const viewingMeeting =
    viewingMeetingId !== null
      ? meetings.find((x) => x.id === viewingMeetingId) ?? null
      : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, m, u] = await Promise.all([
          listAccounts(supabase),
          listMeetings(supabase),
          listAllMeetingUpdates(supabase),
        ]);
        if (cancelled) return;
        setAccounts(a);
        setMeetings(m);
        const grouped: Record<string, MeetingUpdate[]> = {};
        for (const upd of u) {
          (grouped[upd.meetingId] ??= []).push(upd);
        }
        setUpdatesById(grouped);
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

  const accountNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.name || "(unnamed)";
    return m;
  }, [accounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived),
    [accounts]
  );

  // ---- Filters (session-local) ----
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const [filterEses, setFilterEses] = useState<string[]>([]);
  const [filterResponses, setFilterResponses] = useState<ProspectResponse[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<MeetingStatus[]>([]);
  const [filterBookedCategories, setFilterBookedCategories] = useState<
    BookedCategory[]
  >([]);
  const anyFilterActive =
    filterAccountIds.length > 0 ||
    filterEses.length > 0 ||
    filterResponses.length > 0 ||
    filterStatuses.length > 0 ||
    filterBookedCategories.length > 0;
  const clearFilters = () => {
    setFilterAccountIds([]);
    setFilterEses([]);
    setFilterResponses([]);
    setFilterStatuses([]);
    setFilterBookedCategories([]);
  };

  const filteredMeetings = useMemo(() => {
    if (!anyFilterActive) return meetings;
    return meetings.filter((m) => {
      if (
        filterAccountIds.length > 0 &&
        !(m.accountId && filterAccountIds.includes(m.accountId))
      )
        return false;
      if (filterEses.length > 0 && !(m.ese && filterEses.includes(m.ese)))
        return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(m.status))
        return false;
      if (filterResponses.length > 0) {
        const r = m.prospectResponse ?? "no-response";
        if (!filterResponses.includes(r)) return false;
      }
      if (filterBookedCategories.length > 0) {
        if (
          !m.bookedCategory ||
          !filterBookedCategories.includes(m.bookedCategory)
        )
          return false;
      }
      return true;
    });
  }, [
    meetings,
    anyFilterActive,
    filterAccountIds,
    filterEses,
    filterResponses,
    filterStatuses,
    filterBookedCategories,
  ]);

  const booked = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.status === "booked")
        .slice()
        .sort((a, b) => {
          if (!a.scheduledFor) return 1;
          if (!b.scheduledFor) return -1;
          return a.scheduledFor.localeCompare(b.scheduledFor);
        }),
    [filteredMeetings]
  );
  const held = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.status === "held")
        .slice()
        .sort((a, b) => (b.heldAt ?? "").localeCompare(a.heldAt ?? "")),
    [filteredMeetings]
  );
  const deadEnd = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.status === "dead-end")
        .slice()
        .sort((a, b) => (b.deadEndedAt ?? "").localeCompare(a.deadEndedAt ?? "")),
    [filteredMeetings]
  );

  // ---- Mutation helpers ----

  // Auto-log an update against a meeting. Fire-and-forget from the
  // caller's perspective — we update local state before awaiting so
  // the UI stays snappy; on error we surface it but don't roll back.
  const autoLog = async (meetingId: string, text: string) => {
    const upd = await addMeetingUpdate(supabase, meetingId, text, {
      system: true,
    });
    setUpdatesById((prev) => ({
      ...prev,
      [meetingId]: [upd, ...(prev[meetingId] ?? [])],
    }));
  };

  const upsertMeetingFromModal = async (draft: MeetingDraft, editingId: string | null) => {
    if (editingId) {
      const before = meetings.find((m) => m.id === editingId);
      const saved = await updateMeeting(supabase, editingId, draft);
      setMeetings((prev) => prev.map((m) => (m.id === editingId ? saved : m)));
      if (before) {
        const desc = describeMeetingChanges(before, saved);
        if (desc) await autoLog(saved.id, desc);
      }
    } else {
      const saved = await createMeeting(supabase, draft);
      setMeetings((prev) => [saved, ...prev]);
      await autoLog(saved.id, "Meeting logged");
    }
    setModalMode(null);
  };

  const convertToHeld = async (id: string) => {
    if (
      !window.confirm(
        "Mark this meeting as held? It will move to the Held section."
      )
    )
      return;
    const saved = await updateMeeting(supabase, id, {
      status: "held",
      heldAt: new Date().toISOString(),
    });
    setMeetings((prev) => prev.map((m) => (m.id === id ? saved : m)));
    await autoLog(id, "Marked as held");
  };

  const markDeadEnd = async (id: string) => {
    if (
      !window.confirm(
        "Mark this meeting as a dead end? It will move to the Dead End section with no further next steps."
      )
    )
      return;
    const saved = await updateMeeting(supabase, id, {
      status: "dead-end",
      deadEndedAt: new Date().toISOString(),
    });
    setMeetings((prev) => prev.map((m) => (m.id === id ? saved : m)));
    await autoLog(id, "Marked as dead end");
  };

  const setProspectResponse = async (id: string, response: ProspectResponse) => {
    const before = meetings.find((m) => m.id === id);
    const prev = before?.prospectResponse ?? "no-response";
    if (prev === response) return;
    const saved = await updateMeeting(supabase, id, {
      prospectResponse: response,
    });
    setMeetings((prevList) => prevList.map((m) => (m.id === id ? saved : m)));
    await autoLog(id, `Response set to "${PROSPECT_RESPONSE_LABEL[response]}"`);
  };

  const setHeldOutcome = async (id: string, outcome: HeldOutcome | null) => {
    const before = meetings.find((m) => m.id === id);
    const prev = before?.heldOutcome ?? null;
    if (prev === outcome) return;
    const saved = await updateMeeting(supabase, id, {
      heldOutcome: outcome,
    });
    setMeetings((prevList) => prevList.map((m) => (m.id === id ? saved : m)));
    await autoLog(
      id,
      outcome
        ? `Held outcome set to "${HELD_OUTCOME_LABEL[outcome]}"`
        : "Held outcome cleared"
    );
  };

  const setMeetingNotes = async (id: string, notes: string) => {
    const saved = await updateMeeting(supabase, id, { notes });
    setMeetings((prevList) => prevList.map((m) => (m.id === id ? saved : m)));
  };

  const addUpdate = async (meetingId: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const upd = await addMeetingUpdate(supabase, meetingId, clean);
    setUpdatesById((prev) => ({
      ...prev,
      [meetingId]: [upd, ...(prev[meetingId] ?? [])],
    }));
  };

  const removeUpdate = async (meetingId: string, updateId: string) => {
    await deleteMeetingUpdate(supabase, updateId);
    setUpdatesById((prev) => ({
      ...prev,
      [meetingId]: (prev[meetingId] ?? []).filter((u) => u.id !== updateId),
    }));
  };

  const moveBackToBooked = async (id: string) => {
    const before = meetings.find((m) => m.id === id);
    if (!before || before.status === "booked") return;
    const fromLabel = before.status === "held" ? "Held" : "Dead End";
    const saved = await updateMeeting(supabase, id, {
      status: "booked",
      heldAt: null,
      deadEndedAt: null,
    });
    setMeetings((prevList) => prevList.map((m) => (m.id === id ? saved : m)));
    await autoLog(id, `Moved from ${fromLabel} back to Booked`);
  };

  const handleDeleteMeeting = async (id: string) => {
    const m = meetings.find((x) => x.id === id);
    const label =
      m && (m.firstName || m.lastName)
        ? `${m.firstName} ${m.lastName}`.trim()
        : "this meeting";
    if (!window.confirm(`Delete meeting with ${label}?`)) return;
    await deleteMeetingRow(supabase, id);
    if (m?.imageKey) {
      try {
        await deleteMeetingImage(supabase, m.imageKey);
      } catch {
        // Best-effort: leave the object orphaned rather than block the
        // delete on a storage error.
      }
    }
    setMeetings((prev) => prev.filter((x) => x.id !== id));
    setUpdatesById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error)
    return <p className="text-sm text-rose-700">Failed to load: {error}</p>;

  return (
    <div className="space-y-8">
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
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs font-semibold"
            role="tablist"
            aria-label="Meetings view"
          >
            <button
              onClick={() => setMeetingsView("list")}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                meetingsView === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={meetingsView === "list"}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setMeetingsView("calendar")}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                meetingsView === "calendar"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-pressed={meetingsView === "calendar"}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>
          <button
            onClick={() => setModalMode({ kind: "create" })}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New meeting
          </button>
        </div>
      </div>

      <FilterBar
        activeAccounts={activeAccounts}
        filterAccountIds={filterAccountIds}
        onFilterAccounts={setFilterAccountIds}
        filterEses={filterEses}
        onFilterEses={setFilterEses}
        filterResponses={filterResponses}
        onFilterResponses={setFilterResponses}
        filterStatuses={filterStatuses}
        onFilterStatuses={setFilterStatuses}
        filterBookedCategories={filterBookedCategories}
        onFilterBookedCategories={setFilterBookedCategories}
        anyFilterActive={anyFilterActive}
        onClear={clearFilters}
        matchCount={filteredMeetings.length}
        totalCount={meetings.length}
      />

      {meetingsView === "calendar" ? (
        <CalendarView
          meetings={filteredMeetings}
          accountNameById={accountNameById}
          onOpenMeeting={(m) => setViewingMeetingId(m.id)}
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Upcoming — Booked ({booked.length})
            </h2>
            {booked.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No booked meetings. Use <em>New meeting</em> above to add one.
              </p>
            ) : (
              <ul className="space-y-2">
                {booked.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    updates={updatesById[m.id] ?? []}
                    accountNameById={accountNameById}
                    onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                    onConvert={() => convertToHeld(m.id)}
                    onMarkDeadEnd={() => markDeadEnd(m.id)}
                    onMoveBack={() => moveBackToBooked(m.id)}
                    onDelete={() => handleDeleteMeeting(m.id)}
                    onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                    onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                    onSetNotes={(n) => setMeetingNotes(m.id, n)}
                    onAddUpdate={(t) => addUpdate(m.id, t)}
                    onRemoveUpdate={(uid) => removeUpdate(m.id, uid)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <button
              onClick={() => setIsHeldSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
            >
              <span>Held ({held.length})</span>
              {isHeldSectionOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {isHeldSectionOpen &&
              (held.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No meetings held yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {held.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      updates={updatesById[m.id] ?? []}
                      accountNameById={accountNameById}
                      onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                      onConvert={() => convertToHeld(m.id)}
                      onMarkDeadEnd={() => markDeadEnd(m.id)}
                      onMoveBack={() => moveBackToBooked(m.id)}
                      onDelete={() => handleDeleteMeeting(m.id)}
                      onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                      onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                      onSetNotes={(n) => setMeetingNotes(m.id, n)}
                      onAddUpdate={(t) => addUpdate(m.id, t)}
                      onRemoveUpdate={(uid) => removeUpdate(m.id, uid)}
                    />
                  ))}
                </ul>
              ))}
          </section>

          <section className="space-y-3">
            <button
              onClick={() => setIsDeadEndSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
            >
              <span>Dead End ({deadEnd.length})</span>
              {isDeadEndSectionOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {isDeadEndSectionOpen &&
              (deadEnd.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No dead-end meetings. Meetings you mark as dead ends will land here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {deadEnd.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      updates={updatesById[m.id] ?? []}
                      accountNameById={accountNameById}
                      onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                      onConvert={() => convertToHeld(m.id)}
                      onMarkDeadEnd={() => markDeadEnd(m.id)}
                      onMoveBack={() => moveBackToBooked(m.id)}
                      onDelete={() => handleDeleteMeeting(m.id)}
                      onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                      onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                      onSetNotes={(n) => setMeetingNotes(m.id, n)}
                      onAddUpdate={(t) => addUpdate(m.id, t)}
                      onRemoveUpdate={(uid) => removeUpdate(m.id, uid)}
                    />
                  ))}
                </ul>
              ))}
          </section>
        </>
      )}

      {modalMode && (
        <MeetingModal
          mode={modalMode}
          accounts={activeAccounts}
          onClose={() => setModalMode(null)}
          onSave={(draft, editingId) => upsertMeetingFromModal(draft, editingId)}
        />
      )}

      {viewingMeeting && (
        <MeetingDetailsModal
          meeting={viewingMeeting}
          updates={updatesById[viewingMeeting.id] ?? []}
          accountNameById={accountNameById}
          onClose={() => setViewingMeetingId(null)}
          onEdit={() => {
            setModalMode({ kind: "edit", meeting: viewingMeeting });
            setViewingMeetingId(null);
          }}
          onConvert={() => convertToHeld(viewingMeeting.id)}
          onMarkDeadEnd={() => markDeadEnd(viewingMeeting.id)}
          onMoveBack={() => moveBackToBooked(viewingMeeting.id)}
          onDelete={() => {
            handleDeleteMeeting(viewingMeeting.id);
            setViewingMeetingId(null);
          }}
          onSetProspectResponse={(r) => setProspectResponse(viewingMeeting.id, r)}
          onSetHeldOutcome={(o) => setHeldOutcome(viewingMeeting.id, o)}
          onSetNotes={(n) => setMeetingNotes(viewingMeeting.id, n)}
          onAddUpdate={(t) => addUpdate(viewingMeeting.id, t)}
          onRemoveUpdate={(uid) => removeUpdate(viewingMeeting.id, uid)}
        />
      )}
    </div>
  );
}

// ---- Calendar view -------------------------------------------------

function CalendarView({
  meetings,
  accountNameById,
  onOpenMeeting,
}: {
  meetings: Meeting[];
  accountNameById: Record<string, string>;
  onOpenMeeting: (m: Meeting) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!m.scheduledFor) continue;
      const d = new Date(m.scheduledFor);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
    }
    return map;
  }, [meetings]);

  const goToPrev = () => setCursor(new Date(year, month - 1, 1));
  const goToNext = () => setCursor(new Date(year, month + 1, 1));
  const goToToday = () =>
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const isInMonth = (d: Date) => d.getMonth() === month;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 min-w-40 text-center">
            {monthLabel}
          </h2>
          <button
            onClick={goToNext}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
          <div
            key={w}
            className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider text-center py-1.5"
          >
            {w}
          </div>
        ))}
        {days.map((d) => {
          const key = dayKey(d);
          const dayMeetings = meetingsByDay.get(key) ?? [];
          const inMonth = isInMonth(d);
          const todayCell = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={`bg-white min-h-24 p-1.5 flex flex-col gap-1 ${
                inMonth ? "" : "opacity-50 bg-slate-50/40"
              } ${todayCell ? "ring-2 ring-blue-500 ring-inset z-10" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold ${
                    todayCell
                      ? "text-blue-700"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {d.getDate()}
                </span>
                {dayMeetings.length > 3 && (
                  <span className="text-[9px] text-slate-500">
                    {dayMeetings.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-h-0">
                {dayMeetings.slice(0, 3).map((m) => (
                  <MeetingChip
                    key={m.id}
                    meeting={m}
                    accountNameById={accountNameById}
                    onClick={() => onOpenMeeting(m)}
                  />
                ))}
                {dayMeetings.length > 3 && (
                  <button
                    onClick={() => onOpenMeeting(dayMeetings[3])}
                    className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold text-left"
                  >
                    + {dayMeetings.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MeetingChip({
  meeting,
  accountNameById,
  onClick,
}: {
  meeting: Meeting;
  accountNameById: Record<string, string>;
  onClick: () => void;
}) {
  const name = `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed)";
  const time = (() => {
    if (!meeting.scheduledFor) return "";
    const d = new Date(meeting.scheduledFor);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  })();
  const accountName = meeting.accountId
    ? accountNameById[meeting.accountId] ?? ""
    : "";
  const isHeld = meeting.status === "held";
  const isDeadEnd = meeting.status === "dead-end";
  const declined = meeting.prospectResponse === "declined";
  const accepted = meeting.prospectResponse === "accepted";
  const noShow = meeting.prospectResponse === "no-show";
  const rescheduled = meeting.prospectResponse === "rescheduled";
  const stillScheduling = meeting.prospectResponse === "still-scheduling";

  const cls = isDeadEnd
    ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 line-through decoration-slate-400"
    : isHeld
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
      : declined
        ? "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
        : noShow
          ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
          : rescheduled
            ? "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100"
            : stillScheduling
              ? "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100"
              : accepted
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";

  const responseLabel = isDeadEnd
    ? " · Dead End"
    : isHeld
      ? " · Held"
      : declined
        ? " · Declined"
        : noShow
          ? " · No-showed"
          : rescheduled
            ? " · Rescheduled"
            : stillScheduling
              ? " · Still scheduling"
              : accepted
                ? " · Accepted"
                : "";
  const title = `${name}${meeting.title ? " · " + meeting.title : ""}${
    accountName ? " @ " + accountName : ""
  }${time ? " · " + time : ""}${responseLabel}`;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-left border rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-colors ${cls}`}
    >
      {time && <span className="font-semibold mr-1">{time}</span>}
      <span className="truncate">{name}</span>
    </button>
  );
}

// ---- Meeting details modal + card ---------------------------------

function MeetingDetailsModal(props: {
  meeting: Meeting;
  updates: MeetingUpdate[];
  accountNameById: Record<string, string>;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onMarkDeadEnd: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
  onSetProspectResponse: (r: ProspectResponse) => void;
  onSetHeldOutcome: (o: HeldOutcome | null) => void;
  onSetNotes: (notes: string) => void;
  onAddUpdate: (text: string) => void;
  onRemoveUpdate: (id: string) => void;
}) {
  const { onClose } = props;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Meeting details</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <MeetingCard {...props} />
        </div>
      </div>
    </div>
  );
}

function MeetingCard({
  meeting,
  updates,
  accountNameById,
  onEdit,
  onConvert,
  onMoveBack,
  onDelete,
  onSetProspectResponse,
  onSetHeldOutcome,
  onSetNotes,
  onAddUpdate,
  onRemoveUpdate,
  onMarkDeadEnd,
}: {
  meeting: Meeting;
  updates: MeetingUpdate[];
  accountNameById: Record<string, string>;
  onEdit: () => void;
  onConvert: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
  onMarkDeadEnd: () => void;
  onSetProspectResponse: (r: ProspectResponse) => void;
  onSetHeldOutcome: (o: HeldOutcome | null) => void;
  onSetNotes: (notes: string) => void;
  onAddUpdate: (text: string) => void;
  onRemoveUpdate: (id: string) => void;
}) {
  const fullName =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed contact)";
  const accountName = meeting.accountId
    ? accountNameById[meeting.accountId] ?? "(deleted account)"
    : null;
  const pastDue = meeting.status === "booked" && isPastDue(meeting.scheduledFor);
  const imageSrc = useImage(meeting.imageKey);
  const [viewingImage, setViewingImage] = useState(false);

  return (
    <li className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2.5 list-none">
      <div className="flex items-start justify-between gap-3">
        {meeting.imageKey && (
          <button
            onClick={() => setViewingImage(true)}
            className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-100"
            title="View saved screenshot"
            aria-label="View saved screenshot"
          >
            {imageSrc && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageSrc}
                alt={`Screenshot for ${fullName}`}
                className="w-full h-full object-cover"
              />
            )}
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {fullName}
            </span>
            {meeting.title && (
              <span className="text-xs text-slate-500">· {meeting.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-500">
            {accountName && (
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />
                {accountName}
              </span>
            )}
            {meeting.ese && (
              <span
                className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded"
                title="Enterprise Sales Executive"
              >
                ESE: {meeting.ese}
              </span>
            )}
            {meeting.bookedCategory && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                  meeting.bookedCategory === "confirmed"
                    ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                    : "bg-yellow-50 text-yellow-800 border-yellow-300"
                }`}
                title={
                  meeting.bookedCategory === "confirmed"
                    ? "Time locked in"
                    : "Tentative — time not yet firm"
                }
              >
                {meeting.bookedCategory === "confirmed"
                  ? "Confirmed Booked"
                  : "Soft Booked"}
              </span>
            )}
            {meeting.status === "booked" && (
              <span className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {monthDay(meeting.scheduledFor)}
              </span>
            )}
            {meeting.status === "dead-end" && (
              <>
                <span className="flex items-center gap-1 line-through decoration-slate-400">
                  <CalendarClock className="w-3 h-3" />
                  {monthDay(meeting.scheduledFor)}
                </span>
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Ban className="w-2.5 h-2.5" />
                  Dead End
                  {meeting.deadEndedAt ? ` · ${heldStamp(meeting.deadEndedAt)}` : ""}
                </span>
              </>
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
            {meeting.status === "booked" ? (
              <ProspectResponsePicker
                value={meeting.prospectResponse ?? "no-response"}
                onChange={onSetProspectResponse}
              />
            ) : (
              meeting.prospectResponse &&
              meeting.prospectResponse !== "no-response" && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    PROSPECT_RESPONSE_BADGE[meeting.prospectResponse]
                  }`}
                >
                  {PROSPECT_RESPONSE_LABEL[meeting.prospectResponse]}
                </span>
              )
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

      {meeting.status === "held" && (
        <HeldOutcomePicker
          value={meeting.heldOutcome ?? null}
          onChange={onSetHeldOutcome}
        />
      )}

      <InlineNotesEditor value={meeting.notes} onSave={onSetNotes} />

      <MeetingUpdatesSection
        updates={updates}
        onAdd={onAddUpdate}
        onRemove={onRemoveUpdate}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onEdit}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        {meeting.status === "booked" && (
          <>
            <button
              onClick={onConvert}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
            >
              <CheckCircle2 className="w-3 h-3" /> Convert to Held
            </button>
            <button
              onClick={onMarkDeadEnd}
              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center gap-1 px-2.5 py-1.5 rounded shadow-sm"
              title="Move to Dead End — nowhere else this meeting can go"
            >
              <Ban className="w-3 h-3" /> Dead End
            </button>
          </>
        )}
        {(meeting.status === "held" || meeting.status === "dead-end") && (
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

      {viewingImage && meeting.imageKey && (
        <div
          onClick={() => setViewingImage(false)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {imageSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageSrc}
              alt={`Screenshot for ${fullName}`}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            onClick={() => setViewingImage(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
            aria-label="Close image preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </li>
  );
}

// ---- New / Edit modal --------------------------------------------

function MeetingModal({
  mode,
  accounts,
  onClose,
  onSave,
}: {
  mode: { kind: "create" } | { kind: "edit"; meeting: Meeting };
  accounts: Account[];
  onClose: () => void;
  onSave: (draft: MeetingDraft, editingId: string | null) => void | Promise<void>;
}) {
  const isEdit = mode.kind === "edit";
  const source = isEdit ? mode.meeting : null;

  const [firstName, setFirstName] = useState(source?.firstName ?? "");
  const [lastName, setLastName] = useState(source?.lastName ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(source?.linkedinUrl ?? "");
  const [accountId, setAccountId] = useState(source?.accountId ?? "");
  const [ese, setEse] = useState(source?.ese ?? "");
  const [bookedCategory, setBookedCategory] = useState<BookedCategory | "">(
    source?.bookedCategory ?? ""
  );
  const [scheduledFor, setScheduledFor] = useState(
    isoToDatetimeLocal(source?.scheduledFor ?? null)
  );
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [imageKey, setImageKey] = useState<string | null>(source?.imageKey ?? null);
  const imageSrc = useImage(imageKey);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Track image keys added in this session but not yet saved to the
  // meeting so we can clean them up on cancel. The one on `source` is
  // never in this set — it's already persisted.
  const uploadedKeysRef = useRef<string[]>([]);

  const supabase = useMemo(() => createClient(), []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImageError(null);
    try {
      const key = await uploadMeetingImage(supabase, file);
      // Best-effort cleanup of the prior in-session upload — the
      // previously saved key stays if the user cancels.
      const previous = imageKey;
      if (previous && uploadedKeysRef.current.includes(previous)) {
        try {
          await deleteMeetingImage(supabase, previous);
        } catch {
          /* ignore */
        }
      }
      uploadedKeysRef.current.push(key);
      setImageKey(key);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      // Reset the input so re-picking the same file re-fires onChange.
      e.target.value = "";
    }
  };

  const handleRemoveImage = async () => {
    const previous = imageKey;
    setImageKey(null);
    setImageError(null);
    if (previous && uploadedKeysRef.current.includes(previous)) {
      try {
        await deleteMeetingImage(supabase, previous);
      } catch {
        /* ignore */
      }
    }
  };

  const submit = async () => {
    if (
      !firstName.trim() &&
      !lastName.trim() &&
      !title.trim() &&
      !linkedinUrl.trim()
    ) {
      setError("Provide at least a name, title, or LinkedIn URL.");
      return;
    }
    const draft: MeetingDraft = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      linkedinUrl: linkedinUrl.trim(),
      accountId: accountId || null,
      scheduledFor: datetimeLocalToIso(scheduledFor),
      notes: notes.trim(),
      status: source?.status ?? "booked",
      imageKey: imageKey,
      prospectResponse: source?.prospectResponse ?? null,
      ese: ese || null,
      heldOutcome: source?.heldOutcome ?? null,
      bookedCategory: (bookedCategory || null) as BookedCategory | null,
    };
    setBusy(true);
    try {
      await onSave(draft, source?.id ?? null);
      // Save succeeded — session-uploaded keys are now attached to a
      // persisted meeting, so drop them from the cleanup list.
      uploadedKeysRef.current = [];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const isDirty = () => {
    if (isEdit && source) {
      return (
        firstName !== source.firstName ||
        lastName !== source.lastName ||
        title !== source.title ||
        linkedinUrl !== source.linkedinUrl ||
        (accountId || null) !== (source.accountId ?? null) ||
        (ese || null) !== (source.ese ?? null) ||
        (bookedCategory || null) !== (source.bookedCategory ?? null) ||
        datetimeLocalToIso(scheduledFor) !== source.scheduledFor ||
        notes !== source.notes ||
        imageKey !== (source.imageKey ?? null)
      );
    }
    return (
      firstName.trim() !== "" ||
      lastName.trim() !== "" ||
      title.trim() !== "" ||
      linkedinUrl.trim() !== "" ||
      !!accountId ||
      !!ese ||
      !!bookedCategory ||
      scheduledFor.trim() !== "" ||
      notes.trim() !== "" ||
      imageKey !== null
    );
  };

  const guardedClose = async () => {
    if (
      isDirty() &&
      !window.confirm(
        "Discard your changes? Everything you've typed in this form will be lost."
      )
    ) {
      return;
    }
    // Clean up any in-session uploads that never made it onto a saved
    // meeting. The user's persisted image (if any) is left alone.
    for (const k of uploadedKeysRef.current) {
      try {
        await deleteMeetingImage(supabase, k);
      } catch {
        /* ignore */
      }
    }
    uploadedKeysRef.current = [];
    onClose();
  };

  return (
    // Backdrop intentionally non-closable — matches the parent Launchpad
    // behaviour so a stray outside-click doesn't nuke a long form.
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 text-slate-800 max-h-[90vh] overflow-y-auto"
        onKeyDown={(e) => {
          if (e.key === "Escape") guardedClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
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
            onClick={guardedClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Screenshot upload (Supabase Storage). AI autofill from image
            lands in the /api/generate commit. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              LinkedIn screenshot (optional)
            </span>
          </div>
          <div className="border-2 border-dashed border-blue-200 rounded-lg h-24 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-blue-50/30 transition-colors">
            {imageKey ? (
              <div className="w-full h-full relative group">
                {imageSrc && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imageSrc}
                    alt="LinkedIn screenshot"
                    className="w-full h-full object-cover opacity-70"
                  />
                )}
                <button
                  onClick={() => void handleRemoveImage()}
                  className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-600 bg-white/80 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  id={`meeting-image-upload-${source?.id ?? "new"}`}
                  className="hidden"
                  onChange={(e) => void handleImageUpload(e)}
                  disabled={uploading}
                />
                <label
                  htmlFor={`meeting-image-upload-${source?.id ?? "new"}`}
                  className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-blue-500 hover:text-blue-700 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                  <span className="text-[11px] font-medium">
                    {uploading ? "Uploading…" : "Click to upload LinkedIn screenshot"}
                  </span>
                </label>
              </>
            )}
          </div>
          {imageError && (
            <p className="text-xs text-red-600 mt-1">{imageError}</p>
          )}
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
              No accounts yet.
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
                  {a.name || "(unnamed)"}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="ESE">
          <select
            value={ese}
            onChange={(e) => setEse(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— No ESE —</option>
            {ESE_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Booked category">
          <select
            value={bookedCategory}
            onChange={(e) => setBookedCategory(e.target.value as BookedCategory | "")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— Not set —</option>
            <option value="confirmed">Confirmed Booked</option>
            <option value="soft">Soft Booked</option>
          </select>
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          />
        </Field>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={guardedClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- FilterBar + MultiSelect --------------------------------------

function FilterBar(props: {
  activeAccounts: Account[];
  filterAccountIds: string[];
  onFilterAccounts: (v: string[]) => void;
  filterEses: string[];
  onFilterEses: (v: string[]) => void;
  filterResponses: ProspectResponse[];
  onFilterResponses: (v: ProspectResponse[]) => void;
  filterStatuses: MeetingStatus[];
  onFilterStatuses: (v: MeetingStatus[]) => void;
  filterBookedCategories: BookedCategory[];
  onFilterBookedCategories: (v: BookedCategory[]) => void;
  anyFilterActive: boolean;
  onClear: () => void;
  matchCount: number;
  totalCount: number;
}) {
  const {
    activeAccounts,
    filterAccountIds,
    onFilterAccounts,
    filterEses,
    onFilterEses,
    filterResponses,
    onFilterResponses,
    filterStatuses,
    onFilterStatuses,
    filterBookedCategories,
    onFilterBookedCategories,
    anyFilterActive,
    onClear,
    matchCount,
    totalCount,
  } = props;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider">
        <Filter className="w-3.5 h-3.5" /> Filter
      </div>

      <FilterMultiSelect
        label="Status"
        allLabel="All"
        selected={filterStatuses}
        onChange={(vs) => onFilterStatuses(vs as MeetingStatus[])}
        options={[
          { value: "booked", label: "Booked" },
          { value: "held", label: "Held" },
          { value: "dead-end", label: "Dead End" },
        ]}
      />
      <FilterMultiSelect
        label="Booked category"
        allLabel="All"
        selected={filterBookedCategories}
        onChange={(vs) => onFilterBookedCategories(vs as BookedCategory[])}
        options={[
          { value: "confirmed", label: "Confirmed Booked" },
          { value: "soft", label: "Soft Booked" },
        ]}
      />
      <FilterMultiSelect
        label="Account"
        allLabel="All accounts"
        selected={filterAccountIds}
        onChange={onFilterAccounts}
        options={activeAccounts.map((a) => ({
          value: a.id,
          label: a.name || "(unnamed)",
        }))}
      />
      <FilterMultiSelect
        label="ESE"
        allLabel="All ESEs"
        selected={filterEses}
        onChange={onFilterEses}
        options={ESE_OPTIONS.map((n) => ({ value: n, label: n }))}
      />
      <FilterMultiSelect
        label="Response"
        allLabel="All responses"
        selected={filterResponses}
        onChange={(vs) => onFilterResponses(vs as ProspectResponse[])}
        options={[
          { value: "no-response", label: "No response yet" },
          { value: "accepted", label: "Prospect accepted" },
          { value: "declined", label: "Prospect declined" },
          { value: "no-show", label: "Prospect no-showed" },
          { value: "rescheduled", label: "Prospect rescheduled" },
          { value: "still-scheduling", label: "Still scheduling" },
        ]}
      />

      <div className="ml-auto flex items-center gap-2 text-slate-500">
        <span>
          {anyFilterActive
            ? `${matchCount} of ${totalCount}`
            : `${totalCount} meeting${totalCount === 1 ? "" : "s"}`}
        </span>
        {anyFilterActive && (
          <button
            onClick={onClear}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-1 font-semibold flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

function FilterMultiSelect({
  label,
  allLabel,
  selected,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  selected: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = selected.length > 0;
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const summary = (() => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label ?? selected[0];
    }
    if (selected.length === 2) {
      const parts = selected.map(
        (v) => options.find((o) => o.value === v)?.label ?? v
      );
      return parts.join(", ");
    }
    return `${selected.length} selected`;
  })();

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
          active
            ? "border-blue-300 bg-blue-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            active ? "text-blue-700" : "text-slate-500"
          }`}
        >
          {label}
          {active && ` (${selected.length})`}
        </span>
        <span className="text-xs text-slate-800 font-medium max-w-40 truncate">
          {summary}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-56 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
          {options.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-3">
              No options available.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>{label}</span>
                {active && (
                  <button
                    onClick={() => onChange([])}
                    className="text-blue-700 hover:text-blue-900 normal-case"
                  >
                    Clear
                  </button>
                )}
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {options.map((o) => {
                  const on = selected.includes(o.value);
                  return (
                    <li key={o.value}>
                      <label className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(o.value)}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                        <span className="flex-1 truncate">{o.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- ProspectResponsePicker / HeldOutcomePicker / Notes / Updates ----

function ProspectResponsePicker({
  value,
  onChange,
}: {
  value: ProspectResponse;
  onChange: (r: ProspectResponse) => void;
}) {
  return (
    <label
      className={`inline-flex items-center text-[10px] font-semibold border rounded px-1 py-0.5 gap-1 focus-within:ring-2 focus-within:ring-blue-400 ${PROSPECT_RESPONSE_BADGE[value]}`}
      title="Prospect's response to the invite"
    >
      <span className="uppercase tracking-wider opacity-70">Response:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProspectResponse)}
        className="bg-transparent border-0 outline-none font-semibold pr-1 cursor-pointer"
      >
        <option value="no-response">No response yet</option>
        <option value="accepted">Prospect accepted</option>
        <option value="declined">Prospect declined</option>
        <option value="no-show">Prospect no-showed</option>
        <option value="rescheduled">Prospect rescheduled</option>
        <option value="still-scheduling">Still scheduling</option>
      </select>
    </label>
  );
}

function HeldOutcomePicker({
  value,
  onChange,
}: {
  value: HeldOutcome | null;
  onChange: (o: HeldOutcome | null) => void;
}) {
  const options: HeldOutcome[] = [
    "opportunity-identified",
    "future-follow-up",
    "dead-end",
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">
        Outcome:
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? null : opt)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                active
                  ? HELD_OUTCOME_STYLE[opt]
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              }`}
              title={
                active ? "Click again to clear" : `Set outcome to "${HELD_OUTCOME_LABEL[opt]}"`
              }
            >
              {HELD_OUTCOME_LABEL[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InlineNotesEditor({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setDraft(value);
  }, [value]);

  const flush = () => {
    if (draft !== value) onSave(draft);
    dirtyRef.current = false;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Notes
        </span>
        {dirtyRef.current && draft !== value && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            Unsaved — click outside to save
          </span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => {
          dirtyRef.current = true;
          setDraft(e.target.value);
        }}
        onBlur={flush}
        placeholder="Context, mutual connections, agenda, follow-up items..."
        rows={2}
        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none p-2 rounded resize-y leading-relaxed"
      />
    </div>
  );
}

function formatUpdateTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MeetingUpdatesSection({
  updates,
  onAdd,
  onRemove,
}: {
  updates: MeetingUpdate[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const clean = draft.trim();
    if (!clean) return;
    onAdd(clean);
    setDraft("");
  };
  const sorted = [...updates].sort((a, b) =>
    b.loggedAt.localeCompare(a.loggedAt)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Updates{updates.length > 0 ? ` (${updates.length})` : ""}
        </span>
      </div>
      <div className="flex gap-2 mb-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Log a dated update (e.g. left voicemail, confirmed via email, sent follow-up)…"
          rows={1}
          className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none p-2 rounded resize-y leading-relaxed"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1 self-start"
          title="Log update (Cmd/Ctrl+Enter)"
        >
          <Plus className="w-3 h-3" /> Log
        </button>
      </div>
      {sorted.length > 0 && (
        <ul className="space-y-1.5">
          {sorted.map((u) => (
            <li
              key={u.id}
              className={`flex items-start gap-2 text-xs border rounded-md p-2 ${
                u.isSystem
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 flex items-center gap-1.5">
                  {u.isSystem && (
                    <span
                      className="inline-flex items-center gap-0.5 bg-slate-200 text-slate-600 uppercase tracking-wider text-[9px] font-bold px-1 py-px rounded"
                      title="Auto-logged by the tracker"
                    >
                      Auto
                    </span>
                  )}
                  {formatUpdateTimestamp(u.loggedAt)}
                </div>
                <div
                  className={`whitespace-pre-wrap leading-relaxed ${
                    u.isSystem ? "text-slate-600 italic" : "text-slate-700"
                  }`}
                >
                  {u.text}
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Delete this update?")) onRemove(u.id);
                }}
                className="text-slate-400 hover:text-red-600 shrink-0"
                title="Delete update"
                aria-label="Delete update"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
