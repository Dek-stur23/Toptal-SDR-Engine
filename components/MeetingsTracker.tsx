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
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { Account, AppState, Meeting } from "@/lib/types";
import { genId } from "@/lib/ids";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_HOTLIST_AUTOFILL_GEM } from "@/lib/gems";
import { loadImage, putImage } from "@/lib/imageStore";
import { useImage } from "@/lib/useImage";

interface Props {
  state: AppState;
  onMutateMeetings: (updater: (prev: Meeting[]) => Meeting[]) => void;
  isHeldSectionOpen: boolean;
  onToggleHeldSection: () => void;
  isDeadEndSectionOpen: boolean;
  onToggleDeadEndSection: () => void;
  meetingsView: import("@/lib/types").MeetingsView;
  onSetMeetingsView: (
    view: import("@/lib/types").MeetingsView,
  ) => void;
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

// Append an auto-logged update entry to a meeting. Used by every
// mutation path so the update log builds a running history without
// the user having to type anything.
function withAutoUpdate(m: Meeting, text: string): Meeting {
  return {
    ...m,
    updates: [
      ...(m.updates ?? []),
      { id: genId(), timestamp: Date.now(), text, system: true },
    ],
  };
}

// Returns a short human-readable summary of what changed between two
// versions of the same meeting, for the auto-log entry that fires when
// the user saves the Edit meeting modal. Empty string if nothing
// changed (which suppresses the auto-log).
function describeMeetingChanges(before: Meeting, after: Meeting): string {
  const changed: string[] = [];
  if (
    before.firstName !== after.firstName ||
    before.lastName !== after.lastName
  )
    changed.push("name");
  if (before.title !== after.title) changed.push("title");
  if (before.linkedinUrl !== after.linkedinUrl)
    changed.push("LinkedIn URL");
  if ((before.accountId ?? "") !== (after.accountId ?? ""))
    changed.push("account");
  if ((before.ese ?? "") !== (after.ese ?? "")) changed.push("ESE");
  if ((before.bookedCategory ?? "") !== (after.bookedCategory ?? ""))
    changed.push("booked category");
  if (before.scheduledFor !== after.scheduledFor)
    changed.push("scheduled time");
  if (before.notes !== after.notes) changed.push("notes");
  if ((before.image ?? null) !== (after.image ?? null))
    changed.push("screenshot");
  if (changed.length === 0) return "";
  return `Meeting details updated: ${changed.join(", ")}`;
}

function isPastDue(iso: string, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

// Enterprise Sales Executives that meetings can be tagged to. The list
// is hardcoded on purpose — these are the four ESEs the team works with.
// Extend here if the roster changes.
const ESE_OPTIONS = [
  "Dan Weldon",
  "Ryan Abraham",
  "Blake Harvey",
  "Matt Schneider",
] as const;

const PROSPECT_RESPONSE_LABEL: Record<
  import("@/lib/types").ProspectResponse,
  string
> = {
  accepted: "Prospect accepted",
  declined: "Prospect declined",
  "no-response": "No response yet",
  "no-show": "Prospect no-showed",
  rescheduled: "Prospect rescheduled",
  "still-scheduling": "Still scheduling",
};

// Chip color classes per response. Each state gets its own accent so
// they're distinguishable at a glance in the list and calendar views:
//   accepted → emerald
//   declined → red
//   no-response → slate
//   no-show → amber
//   rescheduled → sky
//   still-scheduling → teal (in-progress positive; between emerald and
//                            sky semantically)
const PROSPECT_RESPONSE_BADGE: Record<
  import("@/lib/types").ProspectResponse,
  string
> = {
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  "no-response": "bg-slate-50 text-slate-600 border-slate-200",
  "no-show": "bg-amber-50 text-amber-700 border-amber-200",
  rescheduled: "bg-sky-50 text-sky-700 border-sky-200",
  "still-scheduling": "bg-teal-50 text-teal-700 border-teal-200",
};

export function MeetingsTracker({
  state,
  onMutateMeetings,
  isHeldSectionOpen,
  onToggleHeldSection,
  isDeadEndSectionOpen,
  onToggleDeadEndSection,
  meetingsView,
  onSetMeetingsView,
}: Props) {
  const [modalMode, setModalMode] = useState<
    { kind: "create" } | { kind: "edit"; meeting: Meeting } | null
  >(null);
  // Details popup shown when a calendar chip is clicked. Holds a
  // meeting id (not the meeting itself) so it stays in sync as the
  // user mutates the meeting via the card controls inside it.
  const [viewingMeetingId, setViewingMeetingId] = useState<number | null>(
    null,
  );
  const viewingMeeting =
    viewingMeetingId !== null
      ? state.meetings.find((x) => x.id === viewingMeetingId) ?? null
      : null;

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

  // Filter state — session-local, resets on reload. Empty array = "all".
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const [filterEses, setFilterEses] = useState<string[]>([]);
  const [filterResponses, setFilterResponses] = useState<
    import("@/lib/types").ProspectResponse[]
  >([]);
  const [filterStatuses, setFilterStatuses] = useState<
    import("@/lib/types").MeetingStatus[]
  >([]);
  const [filterBookedCategories, setFilterBookedCategories] = useState<
    import("@/lib/types").BookedCategory[]
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

  // Apply filters BEFORE slicing into booked/held so both sections and
  // the calendar view see the same filtered set.
  const filteredMeetings = useMemo(() => {
    if (!anyFilterActive) return state.meetings;
    return state.meetings.filter((m) => {
      if (
        filterAccountIds.length > 0 &&
        !(m.accountId && filterAccountIds.includes(m.accountId))
      ) {
        return false;
      }
      if (
        filterEses.length > 0 &&
        !(m.ese && filterEses.includes(m.ese))
      ) {
        return false;
      }
      if (
        filterStatuses.length > 0 &&
        !filterStatuses.includes(m.status)
      ) {
        return false;
      }
      if (filterResponses.length > 0) {
        const r = m.prospectResponse ?? "no-response";
        if (!filterResponses.includes(r)) return false;
      }
      if (filterBookedCategories.length > 0) {
        if (
          !m.bookedCategory ||
          !filterBookedCategories.includes(m.bookedCategory)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    state.meetings,
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
          // Ascending by scheduledFor; empties last.
          if (!a.scheduledFor) return 1;
          if (!b.scheduledFor) return -1;
          return a.scheduledFor.localeCompare(b.scheduledFor);
        }),
    [filteredMeetings],
  );

  const held = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.status === "held")
        .slice()
        .sort((a, b) => (b.heldAt ?? 0) - (a.heldAt ?? 0)),
    [filteredMeetings],
  );

  const deadEnd = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.status === "dead-end")
        .slice()
        .sort((a, b) => (b.deadEndedAt ?? 0) - (a.deadEndedAt ?? 0)),
    [filteredMeetings],
  );

  const upsertMeeting = (m: Meeting) => {
    onMutateMeetings((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx === -1) {
        // New meeting — auto-log its creation.
        return [...prev, withAutoUpdate(m, "Meeting logged")];
      }
      const existing = prev[idx];
      const change = describeMeetingChanges(existing, m);
      const nextEntry = change ? withAutoUpdate(m, change) : m;
      const next = prev.slice();
      next[idx] = nextEntry;
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
        m.id === id
          ? withAutoUpdate(
              { ...m, status: "held", heldAt: Date.now() },
              "Marked as held",
            )
          : m,
      ),
    );
  };

