"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  OUTPUT_FIELDS,
  type Contact,
  type DecisionMap,
  type FlagStatus,
  type ProcessResult,
} from "@/lib/lusha-cleanup/types";
import { process } from "@/lib/lusha-cleanup/process";
import { downloadCsv, toAuditCsv, toCsv } from "@/lib/lusha-cleanup/csv";

// Part 2 of the Lusha workflow. The user brings in the file Lusha
// returned (an enriched CSV with parallel "(Lusha) …" columns), the
// processor consolidates the columns and flags apparent job changes,
// and the preview lets the user decide who to keep before downloading
// a clean CSV suitable for SalesLoft import.
//
// Everything is client-side. Nothing hits the server or Supabase.

type Filter = "all" | "flagged" | "left" | "willExport";

// Preview row style by highest-severity flag (§5.3).
const ROW_STYLE: Record<FlagStatus, string> = {
  LEFT_COMPANY: "bg-red-50",
  NO_CONTACT_DATA: "bg-red-50",
  ROLE_CHANGE: "bg-amber-50",
  UNVERIFIED: "bg-slate-100",
  MATCH: "bg-white",
};

const BADGE_STYLE: Record<FlagStatus, string> = {
  LEFT_COMPANY: "bg-red-100 text-red-800 border-red-200",
  NO_CONTACT_DATA: "bg-red-100 text-red-800 border-red-200",
  ROLE_CHANGE: "bg-amber-100 text-amber-800 border-amber-200",
  UNVERIFIED: "bg-slate-200 text-slate-700 border-slate-300",
  MATCH: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_LABEL: Record<FlagStatus, string> = {
  LEFT_COMPANY: "Left company",
  NO_CONTACT_DATA: "No contact data",
  ROLE_CHANGE: "Role change",
  UNVERIFIED: "Unverified",
  MATCH: "Match",
};

export function LushaCleanup() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftCompanyReviewed, setLeftCompanyReviewed] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setDecisions({});
    setFileName(file.name);
    setLeftCompanyReviewed(false);
    try {
      const text = await file.text();
      const r = process(text);
      // Initialize decisions from defaults.
      const d: DecisionMap = {};
      for (const c of r.contacts) d[c.contactId] = c.defaultDecision;
      setResult(r);
      setDecisions(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setResult(null);
    setDecisions({});
    setFilter("all");
    setError(null);
    setLeftCompanyReviewed(false);
  };

  // ---- Derived state ----
  const filtered: Contact[] = useMemo(() => {
    if (!result) return [];
    switch (filter) {
      case "flagged":
        return result.contacts.filter((c) => !c.flags.includes("MATCH") || c.flags.length > 1);
      case "left":
        return result.contacts.filter((c) => c.flags.includes("LEFT_COMPANY"));
      case "willExport":
        return result.contacts.filter(
          (c) => (decisions[c.contactId] ?? c.defaultDecision) === "keep"
        );
      default:
        return result.contacts;
    }
  }, [result, filter, decisions]);

  const exportCount = useMemo(() => {
    if (!result) return 0;
    return result.contacts.filter(
      (c) => (decisions[c.contactId] ?? c.defaultDecision) === "keep"
    ).length;
  }, [result, decisions]);

  const undecidedLeftCompany = useMemo(() => {
    if (!result) return 0;
    return result.contacts.filter(
      (c) =>
        c.flags.includes("LEFT_COMPANY") &&
        (decisions[c.contactId] ?? c.defaultDecision) === "keep"
    ).length;
  }, [result, decisions]);

  // ---- Actions ----
  const setDecision = (contactId: string, d: "keep" | "delete") => {
    setDecisions((prev) => ({ ...prev, [contactId]: d }));
  };

  const bulk = (status: FlagStatus, d: "keep" | "delete") => {
    if (!result) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const c of result.contacts) {
        if (c.flags.includes(status)) next[c.contactId] = d;
      }
      return next;
    });
  };

  const download = () => {
    if (!result) return;
    if (undecidedLeftCompany > 0 && !leftCompanyReviewed) {
      setLeftCompanyReviewed(true);
      // Non-blocking: user can re-click to actually download.
      return;
    }
    const base = (fileName ?? "cleanup").replace(/\.csv$/i, "");
    downloadCsv(`${base}_salesloft.csv`, toCsv(result, decisions));
  };

  const downloadAudit = () => {
    if (!result) return;
    const base = (fileName ?? "cleanup").replace(/\.csv$/i, "");
    downloadCsv(`${base}_audit.csv`, toAuditCsv(result, decisions));
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 italic">
        Upload the enriched CSV Lusha returned. The tool consolidates duplicate
        email/phone columns, flags contacts whose employer changed, and outputs
        a SalesLoft-mappable file. Runs entirely in your browser.
      </p>

      {!result && (
        <section className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          {busy ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Processing {fileName}…</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-700 font-medium mb-1">
                Drop an enriched Lusha CSV here, or pick one
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Any Lusha bulk-enrichment export. Nothing leaves this page.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                id="lusha-cleanup-upload"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <label
                htmlFor="lusha-cleanup-upload"
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Choose CSV
              </label>
            </>
          )}
        </section>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <>
          <SummaryBar
            result={result}
            exportCount={exportCount}
            fileName={fileName}
            onReset={handleReset}
          />

          {result.warnings.length > 0 && (
            <ul className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <FilterBar
            filter={filter}
            onFilter={setFilter}
            result={result}
            onBulk={bulk}
          />

          <DownloadBar
            onDownload={download}
            onDownloadAudit={downloadAudit}
            exportCount={exportCount}
            undecidedLeftCompany={undecidedLeftCompany}
            leftCompanyReviewed={leftCompanyReviewed}
          />

          <PreviewTable
            contacts={filtered}
            decisions={decisions}
            onSetDecision={setDecision}
          />
        </>
      )}
    </div>
  );
}

