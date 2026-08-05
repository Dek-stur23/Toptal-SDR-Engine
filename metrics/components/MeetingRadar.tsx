"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type {
  Meeting,
  Opportunity,
  OpportunityUpdate,
  ProspectResponse,
} from "@/lib/types";
import {
  OPPORTUNITY_STATUS_BADGE,
  OPPORTUNITY_STATUS_LABEL,
} from "@/components/OpportunitySection";
import type {
  MeetingEmailInviteStatus,
  MeetingEmailResult,
} from "@/lib/ai/prompts";

// ---- Invite status model ------------------------------------------
//
// The Radar collapses the meeting's six prospect-response values into
// the three buckets the SDR cares about at a glance: has the prospect
// accepted the invite, declined it, or not yet responded. The full
// six-way picker still lives on the Meetings Tracker.

type Bucket = MeetingEmailInviteStatus; // "not-accepted" | "accepted" | "declined"

function bucketFor(response: ProspectResponse | null): Bucket {
  if (response === "accepted") return "accepted";
  if (response === "declined") return "declined";
  // no-response / still-scheduling / rescheduled / no-show all read as
  // "not yet locked in" from the invite-radar perspective.
  return "not-accepted";
}

const BUCKET_LABEL: Record<Bucket, string> = {
  "not-accepted": "Not yet accepted",
  accepted: "Accepted",
  declined: "Declined",
};

// The prospect_response value we write when the SDR sets a bucket from
// the Radar. "not-accepted" maps back to the neutral no-response value.
const BUCKET_TO_RESPONSE: Record<Bucket, ProspectResponse> = {
  "not-accepted": "no-response",
  accepted: "accepted",
  declined: "declined",
};

const BUCKET_BADGE: Record<Bucket, string> = {
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  "not-accepted": "bg-amber-50 text-amber-700 border-amber-200",
};

// ---- Opportunity staleness model ----------------------------------
//
// An open opportunity is "stale" when nothing has touched it recently.
// The 48h cutoff matches the app-wide isOverdue() definition; we tier it
// so a rep can triage by how cold a deal has gone.
//
// Crucially, "last touched" = the later of the opportunity's own
// updated_at (bumped on field/status edits) and its most recent update
// note's logged_at. Logging a note does NOT bump updated_at, so relying
// on updated_at alone would keep an opp flagged stale right after a rep
// logged activity against it — a false alarm. Folding the update log in
// means logging a note clears the flag, as you'd expect.

const COOLING_MS = 2 * 24 * 60 * 60 * 1000; // 48h
const COLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

type StaleTier = "cooling" | "cold";

function lastActivityMs(opp: Opportunity, updates: OpportunityUpdate[]): number {
  let t = new Date(opp.updatedAt).getTime();
  if (!Number.isFinite(t)) t = 0;
  for (const u of updates) {
    const ut = new Date(u.loggedAt).getTime();
    if (Number.isFinite(ut) && ut > t) t = ut;
  }
  return t;
}

function staleTier(idleMs: number): StaleTier | null {
  if (idleMs > COLD_MS) return "cold";
  if (idleMs > COOLING_MS) return "cooling";
  return null;
}

const STALE_TIER_LABEL: Record<StaleTier, string> = {
  cooling: "Cooling",
  cold: "Cold",
};

const STALE_TIER_BADGE: Record<StaleTier, string> = {
  cooling: "bg-amber-50 text-amber-700 border-amber-200",
  cold: "bg-red-50 text-red-700 border-red-200",
};

const STALE_TIER_ACCENT: Record<StaleTier, string> = {
  cooling: "border-l-amber-400",
  cold: "border-l-red-500",
};

// Coarse "3 days ago" / "5 hours ago" for the last-touched label.
function agoLabel(sinceMs: number): string {
  const hrs = Math.floor(sinceMs / (60 * 60 * 1000));
  if (hrs < 1) return "under an hour ago";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---- Time helpers -------------------------------------------------

function fullWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Human "in 3 days" / "tomorrow" / "today" / "2 days ago". Coarse by
// design — the Radar cares about proximity, not exact minutes.
function relativeWhen(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(d) - startOfDay(now)) / (24 * 60 * 60 * 1000)
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  if (dayDiff === -1) return "Yesterday";
  if (dayDiff > 1) return `In ${dayDiff} days`;
  return `${Math.abs(dayDiff)} days ago`;
}

// ---- Window presets -----------------------------------------------

type WindowKey = "7" | "30" | "all";

const WINDOWS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: "7", label: "Next 7 days", days: 7 },
  { key: "30", label: "Next 30 days", days: 30 },
  { key: "all", label: "All upcoming", days: null },
];

// ---- Per-meeting email draft state --------------------------------

interface EmailState {
  loading: boolean;
  error: string | null;
  result: MeetingEmailResult | null;
}

