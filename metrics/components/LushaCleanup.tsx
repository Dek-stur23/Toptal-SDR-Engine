"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  Undo2,
  Upload,
  Wand2,
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
import {
  deriveTemplate,
  isTemplateValid,
  renderEmailFromTemplate,
} from "@/lib/lusha-cleanup/nomenclature";
import { createClient } from "@/lib/supabase/client";
import { logActivityEvent } from "@/lib/data/activityEvents";

// Part 2 of the Lusha workflow. The user brings in the file Lusha
// returned (an enriched CSV with parallel "(Lusha) …" columns), the
// processor consolidates the columns and flags apparent job changes,
// and the preview lets the user decide who to keep before downloading
// a clean CSV suitable for SalesLoft import.
//
// The CSV is processed entirely client-side — no prospect data leaves
// the browser. The only server call is a fire-and-forget usage ping
// (tool + action + timestamp) so the tool appears in usage reporting.

type Filter = "all" | "flagged" | "left" | "generated" | "willExport";

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

// A contact qualifies for a generated email when it has no real email
// (blank Email + blank Supplemental Email) and hasn't moved companies —
// a moved contact's address would live on a different domain than the
// file's. A row already carrying a generated guess still qualifies, so
// re-generating with a different pattern recomputes cleanly.
function isEligible(c: Contact): boolean {
  return (
    !c.fields["Supplemental Email"] &&
    !c.flags.includes("LEFT_COMPANY") &&
    (!c.fields.Email || c.emailGenerated === true)
  );
}

