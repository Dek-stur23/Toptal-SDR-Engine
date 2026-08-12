// Deterministic aggregation of a dialer export (one row per call) into
// per-(account, prospect, day) rows. The AI produces the mapping plan
// (see lib/ai/prompts.ts); this file does the counting — no AI, fully
// reproducible, so the preview equals what gets written.

import type { ParsedCsv } from "@/lib/lusha-cleanup/parse";
import type {
  CallActivityColumnMapping,
  CallActivityMappingResult,
} from "@/lib/ai/prompts";
import { isTruthyFlag, parseLooseDate } from "@/lib/import/csvImport";

export type DispositionTarget =
  | "connect"
  | "meeting-booked"
  | "no-connect"
  | "skip";

const DISPOSITION_TARGETS: DispositionTarget[] = [
  "connect",
  "meeting-booked",
  "no-connect",
  "skip",
];

export const DISPOSITION_LABEL: Record<DispositionTarget, string> = {
  connect: "Connect",
  "meeting-booked": "Meeting booked",
  "no-connect": "Dial only (no connect)",
  skip: "Skip row",
};

function coerceDisposition(v: string): DispositionTarget {
  return (DISPOSITION_TARGETS as string[]).includes(v)
    ? (v as DispositionTarget)
    : "no-connect";
}

export interface CallActivityPlan {
  columns: CallActivityColumnMapping;
  // Keyed by lower-cased raw disposition value.
  dispositionMap: Record<string, DispositionTarget>;
}

export function planFromCallActivityResult(
  result: CallActivityMappingResult
): CallActivityPlan {
  const dispositionMap: Record<string, DispositionTarget> = {};
  for (const e of result.dispositionValueMap) {
    if (typeof e.from === "string") {
      dispositionMap[e.from.trim().toLowerCase()] = coerceDisposition(e.to);
    }
  }
  return { columns: result.columns, dispositionMap };
}

// ---- Types ----

export interface ActivityGrainRow {
  accountName: string;
  prospectKey: string;
  prospectName: string;
  activityDate: string; // YYYY-MM-DD (local)
  dials: number;
  connects: number;
  meetingsBooked: number;
}

export interface AccountRollup {
  accountName: string;
  dials: number;
  connects: number;
  meetingsBooked: number;
  distinctProspects: number;
}

export interface CallActivityResult {
  grain: ActivityGrainRow[];
  rollups: AccountRollup[];
  accountNames: string[];
  dateRange: { min: string | null; max: string | null };
  counts: {
    totalRows: number;
    dials: number;
    connects: number;
    meetingsBooked: number;
    distinctProspects: number;
    skipped: number;
    missingAccount: number;
    missingDate: number;
  };
}

// ---- Helpers ----

function cell(headers: string[], row: string[], header: string | null): string {
  if (!header) return "";
  const i = headers.indexOf(header);
  return i < 0 ? "" : (row[i] ?? "").trim();
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// A stable identity for distinct-prospect counting: email, else phone
// digits, else lower-cased name. Falls back to a per-row token so
// unidentifiable calls don't all collapse into one "prospect".
function prospectKeyFor(
  email: string,
  phone: string,
  name: string,
  rowIndex: number
): string {
  const e = email.trim().toLowerCase();
  if (e) return `e:${e}`;
  const p = phone.replace(/\D+/g, "");
  if (p) return `p:${p}`;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n) return `n:${n}`;
  return `row:${rowIndex}`;
}

// ---- Shared aggregation ----

// A per-row classification the aggregator consumes. "skip" = not a real
// dial (dropped entirely). Otherwise a call with its account, date, and
// connect/booked flags already decided by whichever front-end classified
// it (AI-plan or fixed-format).
type Classified =
  | "skip"
  | {
      accountName: string; // "" when unknown → counted as missingAccount
      date: string | null; // YYYY-MM-DD, or null → counted as missingDate
      prospectKey: string;
      prospectName: string;
      isConnect: boolean;
      isBooked: boolean;
    };

function aggregateCalls(
  items: Classified[],
  totalRows: number
): CallActivityResult {
  const grain = new Map<string, ActivityGrainRow>();
  const rollupByAccount = new Map<
    string,
    { row: AccountRollup; prospects: Set<string> }
  >();
  const accountNames = new Map<string, string>(); // lower -> display
  const globalProspects = new Set<string>();

  let dials = 0;
  let connects = 0;
  let meetingsBooked = 0;
  let skipped = 0;
  let missingAccount = 0;
  let missingDate = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const it of items) {
    if (it === "skip") {
      skipped += 1;
      continue;
    }
    if (!it.accountName) {
      missingAccount += 1;
      continue;
    }
    if (!it.date) {
      missingDate += 1;
      continue;
    }
    const { date, isConnect, isBooked, prospectKey, prospectName, accountName } =
      it;

    dials += 1;
    if (isConnect) connects += 1;
    if (isBooked) meetingsBooked += 1;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    const accLower = accountName.toLowerCase();
    if (!accountNames.has(accLower)) accountNames.set(accLower, accountName);

    const gKey = `${accLower}||${prospectKey}||${date}`;
    const g = grain.get(gKey);
    if (g) {
      g.dials += 1;
      if (isConnect) g.connects += 1;
      if (isBooked) g.meetingsBooked += 1;
    } else {
      grain.set(gKey, {
        accountName,
        prospectKey,
        prospectName,
        activityDate: date,
        dials: 1,
        connects: isConnect ? 1 : 0,
        meetingsBooked: isBooked ? 1 : 0,
      });
    }

    let r = rollupByAccount.get(accLower);
    if (!r) {
      r = {
        row: {
          accountName,
          dials: 0,
          connects: 0,
          meetingsBooked: 0,
          distinctProspects: 0,
        },
        prospects: new Set<string>(),
      };
      rollupByAccount.set(accLower, r);
    }
    r.row.dials += 1;
    if (isConnect) r.row.connects += 1;
    if (isBooked) r.row.meetingsBooked += 1;
    r.prospects.add(prospectKey);

    globalProspects.add(`${accLower}||${prospectKey}`);
  }

  const rollups = Array.from(rollupByAccount.values())
    .map((r) => ({ ...r.row, distinctProspects: r.prospects.size }))
    .sort((a, b) => b.dials - a.dials);

  return {
    grain: Array.from(grain.values()),
    rollups,
    accountNames: Array.from(accountNames.values()),
    dateRange: { min: minDate, max: maxDate },
    counts: {
      totalRows,
      dials,
      connects,
      meetingsBooked,
      distinctProspects: globalProspects.size,
      skipped,
      missingAccount,
      missingDate,
    },
  };
}