function SummaryBar({
  result,
  exportCount,
  fileName,
  onReset,
}: {
  result: ProcessResult;
  exportCount: number;
  fileName: string | null;
  onReset: () => void;
}) {
  const s = result.summary;
  const removed = s.total - exportCount;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Source</p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {fileName}
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Start over
        </button>
      </div>
      <div className="text-xs text-slate-700 leading-relaxed">
        <strong className="text-slate-900">{s.total}</strong> contacts ·{" "}
        <strong>{s.withEmail}</strong> with email ·{" "}
        <strong>{s.withPhone}</strong> with phone ·{" "}
        <strong>{s.emailsRecoveredFromLusha}</strong> emails recovered from Lusha
        <br />
        <span className="text-red-700 font-semibold">
          {s.countsByStatus.LEFT_COMPANY}
        </span>{" "}
        flagged as moved companies ·{" "}
        <span className="text-amber-700 font-semibold">
          {s.countsByStatus.ROLE_CHANGE}
        </span>{" "}
        role changes ·{" "}
        <span className="text-slate-700 font-semibold">
          {s.countsByStatus.UNVERIFIED}
        </span>{" "}
        unverified ·{" "}
        <span className="text-red-700 font-semibold">
          {s.countsByStatus.NO_CONTACT_DATA}
        </span>{" "}
        with no contact data
      </div>
      <div className="text-xs text-slate-800 font-semibold border-t border-slate-100 pt-2">
        → {exportCount} will be exported
        {removed > 0 && `, ${removed} removed`}
      </div>
    </div>
  );
}

