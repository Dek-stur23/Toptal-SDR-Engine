"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { Account, AccountStatus } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import {
  DEFAULT_EMAIL_CADENCE_GEM,
  DEFAULT_ICP_HIRED_CADENCE_GEM,
} from "@/lib/gems";

interface Props {
  accounts: Account[];
}

type Department =
  | "Engineering & Technical"
  | "IT"
  | "Marketing"
  | "Procurement";

const DEPARTMENTS: Department[] = [
  "Engineering & Technical",
  "IT",
  "Marketing",
  "Procurement",
];

// The gem branches on this two-value dimension, so we collapse the
// three account statuses (Signed Active / Signed Dormant / Unsigned)
// down to the same two-way branch before sending to the model.
type StatusBranch = "signed" | "unsigned";

function branchFor(status: AccountStatus): StatusBranch {
  if (
    status === "Signed Account - Active" ||
    status === "Signed Account - Dormant"
  ) {
    return "signed";
  }
  return "unsigned";
}

function statusLabel(status: AccountStatus): string {
  if (status === "") return "Unset";
  return status;
}

function currentQuarter(): string {
  const m = new Date().getMonth();
  return `Q${Math.floor(m / 3) + 1}`;
}

interface GeneratedEmail {
  subjectLine: string;
  bodyMarkdown: string;
}

interface CadenceResult {
  emails: GeneratedEmail[];
}

const CADENCE_SCHEMA = {
  type: "OBJECT",
  properties: {
    emails: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          subjectLine: { type: "STRING" },
          bodyMarkdown: { type: "STRING" },
        },
        required: ["subjectLine", "bodyMarkdown"],
      },
    },
  },
  required: ["emails"],
};

type CadenceMode = "chooser" | "volume" | "icp";

export function EmailCadenceEngine({ accounts }: Props) {
  const [mode, setMode] = useState<CadenceMode>("chooser");

  if (mode === "chooser") {
    return <CadenceChooser onPick={setMode} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <button
        onClick={() => setMode("chooser")}
        className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to cadences
      </button>
      {mode === "volume" ? (
        <VolumeOutboundCadence accounts={accounts} />
      ) : (
        <IcpHiredOutreach accounts={accounts} />
      )}
    </div>
  );
}

function CadenceChooser({ onPick }: { onPick: (m: CadenceMode) => void }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6 text-blue-600" /> Email Cadence Engine
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Pick the type of cadence you want to generate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CadenceCard
          onClick={() => onPick("volume")}
          icon={<Mail className="w-5 h-5 text-blue-600" />}
          title="Volume Outbound Cadence"
          description="4-email cadence tuned to account status and job function. Signed accounts pitch the existing MSA; unsigned accounts pitch Toptal top-3% talent. Works across Engineering, IT, Marketing, and Procurement."
        />
        <CadenceCard
          onClick={() => onPick("icp")}
          icon={<UserPlus className="w-5 h-5 text-emerald-600" />}
          title="New ICP Hired Outreach"
          description="Triggered when a target persona was recently hired into an ICP account. Engineering & Technical only. Leaves [First Name] and [Title] as placeholders for you to fill in per recipient."
        />
      </div>
    </div>
  );
}

function CadenceCard({
  onClick,
  icon,
  title,
  description,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition rounded-xl p-5 space-y-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
    </button>
  );
}

function useActiveAccounts(accounts: Account[]) {
  return useMemo(
    () =>
      accounts
        .filter((a) => !a.isArchived)
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [accounts]
  );
}