// ---- AI-plan path (fallback for unrecognized formats) ----

export function applyCallActivityPlan(
  parsed: ParsedCsv,
  plan: CallActivityPlan
): CallActivityResult {
  const { headers } = parsed;
  const c = plan.columns;
  const items = parsed.rows.map((row, rowIndex): Classified => {
    // Disposition classification.
    let target: DispositionTarget;
    if (!c.dispositionColumn) {
      target = "no-connect";
    } else {
      const raw = cell(headers, row, c.dispositionColumn);
      if (!raw) {
        target = "no-connect";
      } else {
        const mapped = plan.dispositionMap[raw.toLowerCase()];
        if (mapped === "skip") return "skip";
        target = mapped ?? "no-connect";
      }
    }
    let isConnect = target === "connect" || target === "meeting-booked";
    let isBooked = target === "meeting-booked";
    if (
      c.meetingBookedColumn &&
      isTruthyFlag(cell(headers, row, c.meetingBookedColumn))
    ) {
      isBooked = true;
      isConnect = true;
    }
    const iso = parseLooseDate(cell(headers, row, c.callDateColumn));
    return {
      accountName: cell(headers, row, c.accountColumn),
      date: iso ? isoToLocalDate(iso) : null,
      prospectKey: prospectKeyFor(
        cell(headers, row, c.prospectEmailColumn),
        cell(headers, row, c.prospectPhoneColumn),
        cell(headers, row, c.prospectNameColumn),
        rowIndex
      ),
      prospectName: cell(headers, row, c.prospectNameColumn),
      isConnect,
      isBooked,
    };
  });
  return aggregateCalls(items, parsed.rows.length);
}

// ---- Fixed-format path (Nooks / SalesLoft dialer export) ------------
//
// The standard export every rep pulls has a stable schema, so we skip
// the AI entirely: hardcode the columns and the disposition/sentiment
// classification. If a file doesn't carry these headers, the UI falls
// back to the AI-plan path above.

const CALL_EXPORT_HEADERS = [
  "Company Name",
  "Prospect Name",
  "Prospect Number",
  "Call Time",
  "Disposition Name",
  "Sentiment Name",
];

export function detectCallExport(headers: string[]): boolean {
  const set = new Set(headers);
  return CALL_EXPORT_HEADERS.every((h) => set.has(h));
}

// Disposition Name values that mean a live conversation.
const EXPORT_CONNECT_DISPOSITIONS = new Set([
  "connected",
  "meeting scheduled",
  "scheduled needs follow up",
]);
// Sentiment Name values that mean a meeting/demo was booked.
const EXPORT_BOOKED_SENTIMENTS = new Set(["meeting booked", "demo scheduled"]);
const EXPORT_BOOKED_DISPOSITIONS = new Set(["meeting scheduled"]);
// Disposition Name values that aren't a real dial.
const EXPORT_SKIP_DISPOSITIONS = new Set(["uncallable"]);

export function parseCallExport(parsed: ParsedCsv): CallActivityResult {
  const h = parsed.headers;
  const iAcc = h.indexOf("Company Name");
  const iName = h.indexOf("Prospect Name");
  const iPhone = h.indexOf("Prospect Number");
  const iTime = h.indexOf("Call Time");
  const iDisp = h.indexOf("Disposition Name");
  const iSent = h.indexOf("Sentiment Name");

  const items = parsed.rows.map((row, rowIndex): Classified => {
    const disp = (row[iDisp] ?? "").trim().toLowerCase();
    if (EXPORT_SKIP_DISPOSITIONS.has(disp)) return "skip";
    const sent = (row[iSent] ?? "").trim().toLowerCase();
    const isBooked =
      EXPORT_BOOKED_SENTIMENTS.has(sent) || EXPORT_BOOKED_DISPOSITIONS.has(disp);
    const isConnect = isBooked || EXPORT_CONNECT_DISPOSITIONS.has(disp);

    // Call Time is an ISO timestamp with a "[Zone]" suffix, e.g.
    // 2026-08-11T12:53:30.814-04:00[America/New_York]. The date part
    // before "T" is the call's calendar date in the rep's own timezone —
    // taking it verbatim avoids any browser-timezone drift.
    const rawTime = (row[iTime] ?? "").trim();
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawTime) ? rawTime.slice(0, 10) : null;

    const name = (row[iName] ?? "").trim();
    return {
      accountName: (row[iAcc] ?? "").trim(),
      date,
      prospectKey: prospectKeyFor("", row[iPhone] ?? "", name, rowIndex),
      prospectName: name,
      isConnect,
      isBooked,
    };
  });
  return aggregateCalls(items, parsed.rows.length);
}

export { DISPOSITION_TARGETS };
