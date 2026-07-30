import { toCsvBytes } from "./parse";
import {
  OUTPUT_FIELDS,
  type DecisionMap,
  type ProcessResult,
} from "./types";

// The deliverable — SalesLoft-ready CSV. Contains ONLY the columns
// listed in OUTPUT_FIELDS, in that order. No Decision, no flags, no
// email_source, no currentEmployerLusha. Rows whose decision is
// "delete" are omitted.
//
// Deterministic per §6.4: same (result, decisions) always produces the
// same bytes.
export function toCsv(result: ProcessResult, decisions: DecisionMap): string {
  const rows: string[][] = [OUTPUT_FIELDS.slice() as string[]];
  for (const c of result.contacts) {
    const d = decisions[c.contactId] ?? c.defaultDecision;
    if (d === "delete") continue;
    rows.push(OUTPUT_FIELDS.map((k) => c.fields[k]));
  }
  return toCsvBytes(rows);
}

// Full audit — every contact including deleted ones, plus the
// workflow columns. This is the "what got dropped and why" record.
export function toAuditCsv(
  result: ProcessResult,
  decisions: DecisionMap
): string {
  const auditHeaders = [
    "Contact ID",
    "Decision",
    "Status",
    "Flag Detail",
    "Email Source",
    "Email Generated",
    "Current Employer (Lusha)",
    ...OUTPUT_FIELDS,
  ];
  const rows: string[][] = [auditHeaders];
  for (const c of result.contacts) {
    const d = decisions[c.contactId] ?? c.defaultDecision;
    rows.push([
      c.contactId,
      d,
      c.flags.join("|"),
      c.flagDetail,
      c.emailSource,
      c.emailGenerated ? "yes" : "",
      c.currentEmployerLusha,
      ...OUTPUT_FIELDS.map((k) => c.fields[k]),
    ]);
  }
  return toCsvBytes(rows);
}

// UTF-8 without BOM (matches Part 1 and SalesLoft expectations).
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
