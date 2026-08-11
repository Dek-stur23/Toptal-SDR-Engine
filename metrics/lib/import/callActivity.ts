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

// ---- Apply ----

export function applyCallActivityPlan(
  parsed: ParsedCsv,
  plan: CallActivityPlan
): CallActivityResult {
  const { headers } = parsed;
  const c = plan.columns;

  // grain key -> accumulator
  const grain = new Map<string, ActivityGrainRow>();
  // account (lower) -> rollup + distinct prospect set
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

  parsed.rows.forEach((row, rowIndex) => {
    // ---- Disposition classification ----
    let target: DispositionTarget;
    if (!c.dispositionColumn) {
      // No disposition column at all: every row is a bare dial.
      target = "no-connect";
    } else {
      const raw = cell(headers, row, c.dispositionColumn);
      if (!raw) {
        target = "no-connect";
      } else {
        const mapped = plan.dispositionMap[raw.toLowerCase()];
        if (mapped === "skip") {
          skipped += 1;
          return;
        }
        target = mapped ?? "no-connect";
      }
    }

    let isConnect = target === "connect" || target === "meeting-booked";
    let isBooked = target === "meeting-booked";
    // Optional dedicated booked-flag column overrides / augments.
    if (c.meetingBookedColumn && isTruthyFlag(cell(headers, row, c.meetingBookedColumn))) {
      isBooked = true;
      isConnect = true;
    }

    // ---- Account (required to attribute) ----
    const accountName = cell(headers, row, c.accountColumn);
    if (!accountName) {
      missingAccount += 1;
      return;
    }

    // ---- Date (required to place on the timeline) ----
    const iso = parseLooseDate(cell(headers, row, c.callDateColumn));
    if (!iso) {
      missingDate += 1;
      return;
    }
    const date = isoToLocalDate(iso);

    // ---- Identity ----
    const email = cell(headers, row, c.prospectEmailColumn);
    const phone = cell(headers, row, c.prospectPhoneColumn);
    const name = cell(headers, row, c.prospectNameColumn);
    const pKey = prospectKeyFor(email, phone, name, rowIndex);

    // ---- Accumulate ----
    dials += 1;
    if (isConnect) connects += 1;
    if (isBooked) meetingsBooked += 1;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    const accLower = accountName.toLowerCase();
    if (!accountNames.has(accLower)) accountNames.set(accLower, accountName);

    const gKey = `${accLower}||${pKey}||${date}`;
    const g = grain.get(gKey);
    if (g) {
      g.dials += 1;
      if (isConnect) g.connects += 1;
      if (isBooked) g.meetingsBooked += 1;
    } else {
      grain.set(gKey, {
        accountName,
        prospectKey: pKey,
        prospectName: name,
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
    r.prospects.add(pKey);

    globalProspects.add(`${accLower}||${pKey}`);
  });

  const rollups = Array.from(rollupByAccount.values())
    .map((r) => ({ ...r.row, distinctProspects: r.prospects.size }))
    .sort((a, b) => b.dials - a.dials);

  return {
    grain: Array.from(grain.values()),
    rollups,
    accountNames: Array.from(accountNames.values()),
    dateRange: { min: minDate, max: maxDate },
    counts: {
      totalRows: parsed.rows.length,
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

export { DISPOSITION_TARGETS };
