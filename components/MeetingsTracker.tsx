"use client";

import { useMemo, useState } from "react";
import {
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
};

// Chip color classes per response — matches the platform's existing
// green/red/slate accent palette.
const PROSPECT_RESPONSE_BADGE: Record<
  import("@/lib/types").ProspectResponse,
  string
> = {
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  "no-response": "bg-slate-50 text-slate-600 border-slate-200",
};

export function MeetingsTracker({
  state,
  onMutateMeetings,
  isHeldSectionOpen,
  onToggleHeldSection,
  meetingsView,
  onSetMeetingsView,
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

  const setProspectResponse = (
    id: number,
    response: import("@/lib/types").ProspectResponse,
  ) => {
    onMutateMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, prospectResponse: response } : m)),
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

      {meetingsView === "calendar" ? (
        <CalendarView
          meetings={state.meetings}
          accountNameById={accountNameById}
          onOpenMeeting={(m) => setModalMode({ kind: "edit", meeting: m })}
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
                onMoveBack={() => moveBackToBooked(m.id)}
                onDelete={() => deleteMeeting(m.id)}
                onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
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
                  onSetProspectResponse={(r) => setProspectResponse(m.id, r)}
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
  const declined = meeting.prospectResponse === "declined";
  const accepted = meeting.prospectResponse === "accepted";

  // Color: held=emerald, declined=red, accepted booked=blue-strong,
  // no-response booked=blue-soft.
  const cls = isHeld
    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
    : declined
      ? "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
      : accepted
        ? "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200"
        : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100";

  const title = `${name}${meeting.title ? " · " + meeting.title : ""}${accountName ? " @ " + accountName : ""}${time ? " · " + time : ""}${isHeld ? " · Held" : declined ? " · Declined" : accepted ? " · Accepted" : ""}`;

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

function MeetingCard({
  meeting,
  accountNameById,
  onEdit,
  onConvert,
  onMoveBack,
  onDelete,
  onSetProspectResponse,
}: {
  meeting: Meeting;
  accountNameById: Record<string, string>;
  onEdit: () => void;
  onConvert: () => void;
  onMoveBack: () => void;
  onDelete: () => void;
  onSetProspectResponse: (
    r: import("@/lib/types").ProspectResponse,
  ) => void;
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
      </select>
    </label>
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
