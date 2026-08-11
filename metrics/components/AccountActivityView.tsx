"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  PhoneCall,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, type ParsedCsv } from "@/lib/lusha-cleanup/parse";
import { bulkCreateAccounts, listAccounts } from "@/lib/data/accounts";
import {
  bulkInsertAccountActivity,
  deleteAccountActivityInRange,
  listAccountActivity,
  type AccountActivityInsert,
  type AccountActivityRow,
} from "@/lib/data/accountActivity";
import { buildColumnStats, sampleRows } from "@/lib/import/csvImport";
import {
  applyCallActivityPlan,
  planFromCallActivityResult,
  DISPOSITION_LABEL,
  DISPOSITION_TARGETS,
  type CallActivityPlan,
  type DispositionTarget,
} from "@/lib/import/callActivity";
import type {
  CallActivityColumnMapping,
  CallActivityMappingResult,
} from "@/lib/ai/prompts";

function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const rec = e as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
  }
  return String(e);
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type RangeKey = "30" | "90" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

// ---- Root view ----------------------------------------------------

export function AccountActivityView() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountNameById, setAccountNameById] = useState<Record<string, string>>(
    {}
  );
  const [rows, setRows] = useState<AccountActivityRow[]>([]);
  const [rangeKey, setRangeKey] = useState<RangeKey>("90");
  const [importOpen, setImportOpen] = useState(false);

  const fromDate = useMemo(() => {
    const r = RANGES.find((x) => x.key === rangeKey);
    if (!r || r.days === null) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - r.days);
    return localDateStr(d);
  }, [rangeKey]);

  const load = useMemo(
    () =>
      async function load() {
        setLoading(true);
        setError(null);
        try {
          const [accts, activity] = await Promise.all([
            listAccounts(supabase),
            listAccountActivity(supabase, { fromDate }),
          ]);
          const map: Record<string, string> = {};
          for (const a of accts) map[a.id] = a.name || "(unnamed)";
          setAccountNameById(map);
          setRows(activity);
        } catch (e) {
          setError(formatError(e));
        } finally {
          setLoading(false);
        }
      },
    [supabase, fromDate]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rollups = useMemo(() => {
    const byAcc = new Map<
      string,
      { dials: number; connects: number; booked: number; prospects: Set<string> }
    >();
    for (const r of rows) {
      let a = byAcc.get(r.accountId);
      if (!a) {
        a = { dials: 0, connects: 0, booked: 0, prospects: new Set() };
        byAcc.set(r.accountId, a);
      }
      a.dials += r.dials;
      a.connects += r.connects;
      a.booked += r.meetingsBooked;
      a.prospects.add(r.prospectKey);
    }
    return Array.from(byAcc.entries())
      .map(([accountId, a]) => ({
        accountId,
        name: accountNameById[accountId] ?? "(deleted account)",
        dials: a.dials,
        connects: a.connects,
        booked: a.booked,
        prospects: a.prospects.size,
      }))
      .sort((a, b) => b.dials - a.dials);
  }, [rows, accountNameById]);

  const totals = useMemo(
    () =>
      rollups.reduce(
        (acc, r) => {
          acc.dials += r.dials;
          acc.connects += r.connects;
          acc.booked += r.booked;
          acc.prospects += r.prospects;
          return acc;
        },
        { dials: 0, connects: 0, booked: 0, prospects: 0 }
      ),
    [rollups]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Per-account call cadence. Upload a dialer export and it&apos;s rolled
          up into dials, connects, meetings booked, and distinct prospects
          dialed per account.
        </p>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm"
            role="tablist"
            aria-label="Date range"
          >
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  rangeKey === r.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={rangeKey === r.key}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Upload className="h-3.5 w-3.5" /> Import call data
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-rose-700">Failed to load: {error}</p>
      ) : rollups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm italic text-slate-500">
          No call activity in this range. Use <em>Import call data</em> to upload
          a dialer export.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Account</th>
                <th className="px-3 py-2 text-right font-semibold">Dials</th>
                <th className="px-3 py-2 text-right font-semibold">Connects</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Meetings booked
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  New prospects
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rollups.map((r) => (
                <tr key={r.accountId} className="text-slate-800">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.dials}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.connects}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.booked}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.prospects}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.dials}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.connects}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.booked}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.prospects}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        &ldquo;New prospects&rdquo; counts distinct people dialed in this range.
        This view is standalone — it doesn&apos;t feed Goals or pacing.
      </p>

      {importOpen && (
        <CallActivityImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ---- Import modal -------------------------------------------------

const COLUMN_FIELDS: {
  key: keyof CallActivityColumnMapping;
  label: string;
  hint?: string;
}[] = [
  { key: "accountColumn", label: "Account / company" },
  { key: "prospectNameColumn", label: "Prospect name" },
  { key: "prospectEmailColumn", label: "Prospect email", hint: "best identity key" },
  { key: "prospectPhoneColumn", label: "Prospect phone" },
  { key: "callDateColumn", label: "Call date" },
  { key: "dispositionColumn", label: "Disposition / outcome" },
  { key: "meetingBookedColumn", label: "Meeting-booked flag", hint: "optional" },
];

function CallActivityImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CallActivityPlan | null>(null);
  const [assumptions, setAssumptions] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPlan(null);
    setAnalyzeError(null);
    setImportError(null);
    setFileName(file.name);
    try {
      const p = parseCsv(await file.text());
      if (p.headers.length === 0 || p.rows.length === 0) {
        setParsed(null);
        setParseError("That file has no header row and data rows.");
        return;
      }
      setParseError(null);
      setParsed(p);
    } catch (err) {
      setParsed(null);
      setParseError(formatError(err));
    }
  };

  const analyze = async () => {
    if (!parsed) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "call-activity-mapping",
          callActivityContext: {
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
      const mapping = data.result as CallActivityMappingResult;
      setPlan(planFromCallActivityResult(mapping));
      setAssumptions(mapping.assumptions || "");
    } catch (err) {
      setAnalyzeError(formatError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const translation = useMemo(() => {
    if (!parsed || !plan) return null;
    return applyCallActivityPlan(parsed, plan);
  }, [parsed, plan]);

  const dispositionValues = useMemo(() => {
    const header = plan?.columns.dispositionColumn ?? null;
    if (!parsed || !header) return [];
    const idx = parsed.headers.indexOf(header);
    if (idx < 0) return [];
    const seen = new Map<string, string>();
    for (const r of parsed.rows) {
      const v = (r[idx] ?? "").trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, plan?.columns.dispositionColumn]);

  const setColumn = (key: keyof CallActivityColumnMapping, value: string) =>
    setPlan((p) =>
      p ? { ...p, columns: { ...p.columns, [key]: value || null } } : p
    );
  const setDisposition = (raw: string, to: DispositionTarget) =>
    setPlan((p) =>
      p
        ? {
            ...p,
            dispositionMap: { ...p.dispositionMap, [raw.toLowerCase()]: to },
          }
        : p
    );

  const doImport = async () => {
    if (!parsed || !plan || !translation) return;
    const { min, max } = translation.dateRange;
    if (!min || !max || translation.grain.length === 0) {
      setImportError("No datable calls to import with the current mapping.");
      return;
    }
    if (
      !window.confirm(
        `Import call activity for ${translation.accountNames.length} accounts, ${min} to ${max}? Re-importing this date range replaces any activity already stored for it.`
      )
    )
      return;
    setImporting(true);
    setImportError(null);
    try {
      const supabase = createClient();
      await bulkCreateAccounts(supabase, translation.accountNames);
      const all = await listAccounts(supabase);
      const idByName = new Map(all.map((a) => [a.name.toLowerCase(), a.id]));
      const inserts: AccountActivityInsert[] = [];
      for (const g of translation.grain) {
        const accountId = idByName.get(g.accountName.toLowerCase());
        if (!accountId) continue;
        inserts.push({
          accountId,
          prospectKey: g.prospectKey,
          prospectName: g.prospectName,
          activityDate: g.activityDate,
          dials: g.dials,
          connects: g.connects,
          meetingsBooked: g.meetingsBooked,
        });
      }
      // Replace-by-range so a re-import of the same period is idempotent.
      await deleteAccountActivityInRange(supabase, min, max);
      await bulkInsertAccountActivity(supabase, inserts);
      onImported();
    } catch (err) {
      setImportError(formatError(err));
      setImporting(false);
    }
  };

  const headerOptions = parsed?.headers ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <PhoneCall className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Import call data
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-xs text-slate-500">
            Upload a raw dialer export (one row per call). The assistant figures
            out your columns and classifies each disposition; calls are rolled
            up per account. You review before anything is saved.
          </p>

          <div className="flex flex-wrap items-center gap-3">
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
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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

          {plan && parsed && translation && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              {assumptions && (
                <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-900">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{assumptions}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {COLUMN_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] font-semibold text-slate-600">
                      {f.label}
                      {f.hint && (
                        <span className="font-normal text-slate-400">
                          {" "}
                          · {f.hint}
                        </span>
                      )}
                    </span>
                    <select
                      value={plan.columns[f.key] ?? ""}
                      onChange={(e) => setColumn(f.key, e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="">— none —</option>
                      {headerOptions.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {plan.columns.dispositionColumn && dispositionValues.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">
                    Disposition → outcome
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {dispositionValues.map((raw) => (
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
                          value={
                            plan.dispositionMap[raw.toLowerCase()] ?? "no-connect"
                          }
                          onChange={(e) =>
                            setDisposition(raw, e.target.value as DispositionTarget)
                          }
                          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:border-blue-400 focus:outline-none"
                        >
                          {DISPOSITION_TARGETS.map((o) => (
                            <option key={o} value={o}>
                              {DISPOSITION_LABEL[o]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counts */}
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <Pill tone="blue">{translation.counts.dials} dials</Pill>
                <Pill tone="emerald">{translation.counts.connects} connects</Pill>
                <Pill tone="emerald">
                  {translation.counts.meetingsBooked} booked
                </Pill>
                <Pill tone="blue">
                  {translation.counts.distinctProspects} prospects
                </Pill>
                {translation.dateRange.min && (
                  <Pill tone="slate">
                    {translation.dateRange.min} → {translation.dateRange.max}
                  </Pill>
                )}
                {translation.counts.skipped > 0 && (
                  <Pill tone="slate">{translation.counts.skipped} skipped</Pill>
                )}
                {translation.counts.missingAccount > 0 && (
                  <Pill tone="amber">
                    {translation.counts.missingAccount} no account
                  </Pill>
                )}
                {translation.counts.missingDate > 0 && (
                  <Pill tone="amber">
                    {translation.counts.missingDate} no date
                  </Pill>
                )}
              </div>

              {/* Per-account preview */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Account</th>
                      <th className="px-2 py-1.5 text-right font-semibold">
                        Dials
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold">
                        Connects
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold">
                        Booked
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold">
                        Prospects
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {translation.rollups.slice(0, 10).map((r) => (
                      <tr key={r.accountName} className="text-slate-700">
                        <td className="px-2 py-1.5">{r.accountName}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.dials}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.connects}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.meetingsBooked}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.distinctProspects}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {translation.rollups.length > 10 && (
                <p className="text-[11px] text-slate-400">
                  + {translation.rollups.length - 10} more accounts
                </p>
              )}

              {translation.counts.missingAccount > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {translation.counts.missingAccount} calls had no account and
                  were left out — map an Account column if one exists.
                </p>
              )}

              {importError && (
                <p className="text-xs text-red-600">{importError}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void doImport()}
                  disabled={importing || translation.grain.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {importing
                    ? "Importing…"
                    : `Import ${translation.counts.dials} dials`}
                </button>
                <button
                  onClick={onClose}
                  disabled={importing}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "slate" | "blue" | "emerald" | "amber";
}) {
  const cls: Record<typeof tone, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 ${cls[tone]}`}>
      {children}
    </span>
  );
}