  const markDeadEnd = (id: number) => {
    if (
      !window.confirm(
        "Mark this meeting as a dead end? It will move to the Dead End section with no further next steps.",
      )
    ) {
      return;
    }
    onMutateMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? withAutoUpdate(
              { ...m, status: "dead-end", deadEndedAt: Date.now() },
              "Marked as dead end",
            )
          : m,
      ),
    );
  };

  const setProspectResponse = (
    id: number,
    response: import("@/lib/types").ProspectResponse,
  ) => {
    onMutateMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const previous = m.prospectResponse ?? "no-response";
        if (previous === response) return m;
        return withAutoUpdate(
          { ...m, prospectResponse: response },
          `Response set to "${PROSPECT_RESPONSE_LABEL[response]}"`,
        );
      }),
    );
  };

  const setHeldOutcome = (
    id: number,
    outcome: import("@/lib/types").HeldOutcome | null,
  ) => {
    onMutateMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const previous = m.heldOutcome ?? null;
        if (previous === outcome) return m;
        const patched = outcome
          ? { ...m, heldOutcome: outcome }
          : (({ heldOutcome: _drop, ...rest }) => rest as Meeting)(m);
        return withAutoUpdate(
          patched,
          outcome
            ? `Held outcome set to "${HELD_OUTCOME_LABEL[outcome]}"`
            : "Held outcome cleared",
        );
      }),
    );
  };

  const setMeetingNotes = (id: number, notes: string) => {
    onMutateMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, notes } : m)),
    );
  };

  const addMeetingUpdate = (id: number, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    onMutateMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              updates: [
                ...(m.updates ?? []),
                { id: genId(), timestamp: Date.now(), text: clean },
              ],
            }
          : m,
      ),
    );
  };

  const removeMeetingUpdate = (meetingId: number, updateId: number) => {
    onMutateMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              updates: (m.updates ?? []).filter((u) => u.id !== updateId),
            }
          : m,
      ),
    );
  };

  const moveBackToBooked = (id: number) => {
    onMutateMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const from =
          m.status === "held"
            ? "Held"
            : m.status === "dead-end"
              ? "Dead End"
              : "Booked";
        if (from === "Booked") return m;
        return withAutoUpdate(
          {
            ...m,
            status: "booked",
            heldAt: undefined,
            deadEndedAt: undefined,
          },
          `Moved from ${from} back to Booked`,
        );
      }),
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
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs font-semibold"
            role="tablist"
            aria-label="Meetings view"
          >
            <button
              onClick={() => onSetMeetingsView("list")}
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
              onClick={() => onSetMeetingsView("calendar")}
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
        totalCount={state.meetings.length}
      />

      {meetingsView === "calendar" ? (
        <CalendarView
          meetings={filteredMeetings}
          accountNameById={accountNameById}
          onOpenMeeting={(m) => setViewingMeetingId(m.id)}
        />
      ) : (
      <>
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
                onMarkDeadEnd={() => markDeadEnd(m.id)}
                onMoveBack={() => moveBackToBooked(m.id)}
                onDelete={() => deleteMeeting(m.id)}
                onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                onSetNotes={(n) => setMeetingNotes(m.id, n)}
                onAddUpdate={(t) => addMeetingUpdate(m.id, t)}
                onRemoveUpdate={(uid) => removeMeetingUpdate(m.id, uid)}
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
                  onMarkDeadEnd={() => markDeadEnd(m.id)}
                  onMoveBack={() => moveBackToBooked(m.id)}
                  onDelete={() => deleteMeeting(m.id)}
                  onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                  onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                  onSetNotes={(n) => setMeetingNotes(m.id, n)}
                  onAddUpdate={(t) => addMeetingUpdate(m.id, t)}
                  onRemoveUpdate={(uid) => removeMeetingUpdate(m.id, uid)}
                />
              ))}
            </ul>
          )
        )}
      </section>

      {/* Dead End (collapsible) */}
      <section className="space-y-3">
        <button
          onClick={onToggleDeadEndSection}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
        >
          <span>Dead End ({deadEnd.length})</span>
          {isDeadEndSectionOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {isDeadEndSectionOpen && (
          deadEnd.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No dead-end meetings. Meetings you mark as dead ends will
              land here.
            </p>
          ) : (
            <ul className="space-y-2">
              {deadEnd.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  accountNameById={accountNameById}
                  onEdit={() => setModalMode({ kind: "edit", meeting: m })}
                  onConvert={() => convertToHeld(m.id)}
                  onMarkDeadEnd={() => markDeadEnd(m.id)}
                  onMoveBack={() => moveBackToBooked(m.id)}
                  onDelete={() => deleteMeeting(m.id)}
                  onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
                  onSetHeldOutcome={(o) => setHeldOutcome(m.id, o)}
                  onSetNotes={(n) => setMeetingNotes(m.id, n)}
                  onAddUpdate={(t) => addMeetingUpdate(m.id, t)}
                  onRemoveUpdate={(uid) => removeMeetingUpdate(m.id, uid)}
                />
              ))}
            </ul>
          )
        )}
      </section>
      </>
      )}

      {modalMode && (
        <MeetingModal
          mode={modalMode}
          accounts={activeAccounts}
          onClose={() => setModalMode(null)}
          onSave={upsertMeeting}
        />
      )}

      {viewingMeeting && (
        <MeetingDetailsModal
          meeting={viewingMeeting}
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
            deleteMeeting(viewingMeeting.id);
            setViewingMeetingId(null);
          }}
          onSetProspectResponse={(r) =>
            setProspectResponse(viewingMeeting.id, r)
          }
          onSetHeldOutcome={(o) => setHeldOutcome(viewingMeeting.id, o)}
          onSetNotes={(n) => setMeetingNotes(viewingMeeting.id, n)}
          onAddUpdate={(t) => addMeetingUpdate(viewingMeeting.id, t)}
          onRemoveUpdate={(uid) =>
            removeMeetingUpdate(viewingMeeting.id, uid)
          }
        />
      )}
    </div>
  );
}

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
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Build a grid: 6 rows × 7 columns, Sunday-first, that always covers the
  // whole month plus leading/trailing days from adjacent months so the
  // grid stays a stable rectangle.
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // back to Sunday
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  // Group meetings by YYYY-MM-DD from their scheduledFor field. Skip
  // meetings without a valid scheduledFor.
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    // Sort each day's meetings by time asc.
    for (const arr of map.values()) {
      arr.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
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
  const name =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed)";
  const time = (() => {
    if (!meeting.scheduledFor) return "";
    const d = new Date(meeting.scheduledFor);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  })();
  const accountName = meeting.accountId
    ? (accountNameById[meeting.accountId] ?? "")
    : "";
  const isHeld = meeting.status === "held";
  const isDeadEnd = meeting.status === "dead-end";
  const declined = meeting.prospectResponse === "declined";
  const accepted = meeting.prospectResponse === "accepted";
  const noShow = meeting.prospectResponse === "no-show";
  const rescheduled = meeting.prospectResponse === "rescheduled";
  const stillScheduling = meeting.prospectResponse === "still-scheduling";

  // Color palette matches the list-view response chip mapping so the
  // same meeting reads the same at a glance across views:
  //   dead-end       → slate strike-through (matches list card)
  //   held           → emerald (matches list "Held" chip)
  //   declined       → red
  //   no-show        → amber
  //   rescheduled    → sky
  //   still-scheduling → teal
  //   accepted booked  → emerald (matches list response chip)
  //   no-response      → slate (matches list response chip)
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
  const title = `${name}${meeting.title ? " · " + meeting.title : ""}${accountName ? " @ " + accountName : ""}${time ? " · " + time : ""}${responseLabel}`;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-left border rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-colors ${cls}`}
    >
      {time && (
        <span className="font-semibold mr-1">{time}</span>
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}

// Details popup shown when a calendar chip is clicked. Wraps a
// MeetingCard so every interaction from the list view (change
// response, add updates, edit fields, convert to held, delete, ...)
// works the same way inside the modal. Backdrop-clickable to close
// since it's primarily a viewer, not a form.
function MeetingDetailsModal({
  meeting,
  accountNameById,
  onClose,
  onEdit,
  onConvert,
  onMarkDeadEnd,
  onMoveBack,
  onDelete,
  onSetProspectResponse,
  onSetHeldOutcome,
  onSetNotes,
  onAddUpdate,
  onRemoveUpdate,
}: {
  meeting: Meeting;
  accountNameById: Record<string, string>;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onMarkDeadEnd: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
  onSetProspectResponse: (
    r: import("@/lib/types").ProspectResponse,
  ) => void;
  onSetHeldOutcome: (
    o: import("@/lib/types").HeldOutcome | null,
  ) => void;
  onSetNotes: (notes: string) => void;
  onAddUpdate: (text: string) => void;
  onRemoveUpdate: (id: number) => void;
}) {
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
            <h3 className="text-base font-bold text-slate-900">
              Meeting details
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
        <div className="p-4">
          <MeetingCard
            meeting={meeting}
            accountNameById={accountNameById}
            onEdit={onEdit}
            onConvert={onConvert}
            onMarkDeadEnd={onMarkDeadEnd}
            onMoveBack={onMoveBack}
            onDelete={onDelete}
            onSetProspectResponse={onSetProspectResponse}
            onSetHeldOutcome={onSetHeldOutcome}
            onSetNotes={onSetNotes}
            onAddUpdate={onAddUpdate}
            onRemoveUpdate={onRemoveUpdate}
          />
        </div>
      </div>
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
  onSetProspectResponse,
  onSetHeldOutcome,
  onSetNotes,
  onAddUpdate,
  onRemoveUpdate,
  onMarkDeadEnd,
}: {
  meeting: Meeting;
  accountNameById: Record<string, string>;
  onEdit: () => void;
  onConvert: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
  onMarkDeadEnd: () => void;
  onSetProspectResponse: (
    r: import("@/lib/types").ProspectResponse,
  ) => void;
  onSetHeldOutcome: (
    o: import("@/lib/types").HeldOutcome | null,
  ) => void;
  onSetNotes: (notes: string) => void;
  onAddUpdate: (text: string) => void;
  onRemoveUpdate: (id: number) => void;
}) {
  const fullName =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed contact)";
  const accountName = meeting.accountId
    ? accountNameById[meeting.accountId] ?? "(deleted account)"
    : null;
  const pastDue = meeting.status === "booked" && isPastDue(meeting.scheduledFor);
  const imageSrc = useImage(meeting.image);
  const [viewingImage, setViewingImage] = useState(false);

  return (
    <li className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        {meeting.image && (
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
                  Dead End{meeting.deadEndedAt ? ` · ${heldStamp(meeting.deadEndedAt)}` : ""}
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

      <InlineNotesEditor
        value={meeting.notes}
        onSave={onSetNotes}
      />

      <MeetingUpdatesSection
        updates={meeting.updates ?? []}
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
        {(meeting.status === "held" ||
          meeting.status === "dead-end") && (
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

      {viewingImage && meeting.image && (
        <div
          onClick={() => setViewingImage(false)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in"
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
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center transition-colors text-xl"
            aria-label="Close image preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
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
  const [ese, setEse] = useState(source?.ese ?? "");
  const [bookedCategory, setBookedCategory] = useState<
    import("@/lib/types").BookedCategory | ""
  >(source?.bookedCategory ?? "");
  const [scheduledFor, setScheduledFor] = useState(source?.scheduledFor ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [image, setImage] = useState<string | null>(source?.image ?? null);
  const imageSrc = useImage(image);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result !== "string") return;
      try {
        const ref = await putImage(reader.result);
        setImage(ref);
      } catch {
        setImage(reader.result);
      }
      setExtractError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setExtractError(null);
  };

  // Attempt to auto-select an account by matching the extracted company
  // name against known account names (case-insensitive, trimmed).
  const matchAccountByCompany = (company: string): string | null => {
    const target = company.trim().toLowerCase();
    if (!target) return null;
    for (const a of accounts) {
      const candidates = [
        a.name,
        a.accountData.companyName,
      ]
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .map((s) => s.toLowerCase());
      if (candidates.some((c) => c === target || c.includes(target) || target.includes(c))) {
        return a.id;
      }
    }
    return null;
  };

  const autofillFromImage = async () => {
    if (!image) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const imageData = await loadImage(image);
      if (!imageData) {
        setExtractError("Could not read the uploaded image.");
        return;
      }
      const schema = {
        type: "OBJECT",
        properties: {
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          title: { type: "STRING" },
          company: { type: "STRING" },
          linkedinUrl: { type: "STRING" },
        },
        required: ["firstName", "lastName", "title", "company", "linkedinUrl"],
      };
      const result = await generateWithClaude<{
        firstName: string;
        lastName: string;
        title: string;
        company: string;
        linkedinUrl: string;
      }>({
        prompt:
          "Extract the visible name, title, company, and LinkedIn URL from this screenshot. Return empty string for any field you cannot read with confidence. Do NOT extract emails or phone numbers.",
        system: DEFAULT_HOTLIST_AUTOFILL_GEM,
        schema,
        image: imageData,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.linkedinUrl) setLinkedinUrl(result.linkedinUrl);
      // Only overwrite the account picker if the extracted company matches
      // an existing account. Otherwise leave whatever the user already picked.
      if (result.company && !accountId) {
        const matched = matchAccountByCompany(result.company);
        if (matched) setAccountId(matched);
      }
    } catch (err) {
      console.error("Meeting autofill error:", err);
      setExtractError(
        err instanceof Error
          ? err.message
          : "Failed to extract details from the screenshot.",
      );
    } finally {
      setExtracting(false);
    }
  };

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
    if (image) meeting.image = image;
    if (ese) meeting.ese = ese;
    if (bookedCategory) meeting.bookedCategory = bookedCategory;
    onSave(meeting);
  };

  // Guard against accidental data loss — closing the modal via the
  // backdrop, X button, Cancel, or Escape confirms first if the user
  // has typed anything (create mode) or made any change (edit mode).
  const isDirty = () => {
    if (isEdit && source) {
      return (
        firstName !== source.firstName ||
        lastName !== source.lastName ||
        title !== source.title ||
        linkedinUrl !== source.linkedinUrl ||
        (accountId || undefined) !== source.accountId ||
        (ese || undefined) !== source.ese ||
        scheduledFor !== source.scheduledFor ||
        notes !== source.notes ||
        image !== (source.image ?? null)
      );
    }
    return (
      firstName.trim() !== "" ||
      lastName.trim() !== "" ||
      title.trim() !== "" ||
      linkedinUrl.trim() !== "" ||
      !!accountId ||
      !!ese ||
      scheduledFor.trim() !== "" ||
      notes.trim() !== "" ||
      image !== null
    );
  };

  const guardedClose = () => {
    if (
      isDirty() &&
      !window.confirm(
        "Discard your changes? Everything you've typed in this form will be lost.",
      )
    ) {
      return;
    }
    onClose();
  };

  return (
    // Backdrop is intentionally non-closable — the form is long enough
    // that a stray click outside the panel used to nuke everything the
    // user typed. Close via the X button, Cancel, or Escape.
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 text-slate-800"
        onKeyDown={(e) => {
          if (e.key === "Escape") guardedClose();
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
            onClick={guardedClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Screenshot upload with AI autofill */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              LinkedIn screenshot (optional)
            </span>
            {image && (
              <button
                onClick={autofillFromImage}
                disabled={extracting}
                className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {extracting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                {extracting ? "Extracting..." : "Autofill from image"}
              </button>
            )}
          </div>
          <div className="border-2 border-dashed border-blue-200 rounded-lg h-24 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-blue-50/30 transition-colors">
            {image ? (
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
                  onClick={removeImage}
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
                  onChange={handleImageUpload}
                />
                <label
                  htmlFor={`meeting-image-upload-${source?.id ?? "new"}`}
                  className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-blue-500 hover:text-blue-700 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                  <span className="text-[11px] font-medium">
                    Click to upload LinkedIn screenshot
                  </span>
                </label>
              </>
            )}
          </div>
          {extractError && (
            <p className="text-xs text-red-600 mt-1">{extractError}</p>
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
            onChange={(e) =>
              setBookedCategory(
                e.target.value as import("@/lib/types").BookedCategory | "",
              )
            }
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y custom-scrollbar"
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

function FilterBar({
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
}: {
  activeAccounts: Account[];
  filterAccountIds: string[];
  onFilterAccounts: (v: string[]) => void;
  filterEses: string[];
  onFilterEses: (v: string[]) => void;
  filterResponses: import("@/lib/types").ProspectResponse[];
  onFilterResponses: (
    v: import("@/lib/types").ProspectResponse[],
  ) => void;
  filterStatuses: import("@/lib/types").MeetingStatus[];
  onFilterStatuses: (
    v: import("@/lib/types").MeetingStatus[],
  ) => void;
  filterBookedCategories: import("@/lib/types").BookedCategory[];
  onFilterBookedCategories: (
    v: import("@/lib/types").BookedCategory[],
  ) => void;
  anyFilterActive: boolean;
  onClear: () => void;
  matchCount: number;
  totalCount: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider">
        <Filter className="w-3.5 h-3.5" /> Filter
      </div>

      <FilterMultiSelect
        label="Status"
        allLabel="All"
        selected={filterStatuses}
        onChange={(vs) =>
          onFilterStatuses(vs as import("@/lib/types").MeetingStatus[])
        }
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
        onChange={(vs) =>
          onFilterBookedCategories(
            vs as import("@/lib/types").BookedCategory[],
          )
        }
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
          label: a.name || a.accountData.companyName || "(unnamed)",
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
        onChange={(vs) =>
          onFilterResponses(vs as import("@/lib/types").ProspectResponse[])
        }
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

// Multi-select filter chip. Click to open a checkbox popover; each
// checkbox toggles that option in/out of the selected array. Empty
// selection is treated as "no filter" (match all). Chip label shows
// the count when >0 selected and lists the values when 1-2 selected.
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
        (v) => options.find((o) => o.value === v)?.label ?? v,
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
              <ul className="max-h-64 overflow-y-auto custom-scrollbar py-1">
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

function ProspectResponsePicker({
  value,
  onChange,
}: {
  value: import("@/lib/types").ProspectResponse;
  onChange: (r: import("@/lib/types").ProspectResponse) => void;
}) {
  return (
    <label
      className={`inline-flex items-center text-[10px] font-semibold border rounded px-1 py-0.5 gap-1 focus-within:ring-2 focus-within:ring-blue-400 ${PROSPECT_RESPONSE_BADGE[value]}`}
      title="Prospect's response to the invite"
    >
      <span className="uppercase tracking-wider opacity-70">Response:</span>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as import("@/lib/types").ProspectResponse)
        }
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

const HELD_OUTCOME_LABEL: Record<import("@/lib/types").HeldOutcome, string> = {
  "opportunity-identified": "Opportunity identified",
  "future-follow-up": "Future follow-up",
  "dead-end": "Dead end",
};

const HELD_OUTCOME_STYLE: Record<import("@/lib/types").HeldOutcome, string> = {
  "opportunity-identified":
    "bg-emerald-100 text-emerald-800 border-emerald-300",
  "future-follow-up": "bg-amber-100 text-amber-800 border-amber-300",
  "dead-end": "bg-red-100 text-red-800 border-red-300",
};

function HeldOutcomePicker({
  value,
  onChange,
}: {
  value: import("@/lib/types").HeldOutcome | null;
  onChange: (o: import("@/lib/types").HeldOutcome | null) => void;
}) {
  const options: import("@/lib/types").HeldOutcome[] = [
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
              title={active ? "Click again to clear" : `Set outcome to "${HELD_OUTCOME_LABEL[opt]}"`}
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

  // Re-sync from the source when it changes underneath us, unless the
  // user has unsaved edits in progress.
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
        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none p-2 rounded resize-y custom-scrollbar leading-relaxed"
      />
    </div>
  );
}

function formatUpdateTimestamp(ms: number): string {
  const d = new Date(ms);
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
  updates: import("@/lib/types").MeetingUpdate[];
  onAdd: (text: string) => void;
  onRemove: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const clean = draft.trim();
    if (!clean) return;
    onAdd(clean);
    setDraft("");
  };
  const sorted = [...updates].sort((a, b) => b.timestamp - a.timestamp);

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
          className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 outline-none p-2 rounded resize-y custom-scrollbar leading-relaxed"
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
                u.system
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 flex items-center gap-1.5">
                  {u.system && (
                    <span
                      className="inline-flex items-center gap-0.5 bg-slate-200 text-slate-600 uppercase tracking-wider text-[9px] font-bold px-1 py-px rounded"
                      title="Auto-logged by the tracker"
                    >
                      Auto
                    </span>
                  )}
                  {formatUpdateTimestamp(u.timestamp)}
                </div>
                <div
                  className={`whitespace-pre-wrap leading-relaxed ${
                    u.system
                      ? "text-slate-600 italic"
                      : "text-slate-700"
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