function FilterBar({
  filter,
  onFilter,
  result,
  onBulk,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  result: ProcessResult;
  onBulk: (status: FlagStatus, d: "keep" | "delete") => void;
}) {
  const leftCount = result.summary.countsByStatus.LEFT_COMPANY;
  const noContact = result.summary.countsByStatus.NO_CONTACT_DATA;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
        Filter
      </span>
      {(
        [
          ["all", `All (${result.summary.total})`],
          ["flagged", "Flagged only"],
          ["left", `Moved companies (${leftCount})`],
          ["willExport", "Will be exported"],
        ] as [Filter, string][]
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onFilter(key)}
          className={`text-xs font-semibold px-2.5 py-1 rounded border transition-colors ${
            filter === key
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
      <div className="ml-auto flex flex-wrap gap-2">
        {leftCount > 0 && (
          <>
            <button
              onClick={() => onBulk("LEFT_COMPANY", "delete")}
              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded"
            >
              Delete all moved
            </button>
            <button
              onClick={() => onBulk("LEFT_COMPANY", "keep")}
              className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded"
            >
              Keep all moved
            </button>
          </>
        )}
        {noContact > 0 && (
          <>
            <button
              onClick={() => onBulk("NO_CONTACT_DATA", "delete")}
              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded"
            >
              Delete no-contact
            </button>
            <button
              onClick={() => onBulk("NO_CONTACT_DATA", "keep")}
              className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded"
            >
              Keep no-contact
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DownloadBar({
  onDownload,
  onDownloadAudit,
  exportCount,
  undecidedLeftCompany,
  leftCompanyReviewed,
}: {
  onDownload: () => void;
  onDownloadAudit: () => void;
  exportCount: number;
  undecidedLeftCompany: number;
  leftCompanyReviewed: boolean;
}) {
  const showWarning =
    undecidedLeftCompany > 0 && !leftCompanyReviewed;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
      {showWarning && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>{undecidedLeftCompany}</strong> contact
            {undecidedLeftCompany === 1 ? "" : "s"} appear to have left the
            target company and are set to Keep. Their old corporate email
            will likely bounce. Click Download again to proceed anyway.
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> Download SalesLoft CSV (
          {exportCount} row{exportCount === 1 ? "" : "s"})
        </button>
        <button
          onClick={onDownloadAudit}
          className="inline-flex items-center gap-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3 py-2 border border-slate-200 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> Download audit CSV
        </button>
      </div>
      <p className="text-[11px] text-slate-500 italic">
        SalesLoft mapping: <code>Email</code> → Email Address, <code>Mobile
        Phone</code> → Mobile Phone, <code>Work Phone</code> → Phone. The
        <code> Alternate Email</code>, <code>Additional Emails</code>, and
        <code> Additional Phones</code> columns exist to prevent data loss and
        aren&apos;t expected to be mapped.
      </p>
    </div>
  );
}

function PreviewTable({
  contacts,
  decisions,
  onSetDecision,
}: {
  contacts: Contact[];
  decisions: DecisionMap;
  onSetDecision: (contactId: string, d: "keep" | "delete") => void;
}) {
  if (contacts.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 italic text-center">
        No contacts match this filter.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20">
                Decision
              </th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">
                Flag detail
              </th>
              {OUTPUT_FIELDS.map((c) => (
                <th
                  key={c}
                  className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const decision =
                decisions[c.contactId] ?? c.defaultDecision;
              const primary = c.flags[0];
              const rowClass = ROW_STYLE[primary];
              const strike =
                decision === "delete" ? "opacity-50 line-through" : "";
              return (
                <tr
                  key={c.contactId}
                  className={`${rowClass} border-t border-slate-100`}
                >
                  <td className="px-3 py-1.5 sticky left-0 z-10 bg-inherit">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onSetDecision(c.contactId, "keep")}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                          decision === "keep"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => onSetDecision(c.contactId, "delete")}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                          decision === "delete"
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col gap-1">
                      {c.flags
                        .filter((f) => f !== "MATCH")
                        .map((f) => (
                          <span
                            key={f}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block w-fit ${BADGE_STYLE[f]}`}
                          >
                            {STATUS_LABEL[f]}
                          </span>
                        ))}
                      {c.flagDetail && (
                        <span className="text-[11px] text-slate-700">
                          {c.flagDetail}
                        </span>
                      )}
                    </div>
                  </td>
                  {OUTPUT_FIELDS.map((k) => (
                    <td
                      key={k}
                      className={`px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-56 truncate ${strike}`}
                      title={c.fields[k]}
                    >
                      {c.fields[k] || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