function VolumeOutboundCadence({ accounts }: Props) {
  const activeAccounts = useActiveAccounts(accounts);

  const [accountId, setAccountId] = useState<string>("");
  const [statusOverride, setStatusOverride] = useState<AccountStatus | null>(
    null
  );
  const [department, setDepartment] = useState<Department | "">("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<GeneratedEmail[] | null>(null);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const effectiveStatus: AccountStatus =
    statusOverride ?? account?.accountData.accountStatus ?? "";
  const canGenerate =
    !!account && !!department && effectiveStatus !== "" && !generating;

  const generate = async () => {
    if (!account || !department || effectiveStatus === "") return;
    const accountName =
      account.name || account.accountData.companyName || "";
    if (!accountName.trim()) {
      setError("The selected account has no name set.");
      return;
    }
    setGenerating(true);
    setError(null);
    setEmails(null);
    try {
      const branch = branchFor(effectiveStatus);
      const result = await generateWithClaude<CadenceResult>({
        prompt:
          `Generate a 4-email cadence for the following context:\n\n` +
          `- accountName: ${accountName}\n` +
          `- accountStatus: ${branch}\n` +
          `- department: ${department}\n\n` +
          `Follow the template that matches accountStatus. Preserve the merge variables verbatim. Return exactly 4 emails in order.`,
        system: DEFAULT_EMAIL_CADENCE_GEM,
        schema: CADENCE_SCHEMA,
      });
      if (!Array.isArray(result?.emails) || result.emails.length === 0) {
        setError("Model returned no emails.");
        return;
      }
      setEmails(result.emails);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6 text-blue-600" /> Volume Outbound Cadence
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate a 4-email outbound cadence tailored to an account and
          department. Signed accounts pitch the MSA; unsigned accounts pitch
          Toptal top-3% talent.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Account
          </span>
          {activeAccounts.length === 0 ? (
            <p className="text-xs italic text-slate-500 px-3 py-2 border border-slate-200 rounded-md bg-slate-50">
              No accounts yet. Create one from the sidebar first.
            </p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setStatusOverride(null);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">— Select an account —</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.accountData.companyName || "(unnamed)"}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>Status</span>
            {account && statusOverride === null && (
              <span className="text-[10px] font-normal normal-case text-slate-400">
                From account
              </span>
            )}
          </span>
          <select
            value={effectiveStatus}
            onChange={(e) =>
              setStatusOverride(e.target.value as AccountStatus)
            }
            disabled={!account}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
          >
            <option value="">— Select —</option>
            <option value="Signed Account - Active">Signed Account — Active</option>
            <option value="Signed Account - Dormant">Signed Account — Dormant</option>
            <option value="Unsigned Account">Unsigned Account</option>
          </select>
          {account && effectiveStatus !== "" && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Cadence branch:{" "}
              <span className="font-semibold text-slate-700">
                {branchFor(effectiveStatus)}
              </span>{" "}
              (from {statusLabel(effectiveStatus)})
            </p>
          )}
        </label>

        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Department / job function
          </span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value as Department | "")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— Select —</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={() => void generate()}
          disabled={!canGenerate}
          className="w-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating cadence…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate 4-email cadence
            </>
          )}
        </button>
      </section>

      {emails && emails.length > 0 && <CadenceResults emails={emails} />}
    </>
  );
}

