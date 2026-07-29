"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";

// ZoomInfo → Lusha CSV prep tool.
//
// - Runs entirely in the browser. Nothing hits the server, no
//   prospect data leaves the machine.
// - Reads the user's ZoomInfo Person export, picks the columns
//   Lusha needs, cleans them, and outputs a UTF-8 (no BOM), comma-
//   delimited CSV under Lusha's 10k-row limit. Splits into
//   multiple files when the input exceeds the limit.
// - Flags rows that don't carry any of Lusha's required matcher
//   fields (LinkedIn URL, email, or full name + company name).

const LUSHA_MAX_ROWS = 10_000;

// Ordered list of output columns. Lusha's upload flow has a manual
// column-mapping step so exact header names aren't required by Lusha
// — but plain, familiar labels make that mapping one-click.
const OUTPUT_COLUMNS = [
  "First Name",
  "Last Name",
  "Full Name",
  "Company Name",
  "Company Domain",
  "LinkedIn URL",
  "Job Title",
  "Email",
  "Location",
] as const;

// ZoomInfo header names we read from. Matched case-insensitively
// against the input header row so a slightly different export
// template still works.
const ZI_HEADERS = {
  firstName: "First Name",
  lastName: "Last Name",
  jobTitle: "Job Title",
  email: "Email Address",
  linkedin: "LinkedIn Contact Profile URL",
  company: "Company Name",
  website: "Website",
  city: "Company City",
  state: "Company State",
  country: "Company Country",
} as const;

interface PreppedRow {
  values: string[]; // parallel to OUTPUT_COLUMNS
  hasMatcher: boolean; // meets at least one of Lusha's identifier requirements
}

interface PrepResult {
  headers: readonly string[];
  rows: PreppedRow[];
  totalIn: number;
  matched: number;
  flagged: number;
  missingZoomInfoCols: string[]; // ZoomInfo columns we expected but didn't find
}

// ---------- CSV parse / write (RFC 4180 compliant) ----------

function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM if present so it doesn't corrupt the header row.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        cur = "";
        rows.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  // Trim trailing empty rows.
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 0 || (last.length === 1 && last[0] === "")) {
      rows.pop();
    } else break;
  }
  return rows;
}