// ---- Root ---------------------------------------------------------

// Rendered as a view inside Meetings Tracker (alongside List / Calendar),
// fed by the Tracker's already-loaded meetings + account map. Invite-status
// changes route back through the Tracker's own handler so the write, the
// shared state, and the auto-logged update all stay in one place.
export function MeetingRadarView({
  meetings,
  accountNameById,
  senderName,
  opportunities,
  oppUpdatesByOppId,
  onSetProspectResponse,
  onOpenMeeting,
  onAddOpportunityUpdate,
}: {
  meetings: Meeting[];
  accountNameById: Record<string, string>;
  senderName: string | null;
  opportunities: Opportunity[];
  oppUpdatesByOppId: Record<string, OpportunityUpdate[]>;
  onSetProspectResponse: (
    id: string,
    response: ProspectResponse
  ) => void | Promise<void>;
  onOpenMeeting: (meetingId: string) => void;
  onAddOpportunityUpdate: (
    opportunityId: string,
    text: string
  ) => void | Promise<void>;
}) {
  const [windowKey, setWindowKey] = useState<WindowKey>("7");
  const [emailById, setEmailById] = useState<Record<string, EmailState>>({});

  // A single "now" captured on mount keeps the relative labels and the
  // window filter stable across re-renders within a session.
  const now = useMemo(() => new Date(), []);

  // Stale opportunities: open opps whose last activity (edit OR logged
  // note) crossed the 48h line, most-stale first. Parent meeting is
  // resolved against the (already filtered) meetings list, so the
  // FilterBar narrows opps the same way it narrows the meeting list.
  const staleOpps = useMemo(() => {
    const rows: {
      opp: Opportunity;
      meeting: Meeting;
      tier: StaleTier;
      idleMs: number;
    }[] = [];
    for (const opp of opportunities) {
      if (opp.status !== "open") continue;
      const updates = oppUpdatesByOppId[opp.id] ?? [];
      const idleMs = now.getTime() - lastActivityMs(opp, updates);
      const tier = staleTier(idleMs);
      if (!tier) continue;
      const meeting = meetings.find((m) => m.id === opp.meetingId);
      if (!meeting) continue;
      rows.push({ opp, meeting, tier, idleMs });
    }
    rows.sort((a, b) => b.idleMs - a.idleMs); // stalest first
    return rows;
  }, [opportunities, oppUpdatesByOppId, meetings, now]);

  const staleCounts = useMemo(() => {
    let cooling = 0;
    let cold = 0;
    for (const r of staleOpps) {
      if (r.tier === "cold") cold += 1;
      else cooling += 1;
    }
    return { cooling, cold, total: staleOpps.length };
  }, [staleOpps]);

  // Upcoming = still-booked meetings with a scheduled time from the
  // start of today forward, within the selected window. Sorted
  // soonest-first.
  const upcoming = useMemo(() => {
    const win = WINDOWS.find((w) => w.key === windowKey);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const cutoff =
      win && win.days !== null
        ? startOfToday + win.days * 24 * 60 * 60 * 1000
        : null;
    return meetings
      .filter((m) => {
        if (m.status !== "booked" || !m.scheduledFor) return false;
        const t = new Date(m.scheduledFor).getTime();
        if (Number.isNaN(t)) return false;
        if (t < startOfToday) return false;
        if (cutoff !== null && t > cutoff) return false;
        return true;
      })
      .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  }, [meetings, windowKey, now]);

  const counts = useMemo(() => {
    const c = { total: upcoming.length, accepted: 0, declined: 0, notAccepted: 0 };
    for (const m of upcoming) {
      const b = bucketFor(m.prospectResponse);
      if (b === "accepted") c.accepted += 1;
      else if (b === "declined") c.declined += 1;
      else c.notAccepted += 1;
    }
    return c;
  }, [upcoming]);

  const nextMeeting = upcoming[0] ?? null;

  // ---- Mutations ----

  // Setting an invite bucket writes the mapped prospect_response through
  // the Tracker's handler, which owns the DB write, the shared meetings
  // state, and the auto-logged update. The change flows back to us as a
  // fresh `meetings` prop.
  const setInviteBucket = (id: string, bucket: Bucket) => {
    const current = meetings.find((m) => m.id === id);
    if (!current) return;
    if (bucketFor(current.prospectResponse) === bucket) return;
    void onSetProspectResponse(id, BUCKET_TO_RESPONSE[bucket]);
  };

  const generateEmail = async (m: Meeting) => {
    setEmailById((prev) => ({
      ...prev,
      [m.id]: { loading: true, error: null, result: prev[m.id]?.result ?? null },
    }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "meeting-email",
          emailContext: {
            prospectFirstName: m.firstName,
            prospectLastName: m.lastName,
            prospectTitle: m.title,
            accountName: m.accountId
              ? accountNameById[m.accountId] ?? null
              : null,
            scheduledForLabel: fullWhen(m.scheduledFor),
            inviteStatus: bucketFor(m.prospectResponse),
            eseName: m.ese,
            senderName,
            notes: m.notes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          res.status === 429
            ? "Monthly AI limit reached — try again next month."
            : data?.error || "Draft failed.";
        setEmailById((prev) => ({
          ...prev,
          [m.id]: { loading: false, error: msg, result: prev[m.id]?.result ?? null },
        }));
        return;
      }
      setEmailById((prev) => ({
        ...prev,
        [m.id]: {
          loading: false,
          error: null,
          result: data.result as MeetingEmailResult,
        },
      }));
    } catch (e) {
      setEmailById((prev) => ({
        ...prev,
        [m.id]: {
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          result: prev[m.id]?.result ?? null,
        },
      }));
    }
  };

  return (
    <div className="space-y-8">
      {/* ---- Section A: Opportunities needing a touch ---- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs a touch ({staleCounts.total})
          </h2>
          {staleCounts.total > 0 && (
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">
                {staleCounts.cooling} cooling
              </span>
              <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-700">
                {staleCounts.cold} cold
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Open opportunities with no edit or logged note in over 48 hours —
          stalest first. Log an update to clear one from the list.
        </p>
        {staleOpps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm italic text-slate-500">
            Nothing going cold — every open opportunity has been touched in the
            last 48 hours. Nice.
          </p>
        ) : (
          <ul className="space-y-2">
            {staleOpps.map(({ opp, meeting, tier, idleMs }) => (
              <StaleOppCard
                key={opp.id}
                opp={opp}
                meeting={meeting}
                accountName={
                  meeting.accountId
                    ? accountNameById[meeting.accountId] ?? null
                    : null
                }
                tier={tier}
                idleLabel={agoLabel(idleMs)}
                onOpen={() => onOpenMeeting(meeting.id)}
                onLogUpdate={(text) => onAddOpportunityUpdate(opp.id, text)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---- Section B: Upcoming meetings ---- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            Upcoming meetings ({counts.total})
          </h2>
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm"
            role="tablist"
            aria-label="Time window"
          >
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => setWindowKey(w.key)}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  windowKey === w.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={windowKey === w.key}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Upcoming" value={counts.total} tone="slate" />
          <SummaryTile label="Accepted" value={counts.accepted} tone="emerald" />
          <SummaryTile
            label="Not yet accepted"
            value={counts.notAccepted}
            tone="amber"
          />
          <SummaryTile label="Declined" value={counts.declined} tone="red" />
        </div>

        {nextMeeting && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>
              Next up:{" "}
              <span className="font-semibold">
                {`${nextMeeting.firstName} ${nextMeeting.lastName}`.trim() ||
                  "(unnamed prospect)"}
              </span>{" "}
              — {relativeWhen(nextMeeting.scheduledFor, now)},{" "}
              {fullWhen(nextMeeting.scheduledFor)}
            </span>
          </div>
        )}

        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm italic text-slate-500">
            No upcoming booked meetings in this window. Book meetings on the
            Meetings Tracker and they&apos;ll appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((m) => (
              <RadarCard
                key={m.id}
                meeting={m}
                accountName={
                  m.accountId ? accountNameById[m.accountId] ?? null : null
                }
                relative={relativeWhen(m.scheduledFor, now)}
                absolute={fullWhen(m.scheduledFor)}
                email={emailById[m.id] ?? null}
                onSetBucket={(b) => setInviteBucket(m.id, b)}
                onGenerate={() => generateEmail(m)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "red";
}) {
  const toneCls: Record<typeof tone, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className={`text-2xl font-bold ${toneCls[tone]}`}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

// ---- Stale opportunity card ---------------------------------------

function StaleOppCard({
  opp,
  meeting,
  accountName,
  tier,
  idleLabel,
  onOpen,
  onLogUpdate,
}: {
  opp: Opportunity;
  meeting: Meeting;
  accountName: string | null;
  tier: StaleTier;
  idleLabel: string;
  onOpen: () => void;
  onLogUpdate: (text: string) => void | Promise<void>;
}) {
  const [logging, setLogging] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const prospect =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed contact)";

  const save = async () => {
    const clean = text.trim();
    if (!clean || saving) return;
    setSaving(true);
    try {
      await onLogUpdate(clean);
      // The parent's refreshed update log drops this card from the stale
      // list on the next render, so there's no local success state to keep.
      setText("");
      setLogging(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className={`space-y-2 rounded-lg border border-l-4 border-slate-200 bg-white p-3 shadow-sm ${STALE_TIER_ACCENT[tier]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {opp.title || "Untitled opportunity"}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STALE_TIER_BADGE[tier]}`}
            >
              {STALE_TIER_LABEL[tier]} · {idleLabel}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${OPPORTUNITY_STATUS_BADGE[opp.status]}`}
            >
              {OPPORTUNITY_STATUS_LABEL[opp.status]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="truncate font-medium text-slate-700">
              {prospect}
            </span>
            {accountName && (
              <span className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                <Building2 className="h-2.5 w-2.5" />
                {accountName}
              </span>
            )}
            {opp.nextStepOwner && (
              <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                Next step: {opp.nextStepOwner}
              </span>
            )}
          </div>
          {opp.nextStepText && (
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-500">Next: </span>
              {opp.nextStepText}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setLogging((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Log update
          </button>
          <button
            onClick={onOpen}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </button>
        </div>
      </div>

      {logging && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save();
            }}
            rows={2}
            autoFocus
            placeholder="What moved? e.g. Left voicemail, emailed pricing, waiting on ESE…"
            className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                setLogging(false);
                setText("");
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={!text.trim() || saving}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save update
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ---- Card ---------------------------------------------------------

function RadarCard({
  meeting,
  accountName,
  relative,
  absolute,
  email,
  onSetBucket,
  onGenerate,
}: {
  meeting: Meeting;
  accountName: string | null;
  relative: string | null;
  absolute: string | null;
  email: EmailState | null;
  onSetBucket: (b: Bucket) => void;
  onGenerate: () => void;
}) {
  const fullName =
    `${meeting.firstName} ${meeting.lastName}`.trim() || "(unnamed prospect)";
  const bucket = bucketFor(meeting.prospectResponse);
  const linkHref = (raw: string) => {
    const t = raw.trim();
    if (!t) return "";
    return t.startsWith("http") ? t : `https://${t}`;
  };

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {fullName}
            </span>
            {meeting.title && (
              <span className="text-xs text-slate-500">· {meeting.title}</span>
            )}
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${BUCKET_BADGE[bucket]}`}
            >
              {BUCKET_LABEL[bucket]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {accountName && (
              <span className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                <Building2 className="h-2.5 w-2.5" />
                {accountName}
              </span>
            )}
            {meeting.ese && (
              <span
                className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700"
                title="Enterprise Sales Executive"
              >
                ESE: {meeting.ese}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {relative ? <span className="font-semibold">{relative}</span> : null}
              {absolute ? ` · ${absolute}` : ""}
            </span>
            {meeting.linkedinUrl && (
              <a
                href={linkHref(meeting.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {meeting.salesloftUrl && (
              <a
                href={linkHref(meeting.salesloftUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3 w-3" /> SalesLoft
              </a>
            )}
          </div>
        </div>

        <BucketPicker value={bucket} onChange={onSetBucket} />
      </div>

      <EmailDrafter email={email} onGenerate={onGenerate} />
    </li>
  );
}

function BucketPicker({
  value,
  onChange,
}: {
  value: Bucket;
  onChange: (b: Bucket) => void;
}) {
  const opts: { key: Bucket; label: string; activeCls: string }[] = [
    {
      key: "accepted",
      label: "Accepted",
      activeCls: "bg-emerald-600 text-white",
    },
    {
      key: "not-accepted",
      label: "No response",
      activeCls: "bg-amber-500 text-white",
    },
    { key: "declined", label: "Declined", activeCls: "bg-red-600 text-white" },
  ];
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold"
      role="group"
      aria-label="Invite status"
    >
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded px-2 py-1 transition-colors ${
            value === o.key
              ? o.activeCls
              : "text-slate-500 hover:text-slate-800"
          }`}
          aria-pressed={value === o.key}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmailDrafter({
  email,
  onGenerate,
}: {
  email: EmailState | null;
  onGenerate: () => void;
}) {
  const loading = email?.loading ?? false;
  const result = email?.result ?? null;
  const err = email?.error ?? null;

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Mail className="h-3.5 w-3.5" />
          Prospect email
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : result ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Drafting…" : result ? "Regenerate" : "Draft email"}
        </button>
      </div>

      {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}

      {result && !loading && (
        <div className="mt-3 space-y-2">
          <CopyField label="Subject" value={result.subject} multiline={false} />
          <CopyField label="Body" value={result.body} multiline />
        </div>
      )}
    </div>
  );
}

function CopyField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions / insecure context). The
      // text is still visible for manual selection, so fail quietly.
    }
  };
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      {multiline ? (
        <pre className="whitespace-pre-wrap px-2.5 py-2 font-sans text-xs leading-relaxed text-slate-800">
          {value}
        </pre>
      ) : (
        <p className="px-2.5 py-2 text-xs font-medium text-slate-800">{value}</p>
      )}
    </div>
  );
}
