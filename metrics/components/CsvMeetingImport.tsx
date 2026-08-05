"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, type ParsedCsv } from "@/lib/lusha-cleanup/parse";
import { bulkCreateAccounts, listAccounts } from "@/lib/data/accounts";
import { bulkCreateEses } from "@/lib/data/eses";
import {
  bulkCreateMeetings,
  type BulkMeetingInsert,
} from "@/lib/data/meetings";
import {
  bulkCreateOpportunities,
  type OpportunityDraft,
} from "@/lib/data/opportunities";
import {
  applyImportPlan,
  buildColumnStats,
  planFromMappingResult,
  sampleRows,
  RESPONSE_TARGETS,
  STATUS_TARGETS,
  type ImportPlan,
  type ResponseTarget,
  type StatusTarget,
} from "@/lib/import/csvImport";
import type { ImportMappingResult } from "@/lib/ai/prompts";

function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const rec = e as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

type SingleCol =
  | "titleColumn"
  | "companyColumn"
  | "meetingDateColumn"
  | "bookedDateColumn"
  | "heldDateColumn"
  | "statusColumn"
  | "prospectResponseColumn"
  | "eseColumn"
  | "linkedinUrlColumn";

const SINGLE_FIELDS: { key: SingleCol; label: string; hint?: string }[] = [
  { key: "companyColumn", label: "Company / account" },
  { key: "titleColumn", label: "Job title" },
  { key: "meetingDateColumn", label: "Meeting date", hint: "When it's scheduled" },
  { key: "bookedDateColumn", label: "Date booked", hint: "Optional — backfills history" },
  { key: "heldDateColumn", label: "Date held", hint: "Optional — when it happened" },
  { key: "statusColumn", label: "Status", hint: "Booked / held / cancelled" },
  { key: "prospectResponseColumn", label: "Invite response", hint: "Optional" },
  { key: "eseColumn", label: "ESE / AE", hint: "Optional" },
  { key: "linkedinUrlColumn", label: "LinkedIn URL", hint: "Optional" },
];

const STATUS_LABEL: Record<StatusTarget, string> = {
  booked: "Booked",
  held: "Held",
  "dead-end": "Dead end",
  "dead-end-if-past": "Dead-end if past",
  skip: "Skip row",
};

const RESPONSE_LABEL: Record<ResponseTarget, string> = {
  accepted: "Accepted",
  declined: "Declined",
  "no-response": "No response",
  "no-show": "No-show",
  rescheduled: "Rescheduled",
  "still-scheduling": "Still scheduling",
  skip: "Ignore",
};