function IcpHiredOutreach({ accounts }: Props) {
  const activeAccounts = useActiveAccounts(accounts);

  const [accountId, setAccountId] = useState<string>("");
  const [statusOverride, setStatusOverride] = useState<AccountStatus | null>(
    null
  );

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<GeneratedEmail[] | null>(null);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const effectiveStatus: AccountStatus =
    statusOverride ?? account?.accountData.accountStatus ?? "";
  const canGenerate = !!account && effectiveStatus !== "" && !generating;

  const generate = async () => {
    if (!account || effectiveStatus === "") return;
    const accountName =
      account.name || account.accountData.companyName || "";
    if (!accountName.trim()) {
      setError("The selected account has no name set.");
      return;
    }
    setGenerating(true);
    setError(null);
    setEmails(null);
    try {
      const branch = branchFor(effectiveStatus);
      const quarter = currentQuarter();
      const result = await generateWithClaude<CadenceResult>({
        prompt:
          `Generate a 4-email new-ICP-hire outreach cadence for the following context:\n\n` +
          `- accountName: ${accountName}\n` +
          `- accountStatus: ${branch}\n` +
          `- currentQuarter: ${quarter}\n\n` +
          `Follow the template that matches accountStatus. Preserve [First Name], [Title], and [Your Name] as literal placeholders. Return exactly 4 emails in order.`,
        system: DEFAULT_ICP_HIRED_CADENCE_GEM,
        schema: CADENCE_SCHEMA,
      });
      if (!Array.isArray(result?.emails) || result.emails.length === 0) {
        setError("Model returned no emails.");
        return;
      }
      setEmails(result.emails);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-emerald-600" /> New ICP Hired
          Outreach
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          4-email cadence triggered when a target persona was recently hired at
          an ICP account. Engineering & Technical only. Leaves{" "}
          <code className="text-[11px]">[First Name]</code> and{" "}
          <code className="text-[11px]">[Title]</code> as placeholders for you
          to fill in per recipient.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
        <label className="block">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Account
          </span>
          {activeAccounts.length === 0 ? (
            <p className="text-xs italic text-slate-500 px-3 py-2 border border-slate-200 rounded-md bg-slate-50">
              No accounts yet. Create one from the sidebar first.
            </p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setStatusOverride(null);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">— Select an account —</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.accountData.companyName || "(unnamed)"}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>Account status</span>
            {account && statusOverride === null && (
              <span className="text-[10px] font-normal normal-case text-slate-400">
                From account
              </span>
            )}
          </span>
          <select
            value={effectiveStatus}
            onChange={(e) =>
              setStatusOverride(e.target.value as AccountStatus)
            }
            disabled={!account}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
          >
            <option value="">— Select —</option>
            <option value="Signed Account - Active">Signed Account — Active</option>
            <option value="Signed Account - Dormant">Signed Account — Dormant</option>
            <option value="Unsigned Account">Unsigned Account</option>
          </select>
          {account && effectiveStatus !== "" && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Cadence branch:{" "}
              <span className="font-semibold text-slate-700">
                {branchFor(effectiveStatus)}
              </span>{" "}
              (from {statusLabel(effectiveStatus)})
            </p>
          )}
        </label>

        <div className="text-[11px] text-slate-500 border border-slate-200 rounded-md bg-slate-50 px-3 py-2">
          Function: <span className="font-semibold text-slate-700">Engineering & Technical</span> (locked for this cadence).
          Industry and tech stack will be inferred from the account name.
          Current quarter: <span className="font-semibold text-slate-700">{currentQuarter()}</span>.
        </div>

        {error && (
          <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={() => void generate()}
          disabled={!canGenerate}
          className="w-full text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating cadence…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate 4-email cadence
            </>
          )}
        </button>
      </section>

      {emails && emails.length > 0 && <CadenceResults emails={emails} />}
    </>
  );
}

function CadenceResults({ emails }: { emails: GeneratedEmail[] }) {
  const [copiedAll, setCopiedAll] = useState(false);

  const copyAll = async () => {
    const text = emails
      .map(
        (e, i) =>
          `--- Email ${i + 1} ---\nSubject: ${e.subjectLine.trim()}\n\n${e.bodyMarkdown.trim()}`
      )
      .join("\n\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* clipboard denied — ignore */
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Generated cadence ({emails.length} emails)
        </h2>
        <button
          onClick={() => void copyAll()}
          className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
        >
          {copiedAll ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Copied
              all
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy all
            </>
          )}
        </button>
      </div>
      <ul className="space-y-3">
        {emails.map((e, i) => (
          <EmailCard
            key={i}
            index={i + 1}
            subject={e.subjectLine}
            body={e.bodyMarkdown}
          />
        ))}
      </ul>
    </section>
  );
}

function EmailCard({
  index,
  subject,
  body,
}: {
  index: number;
  subject: string;
  body: string;
}) {
  return (
    <li className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
          Email {index}
        </span>
      </div>
      <CopyableBlock label="Subject" value={subject} mono={false} rows={1} />
      <CopyableBlock label="Body" value={body} mono={false} rows={0} />
    </li>
  );
}

function CopyableBlock({
  label,
  value,
  mono,
  rows,
}: {
  label: string;
  value: string;
  mono: boolean;
  rows: number;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — ignore */
    }
  };
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <button
          onClick={() => void copy()}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-1 px-2 py-0.5 rounded"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre
        className={`whitespace-pre-wrap px-3 py-2 text-sm text-slate-800 leading-relaxed bg-white ${
          mono ? "font-mono" : "font-sans"
        } ${rows === 1 ? "" : "min-h-[3rem]"}`}
      >
        {value.trim()}
      </pre>
    </div>
  );
}
