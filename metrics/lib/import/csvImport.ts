// Deterministic CSV → meeting translation.
//
// The AI produces a mapping *plan* (see lib/ai/prompts.ts); everything
// here is plain, reproducible code that applies that plan to every row.
// No AI, no network — so the preview the user sees is exactly what gets
// written, and re-running on the same input always yields the same rows.

import type { ParsedCsv } from "@/lib/lusha-cleanup/parse";
import type { MeetingStatus, ProspectResponse } from "@/lib/types";
import type {
  ImportColumnMapping,
  ImportMappingResult,
} from "@/lib/ai/prompts";

// ---- Column stats for the AI prompt -------------------------------

// For each column, count distinct non-empty values. When a column is
// low-cardinality we hand the model the full distinct set (so it can map
// every status/response value); otherwise we mark it high-cardinality
// free text. Bounded work: one pass over the grid.
export function buildColumnStats(
  parsed: ParsedCsv,
  maxDistinct = 30
): {
  header: string;
  distinctCount: number;
  distinctValues: string[] | null;
}[] {
  return parsed.headers.map((header, col) => {
    const seen = new Set<string>();
    for (const row of parsed.rows) {
      const v = (row[col] ?? "").trim();
      if (v) seen.add(v);
    }
    const distinctCount = seen.size;
    const distinctValues =
      distinctCount > 0 && distinctCount <= maxDistinct
        ? Array.from(seen).sort((a, b) => a.localeCompare(b))
        : null;
    return { header, distinctCount, distinctValues };
  });
}

export function sampleRows(parsed: ParsedCsv, n = 12): string[][] {
  return parsed.rows.slice(0, n);
}

// ---- Loose date parsing -------------------------------------------

// Rep sheets carry every date shape imaginable. Try the native parser
// first (handles ISO and "Aug 5, 2026 2:30 PM"); fall back to an
// explicit M/D/Y matcher (US convention — Toptal's SDRs are US-based),
// including an optional trailing time. Returns an ISO string or null.
export function parseLooseDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // Explicit slash/dash numeric date, optional time — parse as US M/D/Y.
  const m = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/
  );
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    let hour = m[4] ? Number(m[4]) : 0;
    const min = m[5] ? Number(m[5]) : 0;
    const sec = m[6] ? Number(m[6]) : 0;
    const ampm = m[7]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Native fallback (ISO 8601, "Month D, YYYY", etc.).
  const native = new Date(s);
  if (!Number.isNaN(native.getTime())) return native.toISOString();

  return null;
}

// ---- Name splitting -----------------------------------------------