export function LushaCleanup() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftCompanyReviewed, setLeftCompanyReviewed] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setDecisions({});
    setFileName(file.name);
    setLeftCompanyReviewed(false);
    setAppliedTemplate(null);
    try {
      const text = await file.text();
      const r = process(text);
      // Initialize decisions from defaults.
      const d: DecisionMap = {};
      for (const c of r.contacts) d[c.contactId] = c.defaultDecision;
      setResult(r);
      setDecisions(d);
      void logActivityEvent(supabase, {
        tool: "ZoomInfo → Lusha",
        action: "cleanup",
      });
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
    setAppliedTemplate(null);
  };

  // ---- Derived state ----
  const filtered: Contact[] = useMemo(() => {
    if (!result) return [];
    switch (filter) {
      case "flagged":
        return result.contacts.filter((c) => !c.flags.includes("MATCH") || c.flags.length > 1);
      case "left":
        return result.contacts.filter((c) => c.flags.includes("LEFT_COMPANY"));
      case "generated":
        return result.contacts.filter((c) => c.emailGenerated);
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

  const noEmailCount = useMemo(
    () => (result ? result.contacts.filter(isEligible).length : 0),
    [result]
  );

  const generatedCount = useMemo(
    () => (result ? result.contacts.filter((c) => c.emailGenerated).length : 0),
    [result]
  );

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

  // Fill the Email field of every eligible contact from a nomenclature
  // template, tagging each filled row as a guess. Reversible via
  // clearGeneration; re-running with a new template recomputes from
  // scratch because eligibility counts already-generated rows.
  const applyGeneration = (template: string) => {
    if (!result) return;
    const prevGenIds = new Set(
      result.contacts.filter((c) => c.emailGenerated).map((c) => c.contactId)
    );

    const nextContacts = result.contacts.map((c) => {
      const stripGuess = () =>
        c.emailGenerated
          ? { ...c, emailGenerated: false, fields: { ...c.fields, Email: "" } }
          : c;

      if (!isEligible(c)) return stripGuess();
      const { email } = renderEmailFromTemplate(template, {
        first: c.fields["First Name"],
        last: c.fields["Last Name"],
      });
      if (!email) return stripGuess();
      return {
        ...c,
        emailGenerated: true,
        fields: { ...c.fields, Email: email },
      };
    });

    const genNowIds = new Set(
      nextContacts.filter((c) => c.emailGenerated).map((c) => c.contactId)
    );
    // Auto-keep freshly generated contacts — NO_CONTACT_DATA defaults to
    // delete, but a contact we just gave a usable email to should ship.
    // Any row that lost its guess reverts to its default decision.
    setDecisions((prev) => {
      const d = { ...prev };
      for (const c of nextContacts) {
        if (genNowIds.has(c.contactId)) d[c.contactId] = "keep";
        else if (prevGenIds.has(c.contactId)) d[c.contactId] = c.defaultDecision;
      }
      return d;
    });

    setResult({ ...result, contacts: nextContacts });
    setAppliedTemplate(template);

    if (genNowIds.size > 0) {
      void logActivityEvent(supabase, {
        tool: "ZoomInfo → Lusha",
        action: "generate-emails",
      });
    }
  };

  const clearGeneration = () => {
    if (!result) return;
    const genIds = new Set(
      result.contacts.filter((c) => c.emailGenerated).map((c) => c.contactId)
    );
    if (genIds.size > 0) {
      const nextContacts = result.contacts.map((c) =>
        c.emailGenerated
          ? { ...c, emailGenerated: false, fields: { ...c.fields, Email: "" } }
          : c
      );
      setDecisions((prev) => {
        const d = { ...prev };
        for (const c of nextContacts) {
          if (genIds.has(c.contactId)) d[c.contactId] = c.defaultDecision;
        }
        return d;
      });
      setResult({ ...result, contacts: nextContacts });
    }
    setAppliedTemplate(null);
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
                Any Lusha bulk-enrichment export. Your CSV stays in your browser.
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
            generatedCount={generatedCount}
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

          {(noEmailCount > 0 || generatedCount > 0) && (
            <NomenclatureFill
              contacts={result.contacts}
              noEmailCount={noEmailCount}
              generatedCount={generatedCount}
              appliedTemplate={appliedTemplate}
              onApply={applyGeneration}
              onClear={clearGeneration}
            />
          )}

          <FilterBar
            filter={filter}
            onFilter={setFilter}
            result={result}
            generatedCount={generatedCount}
            onBulk={bulk}
          />

          <DownloadBar
            onDownload={download}
            onDownloadAudit={downloadAudit}
            exportCount={exportCount}
            generatedCount={generatedCount}
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
  generatedCount,
  fileName,
  onReset,
}: {
  result: ProcessResult;
  exportCount: number;
  generatedCount: number;
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
        {generatedCount > 0 && (
          <span className="text-violet-700">
            {" "}
            · {generatedCount} email{generatedCount === 1 ? "" : "s"} generated
            from nomenclature
          </span>
        )}
      </div>
    </div>
  );
}

// Nomenclature fill — derive a company email pattern from one verified
// example, let the user review/edit it, then auto-fill guessed emails
// for every contact who has none. Fully client-side and deterministic.
function NomenclatureFill({
  contacts,
  noEmailCount,
  generatedCount,
  appliedTemplate,
  onApply,
  onClear,
}: {
  contacts: Contact[];
  noEmailCount: number;
  generatedCount: number;
  appliedTemplate: string | null;
  onApply: (template: string) => void;
  onClear: () => void;
}) {
  const [sourceContactId, setSourceContactId] = useState("");
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [template, setTemplate] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [recognized, setRecognized] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Existing contacts that already carry a real (non-guessed) email —
  // any of them can seed the pattern with one click.
  const candidates = useMemo(
    () => contacts.filter((c) => c.fields.Email && !c.emailGenerated),
    [contacts]
  );

  const pickCandidate = (id: string) => {
    setSourceContactId(id);
    setError(null);
    setAnalyzed(false);
    if (!id) return;
    const c = contacts.find((x) => x.contactId === id);
    if (!c) return;
    setEmail(c.fields.Email);
    setFirst(c.fields["First Name"]);
    setLast(c.fields["Last Name"]);
  };

  const analyze = () => {
    setError(null);
    if (!first.trim() || !last.trim()) {
      setError("Enter the first and last name this email belongs to.");
      return;
    }
    const d = deriveTemplate(email, { first, last });
    if (!d) {
      setError("That doesn't look like a valid email address.");
      setAnalyzed(false);
      return;
    }
    setTemplate(d.template);
    setRecognized(d.recognized);
    setAnalyzed(true);
  };

  // Live shape preview from a canonical name so the user sees what the
  // pattern produces regardless of the example's own name.
  const example = useMemo(
    () => renderEmailFromTemplate(template, { first: "Jane", last: "Doe" }).email,
    [template]
  );

  // How many eligible contacts this exact template can actually fill
  // (some may lack a name part the pattern needs).
  const willGenerate = useMemo(() => {
    if (!isTemplateValid(template)) return 0;
    return contacts.filter((c) => {
      if (!isEligible(c)) return false;
      return !!renderEmailFromTemplate(template, {
        first: c.fields["First Name"],
        last: c.fields["Last Name"],
      }).email;
    }).length;
  }, [contacts, template]);

  const skipped = noEmailCount - willGenerate;
  const canGenerate = analyzed && isTemplateValid(template) && willGenerate > 0;

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            Fill missing emails from company nomenclature
          </h2>
          <p className="text-xs text-slate-600">
            {noEmailCount} contact{noEmailCount === 1 ? "" : "s"} still ha
            {noEmailCount === 1 ? "s" : "ve"} no email. Give one verified email
            for this company and the tool will infer the pattern and generate
            best-guess addresses for the rest.
          </p>
        </div>
      </div>

      {/* Step 1 — provide a verified example */}
      <div className="space-y-2 rounded-lg border border-violet-100 bg-white p-3">
        {candidates.length > 0 && (
          <label className="block text-[11px] font-semibold text-slate-600">
            Use an existing contact with a known email
            <select
              value={sourceContactId}
              onChange={(e) => pickCandidate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— enter one manually below —</option>
              {candidates.map((c) => (
                <option key={c.contactId} value={c.contactId}>
                  {c.fields["First Name"]} {c.fields["Last Name"]} —{" "}
                  {c.fields.Email}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAnalyzed(false);
            }}
            placeholder="Verified email (jane.doe@acme.com)"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 sm:col-span-3"
          />
          <input
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              setAnalyzed(false);
            }}
            placeholder="First name"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              setAnalyzed(false);
            }}
            placeholder="Last name"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={analyze}
            disabled={!email.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold px-3 py-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" /> Analyze
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Step 2 — review + approve the pattern */}
      {analyzed && (
        <div className="space-y-2 rounded-lg border border-violet-100 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-600">
            {recognized ? (
              <>Detected pattern — review, edit if needed, then generate:</>
            ) : (
              <>
                Couldn&apos;t auto-detect the pattern from that example.
                Assuming the most common one — please confirm or edit it:
              </>
            )}
          </p>
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-[11px] text-slate-500">
            Placeholders: <code>{"{first}"}</code> <code>{"{last}"}</code>{" "}
            <code>{"{f}"}</code> (first initial) <code>{"{l}"}</code> (last
            initial).{" "}
            {example && (
              <>
                Example: <span className="font-mono text-slate-700">{example}</span>
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
            <button
              onClick={() => onApply(template)}
              disabled={!canGenerate}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold px-3 py-1.5 shadow-sm"
            >
              <Wand2 className="w-3.5 h-3.5" /> Generate {willGenerate} email
              {willGenerate === 1 ? "" : "s"}
            </button>
            {generatedCount > 0 && (
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3 py-1.5 border border-slate-200"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo generated ({generatedCount})
              </button>
            )}
            {skipped > 0 && (
              <span className="text-[11px] text-slate-500">
                {skipped} can&apos;t be generated (missing a name part).
              </span>
            )}
          </div>
        </div>
      )}

      {generatedCount > 0 && (
        <p className="rounded-md border border-violet-200 bg-white px-3 py-2 text-[11px] text-violet-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {generatedCount} address{generatedCount === 1 ? " is a" : "es are"}{" "}
            pattern-guess{generatedCount === 1 ? "" : "es"}, not verified — they
            may bounce. They&apos;re badged in the preview below and marked in
            the audit CSV.
            {appliedTemplate && (
              <>
                {" "}
                Pattern:{" "}
                <span className="font-mono">{appliedTemplate}</span>.
              </>
            )}
          </span>
        </p>
      )}
    </section>
  );
}

function FilterBar({
  filter,
  onFilter,
  result,
  generatedCount,
  onBulk,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  result: ProcessResult;
  generatedCount: number;
  onBulk: (status: FlagStatus, d: "keep" | "delete") => void;
}) {
  const leftCount = result.summary.countsByStatus.LEFT_COMPANY;
  const noContact = result.summary.countsByStatus.NO_CONTACT_DATA;
  const filters: [Filter, string][] = [
    ["all", `All (${result.summary.total})`],
    ["flagged", "Flagged only"],
    ["left", `Moved companies (${leftCount})`],
    ...((generatedCount > 0
      ? [["generated", `Pattern-guesses (${generatedCount})`]]
      : []) as [Filter, string][]),
    ["willExport", "Will be exported"],
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
        Filter
      </span>
      {filters.map(([key, label]) => (
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
  generatedCount,
  undecidedLeftCompany,
  leftCompanyReviewed,
}: {
  onDownload: () => void;
  onDownloadAudit: () => void;
  exportCount: number;
  generatedCount: number;
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
      {generatedCount > 0 && (
        <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            This export includes <strong>{generatedCount}</strong> pattern-guess
            email{generatedCount === 1 ? "" : "s"}. They&apos;re unverified and
            may bounce — consider verifying before a heavy send.
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
        SalesLoft mapping: <code>Email</code> → Email Address,{" "}
        <code>Supplemental Email</code> → Supplemental Email,{" "}
        <code>Mobile Phone</code> → Mobile Phone,{" "}
        <code>Work Phone</code> → Phone. The <code>Additional Emails</code> and{" "}
        <code>Additional Phones</code> columns exist to prevent data loss on
        rows with 3+ addresses/numbers and aren&apos;t expected to be mapped.
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
                      {c.emailGenerated && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block w-fit bg-violet-100 text-violet-800 border-violet-200">
                          Pattern-guess
                        </span>
                      )}
                      {c.flagDetail && (
                        <span className="text-[11px] text-slate-700">
                          {c.flagDetail}
                        </span>
                      )}
                    </div>
                  </td>
                  {OUTPUT_FIELDS.map((k) => {
                    const isGuessEmail = k === "Email" && c.emailGenerated;
                    return (
                      <td
                        key={k}
                        className={`px-3 py-1.5 whitespace-nowrap max-w-56 truncate ${strike} ${
                          isGuessEmail
                            ? "text-violet-700 italic"
                            : "text-slate-700"
                        }`}
                        title={c.fields[k]}
                      >
                        {c.fields[k] || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