export function CsvMeetingImport() {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [assumptions, setAssumptions] = useState<string>("");

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    accountsCreated: number;
    esesCreated: number;
    opportunitiesCreated: number;
    skipped: number;
    emptyRows: number;
  } | null>(null);

  const reset = () => {
    setPlan(null);
    setAssumptions("");
    setAnalyzeError(null);
    setImportError(null);
    setResult(null);
  };

  const loadText = (text: string, name: string) => {
    reset();
    setFileName(name);
    try {
      const p = parseCsv(text);
      if (p.headers.length === 0 || p.rows.length === 0) {
        setParsed(null);
        setParseError("That file has no header row and data rows to import.");
        return;
      }
      setParseError(null);
      setParsed(p);
    } catch (e) {
      setParsed(null);
      setParseError(formatError(e));
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    loadText(text, file.name);
  };

  const analyze = async () => {
    if (!parsed) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "import-mapping",
          importContext: {
            headers: parsed.headers,
            sampleRows: sampleRows(parsed, 12),
            columnStats: buildColumnStats(parsed),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(
          res.status === 429
            ? "Monthly AI limit reached — try again next month."
            : data?.error || "Analysis failed."
        );
        return;
      }
      const mapping = data.result as ImportMappingResult;
      setPlan(planFromMappingResult(mapping));
      setAssumptions(mapping.assumptions || "");
    } catch (e) {
      setAnalyzeError(formatError(e));
    } finally {
      setAnalyzing(false);
    }
  };

  // Stable "now" for the date-conditional status routing (no-show in the
  // past → dead-end), captured once so the preview doesn't drift.
  const now = useMemo(() => new Date(), []);

  // Live translation — exactly what will be written.
  const translation = useMemo(() => {
    if (!parsed || !plan) return null;
    return applyImportPlan(parsed, plan, now);
  }, [parsed, plan, now]);

  // Distinct raw values (display-cased) of the currently-mapped status
  // and response columns, so we can render one row per value to map.
  const distinctOf = (header: string | null): string[] => {
    if (!parsed || !header) return [];
    const idx = parsed.headers.indexOf(header);
    if (idx < 0) return [];
    const seen = new Map<string, string>();
    for (const r of parsed.rows) {
      const v = (r[idx] ?? "").trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  };
  const statusValues = useMemo(
    () => distinctOf(plan?.columns.statusColumn ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, plan?.columns.statusColumn]
  );
  const responseValues = useMemo(
    () => distinctOf(plan?.columns.prospectResponseColumn ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, plan?.columns.prospectResponseColumn]
  );

  // ---- Plan editors ----
  const setColumn = (key: SingleCol, value: string) =>
    setPlan((p) =>
      p ? { ...p, columns: { ...p.columns, [key]: value || null } } : p
    );
  const setNameMode = (mode: "full" | "split") =>
    setPlan((p) => (p ? { ...p, nameMode: mode } : p));
  const setNameCol = (
    key: "fullNameColumn" | "firstNameColumn" | "lastNameColumn",
    value: string
  ) =>
    setPlan((p) =>
      p ? { ...p, columns: { ...p.columns, [key]: value || null } } : p
    );
  const toggleNote = (header: string) =>
    setPlan((p) => {
      if (!p) return p;
      const has = p.columns.notesColumns.includes(header);
      return {
        ...p,
        columns: {
          ...p.columns,
          notesColumns: has
            ? p.columns.notesColumns.filter((h) => h !== header)
            : [...p.columns.notesColumns, header],
        },
      };
    });
  const toggleOppColumn = (header: string) =>
    setPlan((p) => {
      if (!p) return p;
      const has = p.columns.opportunityColumns.includes(header);
      return {
        ...p,
        columns: {
          ...p.columns,
          opportunityColumns: has
            ? p.columns.opportunityColumns.filter((h) => h !== header)
            : [...p.columns.opportunityColumns, header],
        },
      };
    });
  const setStatusFor = (raw: string, to: StatusTarget) =>
    setPlan((p) =>
      p ? { ...p, statusMap: { ...p.statusMap, [raw.toLowerCase()]: to } } : p
    );
  const setResponseFor = (raw: string, to: ResponseTarget) =>
    setPlan((p) =>
      p
        ? { ...p, responseMap: { ...p.responseMap, [raw.toLowerCase()]: to } }
        : p
    );

  const doImport = async () => {
    if (!parsed || !plan || !translation) return;
    if (translation.meetings.length === 0) {
      setImportError("Nothing to import with the current mapping.");
      return;
    }
    if (
      !window.confirm(
        `Import ${translation.meetings.length} meetings into your tracker? New companies will be created as accounts. This doesn't delete anything.`
      )
    )
      return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const supabase = createClient();
      // Seed the Accounts and ESE lists from the sheet in the same pass,
      // so the rep lands with their book of business and AE roster
      // already populated — not just the meeting rows. Both dedup
      // case-insensitively against what already exists.
      const [{ created: accountsCreated }, { created: esesCreated }] =
        await Promise.all([
          bulkCreateAccounts(supabase, translation.companyNames),
          bulkCreateEses(supabase, translation.eseNames),
        ]);
      const all = await listAccounts(supabase);
      const idByName = new Map(all.map((a) => [a.name.toLowerCase(), a.id]));
      const rows: BulkMeetingInsert[] = translation.meetings.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        title: m.title,
        linkedinUrl: m.linkedinUrl,
        salesloftUrl: "",
        accountId: m.companyName
          ? idByName.get(m.companyName.toLowerCase()) ?? null
          : null,
        scheduledFor: m.scheduledFor,
        notes: m.notes,
        status: m.status,
        prospectResponse: m.prospectResponse,
        ese: m.ese,
        createdAt: m.createdAt,
        heldAt: m.heldAt,
        deadEndedAt: m.deadEndedAt,
      }));
      const ids = await bulkCreateMeetings(supabase, rows);

      // Auto-create opportunities for flagged rows, linked to the meeting
      // that was just inserted at the same position. Fields the rep
      // didn't provide start empty/open — filled in later in the tracker.
      const oppDrafts: OpportunityDraft[] = [];
      translation.meetings.forEach((m, i) => {
        const meetingId = ids[i];
        if (!m.createOpportunity || !meetingId) return;
        const name = `${m.firstName} ${m.lastName}`.trim();
        const title =
          name && m.companyName
            ? `${name} — ${m.companyName}`
            : name || m.companyName || "Imported opportunity";
        oppDrafts.push({
          meetingId,
          title,
          pain: "",
          solutionArea: null,
          timeline: null,
          nextStepText: "",
          nextStepOwner: null,
          status: "open",
        });
      });
      const opportunitiesCreated =
        oppDrafts.length > 0
          ? await bulkCreateOpportunities(supabase, oppDrafts)
          : 0;

      setResult({
        imported: ids.length,
        accountsCreated: accountsCreated.length,
        esesCreated: esesCreated.length,
        opportunitiesCreated,
        skipped: translation.counts.skipped,
        emptyRows: translation.counts.emptyRows,
      });
      // Clear the staged import so the section resets to its start state.
      setParsed(null);
      setPlan(null);
      setFileName("");
    } catch (e) {
      setImportError(formatError(e));
    } finally {
      setImporting(false);
    }
  };

  const headerOptions = parsed?.headers ?? [];

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-900">
          Import your meeting tracker (CSV)
        </h2>
      </div>
      <p className="text-xs text-slate-500">
        Bringing your own spreadsheet? Upload a CSV export of your meeting
        tracker and the assistant will figure out your columns, translate them
        to the Sidekick fields, and log every meeting — booked and held — on
        its original date. You review the mapping before anything is written.
      </p>

      {/* Step 1 — file */}
      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <FileUp className="h-3.5 w-3.5" />
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
        </label>
        {fileName && (
          <span className="text-xs text-slate-500">
            {fileName}
            {parsed ? ` · ${parsed.rows.length} rows` : ""}
          </span>
        )}
        {parsed && !plan && (
          <button
            onClick={() => void analyze()}
            disabled={analyzing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {analyzing ? "Analyzing…" : "Analyze with AI"}
          </button>
        )}
      </div>

      {parseError && <p className="text-xs text-red-600">{parseError}</p>}
      {analyzeError && <p className="text-xs text-red-600">{analyzeError}</p>}
      {parsed?.raggedLines.length ? (
        <p className="text-[11px] text-amber-600">
          Heads up: {parsed.raggedLines.length} row(s) had an unexpected column
          count and were padded — double-check them in the preview.
        </p>
      ) : null}

      {result && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Import complete.</p>
            <p>
              Logged {result.imported} meetings
              {result.accountsCreated > 0
                ? `, created ${result.accountsCreated} new account${
                    result.accountsCreated === 1 ? "" : "s"
                  }`
                : ""}
              {result.esesCreated > 0
                ? `, added ${result.esesCreated} ESE${
                    result.esesCreated === 1 ? "" : "s"
                  }`
                : ""}
              {result.opportunitiesCreated > 0
                ? `, opened ${result.opportunitiesCreated} opportunit${
                    result.opportunitiesCreated === 1 ? "y" : "ies"
                  }`
                : ""}
              {result.skipped > 0 ? `, skipped ${result.skipped} rows` : ""}
              {result.emptyRows > 0
                ? `, ignored ${result.emptyRows} blank rows`
                : ""}
              . Open the Meetings Tracker to see them.
            </p>
          </div>
        </div>
      )}

      {/* Step 2 — editable mapping + preview */}
      {plan && parsed && translation && (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          {assumptions && (
            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-900">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{assumptions}</span>
            </div>
          )}

          {/* Name mapping */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">
                Prospect name
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input
                  type="radio"
                  checked={plan.nameMode === "full"}
                  onChange={() => setNameMode("full")}
                />
                One column
              </label>
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input
                  type="radio"
                  checked={plan.nameMode === "split"}
                  onChange={() => setNameMode("split")}
                />
                First + last
              </label>
            </div>
            {plan.nameMode === "full" ? (
              <ColumnSelect
                label="Full name column"
                value={plan.columns.fullNameColumn}
                headers={headerOptions}
                onChange={(v) => setNameCol("fullNameColumn", v)}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ColumnSelect
                  label="First name"
                  value={plan.columns.firstNameColumn}
                  headers={headerOptions}
                  onChange={(v) => setNameCol("firstNameColumn", v)}
                />
                <ColumnSelect
                  label="Last name"
                  value={plan.columns.lastNameColumn}
                  headers={headerOptions}
                  onChange={(v) => setNameCol("lastNameColumn", v)}
                />
              </div>
            )}
          </div>

          {/* Single-column fields */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SINGLE_FIELDS.map((f) => (
              <ColumnSelect
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={plan.columns[f.key]}
                headers={headerOptions}
                onChange={(v) => setColumn(f.key, v)}
              />
            ))}
          </div>

          {/* Notes columns */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">
              Keep as notes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {headerOptions.map((h) => {
                const on = plan.columns.notesColumns.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => toggleNote(h)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      on
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opportunity-flag columns */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">
              Create an opportunity when checked
            </span>
            <p className="text-[11px] text-slate-500">
              Rows where any of these columns is positive (TRUE / yes / ✓) get
              an open opportunity auto-created — no details needed now.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {headerOptions.map((h) => {
                const on = plan.columns.opportunityColumns.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => toggleOppColumn(h)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      on
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status value mapping */}
          {plan.columns.statusColumn && statusValues.length > 0 && (
            <ValueMap
              title={`Status values → Sidekick status`}
              values={statusValues}
              options={STATUS_TARGETS}
              labelFor={(t) => STATUS_LABEL[t as StatusTarget]}
              currentFor={(raw) => plan.statusMap[raw.toLowerCase()] ?? "booked"}
              onChange={(raw, to) => setStatusFor(raw, to as StatusTarget)}
            />
          )}

          {/* Response value mapping */}
          {plan.columns.prospectResponseColumn && responseValues.length > 0 && (
            <ValueMap
              title="Invite-response values → Sidekick response"
              values={responseValues}
              options={RESPONSE_TARGETS}
              labelFor={(t) => RESPONSE_LABEL[t as ResponseTarget]}
              currentFor={(raw) =>
                plan.responseMap[raw.toLowerCase()] ?? "skip"
              }
              onChange={(raw, to) => setResponseFor(raw, to as ResponseTarget)}
            />
          )}

          {/* Counts */}
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <Pill tone="slate">{translation.counts.importable} to import</Pill>
            <Pill tone="blue">{translation.counts.booked} booked</Pill>
            <Pill tone="emerald">{translation.counts.held} held</Pill>
            {translation.counts.deadEnd > 0 && (
              <Pill tone="rose">{translation.counts.deadEnd} dead-end</Pill>
            )}
            {translation.counts.skipped > 0 && (
              <Pill tone="slate">{translation.counts.skipped} skipped</Pill>
            )}
            {translation.counts.emptyRows > 0 && (
              <Pill tone="slate">
                {translation.counts.emptyRows} blank rows ignored
              </Pill>
            )}
            {translation.companyNames.length > 0 && (
              <Pill tone="blue">
                {translation.companyNames.length} companies → Accounts
              </Pill>
            )}
            {translation.eseNames.length > 0 && (
              <Pill tone="blue">
                {translation.eseNames.length} ESEs → ESE list
              </Pill>
            )}
            {translation.counts.opportunities > 0 && (
              <Pill tone="emerald">
                {translation.counts.opportunities} opportunities
              </Pill>
            )}
            {translation.counts.missingDate > 0 && (
              <Pill tone="amber">
                {translation.counts.missingDate} missing date
              </Pill>
            )}
            {translation.counts.missingName > 0 && (
              <Pill tone="amber">
                {translation.counts.missingName} missing name
              </Pill>
            )}
          </div>

          {/* Preview */}
          <PreviewTable meetings={translation.meetings.slice(0, 8)} />

          {importError && <p className="text-xs text-red-600">{importError}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={() => void doImport()}
              disabled={importing || translation.meetings.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {importing
                ? "Importing…"
                : `Import ${translation.meetings.length} meetings`}
            </button>
            <button
              onClick={() => {
                setPlan(null);
                setParsed(null);
                setFileName("");
              }}
              disabled={importing}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ColumnSelect({
  label,
  hint,
  value,
  headers,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  headers: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-600">
        {label}
        {hint && <span className="font-normal text-slate-400"> · {hint}</span>}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">— none —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

function ValueMap({
  title,
  values,
  options,
  labelFor,
  currentFor,
  onChange,
}: {
  title: string;
  values: string[];
  options: readonly string[];
  labelFor: (t: string) => string;
  currentFor: (raw: string) => string;
  onChange: (raw: string, to: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{title}</span>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {values.map((raw) => (
          <div
            key={raw}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
          >
            <span
              className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
              title={raw}
            >
              {raw}
            </span>
            <span className="text-slate-300">→</span>
            <select
              value={currentFor(raw)}
              onChange={(e) => onChange(raw, e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:border-blue-400 focus:outline-none"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {labelFor(o)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({
  meetings,
}: {
  meetings: {
    firstName: string;
    lastName: string;
    companyName: string;
    status: string;
    scheduledFor: string | null;
    prospectResponse: string | null;
    ese: string | null;
    createOpportunity: boolean;
    issues: string[];
  }[];
}) {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
        <Table2 className="h-3.5 w-3.5" /> Preview (first {meetings.length})
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Name</th>
              <th className="px-2 py-1.5 font-semibold">Company</th>
              <th className="px-2 py-1.5 font-semibold">Status</th>
              <th className="px-2 py-1.5 font-semibold">Date</th>
              <th className="px-2 py-1.5 font-semibold">Response</th>
              <th className="px-2 py-1.5 font-semibold">ESE</th>
              <th className="px-2 py-1.5 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meetings.map((m, i) => (
              <tr key={i} className="text-slate-700">
                <td className="px-2 py-1.5">
                  {`${m.firstName} ${m.lastName}`.trim() || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {m.companyName || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-1.5 capitalize">{m.status}</td>
                <td className="px-2 py-1.5">{fmt(m.scheduledFor)}</td>
                <td className="px-2 py-1.5">{m.prospectResponse ?? "—"}</td>
                <td className="px-2 py-1.5">{m.ese ?? "—"}</td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {m.issues.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {m.issues.join(", ")}
                      </span>
                    ) : (
                      <span className="text-emerald-600">ok</span>
                    )}
                    {m.createOpportunity && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[10px] font-semibold text-emerald-700">
                        + opp
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "slate" | "blue" | "emerald" | "rose" | "amber";
}) {
  const cls: Record<typeof tone, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 ${cls[tone]}`}>
      {children}
    </span>
  );
}