export function splitFullName(full: string): { first: string; last: string } {
  const clean = full.trim().replace(/\s+/g, " ");
  if (!clean) return { first: "", last: "" };
  const parts = clean.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// ---- The editable, normalized plan --------------------------------

export type StatusTarget = MeetingStatus | "skip";
export type ResponseTarget = ProspectResponse | "skip";

// A resolved plan the UI can edit and applyImportPlan can consume. Value
// maps are keyed by the lower-cased raw cell value so lookups are
// case-insensitive.
export interface ImportPlan {
  columns: ImportColumnMapping;
  nameMode: "full" | "split";
  statusMap: Record<string, StatusTarget>;
  responseMap: Record<string, ResponseTarget>;
  // Default status for a row whose status cell is blank or whose column
  // isn't mapped at all. Sheets overwhelmingly list real meetings, so
  // "booked" is the safe default.
  defaultStatus: MeetingStatus;
}

const STATUS_TARGETS: StatusTarget[] = ["booked", "held", "dead-end", "skip"];
const RESPONSE_TARGETS: ResponseTarget[] = [
  "accepted",
  "declined",
  "no-response",
  "no-show",
  "rescheduled",
  "still-scheduling",
  "skip",
];

function coerceStatusTarget(v: string): StatusTarget {
  return (STATUS_TARGETS as string[]).includes(v)
    ? (v as StatusTarget)
    : "booked";
}
function coerceResponseTarget(v: string): ResponseTarget {
  return (RESPONSE_TARGETS as string[]).includes(v)
    ? (v as ResponseTarget)
    : "skip";
}

// Turn the AI result into an editable plan, defaulting name mode from
// whichever name columns it mapped.
export function planFromMappingResult(result: ImportMappingResult): ImportPlan {
  const statusMap: Record<string, StatusTarget> = {};
  for (const e of result.statusValueMap) {
    if (typeof e.from === "string") {
      statusMap[e.from.trim().toLowerCase()] = coerceStatusTarget(e.to);
    }
  }
  const responseMap: Record<string, ResponseTarget> = {};
  for (const e of result.prospectResponseValueMap) {
    if (typeof e.from === "string") {
      responseMap[e.from.trim().toLowerCase()] = coerceResponseTarget(e.to);
    }
  }
  const c = result.columns;
  const nameMode: "full" | "split" =
    c.fullNameColumn && !c.firstNameColumn ? "full" : "split";
  return {
    columns: c,
    nameMode,
    statusMap,
    responseMap,
    defaultStatus: "booked",
  };
}

// ---- Applying the plan --------------------------------------------

export interface TranslatedMeeting {
  rowIndex: number; // 0-based index into parsed.rows
  firstName: string;
  lastName: string;
  title: string;
  companyName: string; // resolved to an accountId at import time
  linkedinUrl: string;
  ese: string | null;
  status: MeetingStatus;
  prospectResponse: ProspectResponse | null;
  scheduledFor: string | null;
  createdAt: string | null;
  heldAt: string | null;
  deadEndedAt: string | null;
  notes: string;
  issues: string[]; // soft warnings — row still imports
}

export interface TranslationResult {
  meetings: TranslatedMeeting[]; // importable rows only (status !== skip)
  skippedCount: number;
  counts: {
    total: number;
    importable: number;
    booked: number;
    held: number;
    deadEnd: number;
    skipped: number;
    missingDate: number;
    missingName: number;
  };
  companyNames: string[]; // distinct, non-empty — seed the Accounts list
  eseNames: string[]; // distinct, non-empty — seed the ESE list
}

function cellByHeader(
  headers: string[],
  row: string[],
  header: string | null
): string {
  if (!header) return "";
  const idx = headers.indexOf(header);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

export function applyImportPlan(
  parsed: ParsedCsv,
  plan: ImportPlan
): TranslationResult {
  const { headers } = parsed;
  const c = plan.columns;
  const meetings: TranslatedMeeting[] = [];
  let skipped = 0;
  let booked = 0;
  let held = 0;
  let deadEnd = 0;
  let missingDate = 0;
  let missingName = 0;
  const companies = new Map<string, string>(); // lower -> display
  const eses = new Map<string, string>(); // lower -> display

  parsed.rows.forEach((row, rowIndex) => {
    // ---- Status ----
    const statusRaw = cellByHeader(headers, row, c.statusColumn);
    let status: MeetingStatus;
    if (!c.statusColumn) {
      status = plan.defaultStatus;
    } else if (!statusRaw) {
      status = plan.defaultStatus;
    } else {
      const mapped = plan.statusMap[statusRaw.toLowerCase()];
      if (mapped === "skip") {
        skipped += 1;
        return;
      }
      status = mapped ?? plan.defaultStatus;
    }

    // ---- Name ----
    let first = "";
    let last = "";
    if (plan.nameMode === "full") {
      const full = cellByHeader(headers, row, c.fullNameColumn);
      ({ first, last } = splitFullName(full));
    } else {
      first = cellByHeader(headers, row, c.firstNameColumn);
      last = cellByHeader(headers, row, c.lastNameColumn);
      // If only a "full name" column exists but nameMode is split by
      // accident, fall back to it.
      if (!first && !last && c.fullNameColumn) {
        ({ first, last } = splitFullName(
          cellByHeader(headers, row, c.fullNameColumn)
        ));
      }
    }

    const title = cellByHeader(headers, row, c.titleColumn);
    const companyName = cellByHeader(headers, row, c.companyColumn);
    const linkedinUrl = cellByHeader(headers, row, c.linkedinUrlColumn);
    const eseRaw = cellByHeader(headers, row, c.eseColumn);

    // ---- Dates ----
    const meetingDate = parseLooseDate(
      cellByHeader(headers, row, c.meetingDateColumn)
    );
    const bookedDate = parseLooseDate(
      cellByHeader(headers, row, c.bookedDateColumn)
    );
    const heldDate = parseLooseDate(
      cellByHeader(headers, row, c.heldDateColumn)
    );

    const scheduledFor = meetingDate ?? heldDate ?? bookedDate;
    // created_at = when it was booked; fall back to the meeting date.
    const createdAt = bookedDate ?? meetingDate ?? heldDate;
    const heldAt =
      status === "held" ? heldDate ?? meetingDate ?? bookedDate : null;
    const deadEndedAt =
      status === "dead-end" ? meetingDate ?? heldDate ?? bookedDate : null;

    // ---- Prospect response ----
    let prospectResponse: ProspectResponse | null = null;
    if (c.prospectResponseColumn) {
      const raw = cellByHeader(headers, row, c.prospectResponseColumn);
      if (raw) {
        const mapped = plan.responseMap[raw.toLowerCase()];
        if (mapped && mapped !== "skip") prospectResponse = mapped;
      }
    }

    // ---- Notes (fold in every preserved column, labeled) ----
    const noteParts: string[] = [];
    for (const h of c.notesColumns) {
      const v = cellByHeader(headers, row, h);
      if (v) noteParts.push(`${h}: ${v}`);
    }
    const notes = noteParts.join("\n");

    // ---- Soft issues ----
    const issues: string[] = [];
    if (!scheduledFor) {
      issues.push("no date");
      missingDate += 1;
    }
    if (!first && !last) {
      issues.push("no name");
      missingName += 1;
    }

    if (status === "held") held += 1;
    else if (status === "dead-end") deadEnd += 1;
    else booked += 1;

    if (companyName) {
      const key = companyName.toLowerCase();
      if (!companies.has(key)) companies.set(key, companyName);
    }
    if (eseRaw) {
      const key = eseRaw.toLowerCase();
      if (!eses.has(key)) eses.set(key, eseRaw);
    }

    meetings.push({
      rowIndex,
      firstName: first,
      lastName: last,
      title,
      companyName,
      linkedinUrl,
      ese: eseRaw || null,
      status,
      prospectResponse,
      scheduledFor,
      createdAt,
      heldAt,
      deadEndedAt,
      notes,
      issues,
    });
  });

  return {
    meetings,
    skippedCount: skipped,
    counts: {
      total: parsed.rows.length,
      importable: meetings.length,
      booked,
      held,
      deadEnd,
      skipped,
      missingDate,
      missingName,
    },
    companyNames: Array.from(companies.values()),
    eseNames: Array.from(eses.values()),
  };
}

export { STATUS_TARGETS, RESPONSE_TARGETS };