function toCsv(rows: (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell ?? "";
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\r\n");
}

// ---------- helpers ----------

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractDomain(website: string): string {
  const raw = (website ?? "").trim();
  if (!raw) return "";
  let s = raw.toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split(/[/?#]/)[0];
  return s;
}

function joinLocation(city: string, state: string, country: string): string {
  return [city, state, country]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function prep(text: string): PrepResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return {
      headers: OUTPUT_COLUMNS,
      rows: [],
      totalIn: 0,
      matched: 0,
      flagged: 0,
      missingZoomInfoCols: [],
    };
  }
  const headerRow = rows[0];
  const idx: Record<string, number> = {};
  const normalized = headerRow.map(normalizeHeader);
  for (const [key, ziName] of Object.entries(ZI_HEADERS)) {
    const found = normalized.indexOf(normalizeHeader(ziName));
    idx[key] = found;
  }
  const missing = (Object.entries(ZI_HEADERS) as [string, string][])
    .filter(([k]) => idx[k] === -1)
    .map(([, v]) => v);

  const output: PreppedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const g = (key: keyof typeof ZI_HEADERS) =>
      idx[key] >= 0 ? (r[idx[key]] ?? "").trim() : "";

    const firstName = g("firstName");
    const lastName = g("lastName");
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const company = g("company");
    const domain = extractDomain(g("website"));
    const linkedin = g("linkedin");
    const jobTitle = g("jobTitle");
    const email = g("email");
    const location = joinLocation(g("city"), g("state"), g("country"));

    const hasMatcher =
      !!linkedin ||
      !!email ||
      (!!fullName && (!!company || !!domain));

    output.push({
      values: [
        firstName,
        lastName,
        fullName,
        company,
        domain,
        linkedin,
        jobTitle,
        email,
        location,
      ],
      hasMatcher,
    });
  }
  const matched = output.filter((r) => r.hasMatcher).length;
  return {
    headers: OUTPUT_COLUMNS,
    rows: output,
    totalIn: output.length,
    matched,
    flagged: output.length - matched,
    missingZoomInfoCols: missing,
  };
}

// UTF-8 without BOM — Lusha's docs explicitly flag BOM as a common
// cause of upload failure.
function downloadCsv(filename: string, csv: string): void {
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

// ---------- Component ----------

export function LushaCsvPrep() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<PrepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeFlagged, setIncludeFlagged] = useState(true);

  const chunks = useMemo(() => {
    if (!result) return [];
    const kept = includeFlagged ? result.rows : result.rows.filter((r) => r.hasMatcher);
    const out: PreppedRow[][] = [];
    for (let i = 0; i < kept.length; i += LUSHA_MAX_ROWS) {
      out.push(kept.slice(i, i + LUSHA_MAX_ROWS));
    }
    return out;
  }, [result, includeFlagged]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const prepared = prep(text);
      setResult(prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setResult(null);
    setError(null);
  };

  const download = (chunkIdx: number) => {
    if (!result) return;
    const chunk = chunks[chunkIdx];
    const rows: string[][] = [
      OUTPUT_COLUMNS.slice(),
      ...chunk.map((r) => r.values),
    ];
    const base = (fileName ?? "zoominfo").replace(/\.csv$/i, "");
    const suffix = chunks.length > 1 ? `-part${chunkIdx + 1}of${chunks.length}` : "";
    downloadCsv(`${base}-lusha-ready${suffix}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> ZoomInfo → Lusha CSV
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a ZoomInfo Person export and download a Lusha-ready CSV
          matching Lusha&apos;s enrichment requirements (UTF-8, comma-delimited,
          under 10,000 rows). Runs entirely in your browser — nothing leaves
          this page.
        </p>
      </div>

      {!result && (
        <section className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          {busy ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Reading {fileName}…</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-700 font-medium mb-1">
                Drop a ZoomInfo CSV here, or pick one
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Person export. Any size — will split into multiple files if over
                10,000 rows.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                id="lusha-csv-upload"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <label
                htmlFor="lusha-csv-upload"
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
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Source</p>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {fileName}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Start over
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Rows in" value={result.totalIn} tone="slate" />
              <StatCard
                label="Ready for Lusha"
                value={result.matched}
                tone="emerald"
              />
              <StatCard
                label="Flagged"
                value={result.flagged}
                tone="amber"
                hint="Missing all Lusha identifiers"
              />
            </div>

            {result.flagged > 0 && (
              <label className="flex items-start gap-2 text-xs text-slate-700 border border-slate-200 rounded-md p-2 bg-slate-50">
                <input
                  type="checkbox"
                  checked={includeFlagged}
                  onChange={(e) => setIncludeFlagged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Keep the {result.flagged} flagged row
                  {result.flagged === 1 ? "" : "s"} in the download. Lusha will
                  simply fail to enrich them (no credits spent). Uncheck to drop
                  them from the output.
                </span>
              </label>
            )}

            {result.missingZoomInfoCols.length > 0 && (
              <p className="text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded-md p-2 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Missing expected ZoomInfo columns:{" "}
                  <span className="font-mono">
                    {result.missingZoomInfoCols.join(", ")}
                  </span>
                  . Rows will still be processed but affected fields will be
                  blank.
                </span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">
                {chunks.length === 1
                  ? "Download Lusha-ready CSV"
                  : `Download in ${chunks.length} parts (Lusha caps at ${LUSHA_MAX_ROWS.toLocaleString()} rows per upload)`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {chunks.map((chunk, i) => (
                <button
                  key={i}
                  onClick={() => download(i)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  {chunks.length === 1
                    ? `Download (${chunk.length.toLocaleString()} rows)`
                    : `Part ${i + 1} · ${chunk.length.toLocaleString()} rows`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 italic">
              File is UTF-8 without BOM, comma-delimited, and CRLF line endings
              — meets every requirement on Lusha&apos;s upload page. When you
              upload, Lusha will ask you to map columns; the output uses
              obvious names to keep that mapping one-click.
            </p>
          </div>

          {result.rows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Preview (first {Math.min(10, result.rows.length)} rows)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-r border-slate-100">
                        {" "}
                      </th>
                      {OUTPUT_COLUMNS.map((c) => (
                        <th
                          key={c}
                          className="text-left px-3 py-1.5 font-semibold text-slate-600 whitespace-nowrap"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 10).map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.hasMatcher ? "" : "bg-amber-50/50"
                        }
                      >
                        <td className="px-3 py-1.5 border-r border-slate-100">
                          {r.hasMatcher ? (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-emerald-600"
                              aria-label="Matchable"
                            />
                          ) : (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-amber-600"
                              aria-label="No matcher"
                            />
                          )}
                        </td>
                        {r.values.map((v, j) => (
                          <td
                            key={j}
                            className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-52 truncate"
                            title={v}
                          >
                            {v || (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber";
  hint?: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">
        {value.toLocaleString()}
      </p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}
