"use client";

import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Copy,
  Crosshair,
  Lightbulb,
  Loader2,
  Mail,
  Send,
  Settings,
  Target,
  Upload,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import type { ProcurementCadence, ProcurementStrategy } from "@/lib/types";
import { generateWithClaude, getStatusContext } from "@/lib/api";
import {
  DEFAULT_PROCUREMENT_CADENCE_GEM,
  DEFAULT_PROCUREMENT_STRATEGY_GEM,
} from "@/lib/gems";

const BOOLEAN_STRING = `"Procurement" OR "Sourcing" OR "Purchasing" OR "Strategic Sourcing" OR "Global Sourcing" OR "Category Manager" OR "Supply Management" OR "Supplier Relationship" OR "Spend Management" OR "Contingent Workforce" OR "Extended Workforce" OR "Contract Labor" OR "Staffing Program" OR "External Talent" OR "Temp Labor" OR "MSP" OR "VMS" OR "Talent Acquisition Operations" OR "Vendor Management" OR "VMO" OR "Supplier Management" OR "Contract Manager" OR "Third Party Risk" OR "TPRM" OR "Strategic Partnerships" OR "SOW" OR "Indirect Procurement" OR "IT Procurement" OR "Technology Procurement"`;

export function ProcurementBureaucracy({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [copied, setCopied] = useState(false);
  const [rawContacts, setRawContacts] = useState(
    accountData.procurementContacts || "",
  );
  const [showGemConfig, setShowGemConfig] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingCadence, setLoadingCadence] = useState(false);

  const [gemInstructions, setGemInstructions] = useState(
    accountData.step5GemInstructions || DEFAULT_PROCUREMENT_STRATEGY_GEM,
  );
  const [cadenceInstructions, setCadenceInstructions] = useState(
    accountData.step5CadenceInstructions || DEFAULT_PROCUREMENT_CADENCE_GEM,
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setRawContacts(text);
        setAccountData((prev) => ({ ...prev, procurementContacts: text }));
      }
    };
    reader.readAsText(file);
  };

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = BOOLEAN_STRING;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    document.body.removeChild(textArea);
  };

  const handleSaveContacts = () => {
    if (rawContacts.trim() !== accountData.procurementContacts) {
      setAccountData((prev) => ({ ...prev, procurementContacts: rawContacts }));
    }
  };

  const runStrategy = async () => {
    if (!rawContacts.trim()) return;
    setLoadingStrategy(true);

    const prompt = `
      Company Name: ${accountData.companyName}
      ${getStatusContext(accountData.accountStatus)}

      RAW PROCUREMENT CONTACT LIST (CRITICAL: You must ONLY select your top targets from this exact list. Do not invent names):
      ${rawContacts}

      Analyze these contacts and provide a tactical pursuit plan for Toptal based on your system instructions.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        orgStructureInsights: { type: "STRING" },
        techStackPrediction: { type: "STRING" },
        entryStrategy: { type: "STRING" },
        topTargets: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              title: { type: "STRING" },
              personaBucket: { type: "STRING" },
              reason: { type: "STRING" },
            },
            required: ["name", "title", "personaBucket", "reason"],
          },
        },
        theHook: { type: "STRING" },
        draftFLetter: {
          type: "OBJECT",
          properties: {
            trigger: { type: "STRING" },
            connection: { type: "STRING" },
            cta: { type: "STRING" },
          },
          required: ["trigger", "connection", "cta"],
        },
      },
      required: [
        "orgStructureInsights",
        "techStackPrediction",
        "entryStrategy",
        "topTargets",
        "theHook",
        "draftFLetter",
      ],
    };

    try {
      const result = await generateWithClaude<ProcurementStrategy>({
        prompt,
        system: gemInstructions,
        schema,
      });
      setAccountData((prev) => ({
        ...prev,
        step5GemInstructions: gemInstructions,
        procurementStrategy: result,
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to generate procurement strategy. Please try again.");
    } finally {
      setLoadingStrategy(false);
    }
  };

  const runCadence = async () => {
    if (!accountData.procurementStrategy) return;
    setLoadingCadence(true);

    const initiatives =
      accountData.initiativeResearch?.initiatives.map((i) => i.name).join(", ") ||
      "various engineering/technical initiatives";
    const painPoints =
      accountData.aiResearch?.prioritiesAndChallenges ||
      "scaling technical teams quickly and securely";

    const prompt = `
      Company Name: ${accountData.companyName}
      ${getStatusContext(accountData.accountStatus)}

      Top Procurement Targets to Message:
      ${JSON.stringify(accountData.procurementStrategy.topTargets)}

      Account Research & Pain Points: ${painPoints}
      Specific Initiatives Identified: ${initiatives}

      Based on this extensive account context and your system instructions, draft a 3-email "Cold-to-Meeting" cadence.
    `;

    const emailSchema = {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING" },
        body: { type: "STRING" },
      },
      required: ["subject", "body"],
    };

    const schema = {
      type: "OBJECT",
      properties: {
        email1: emailSchema,
        email2: emailSchema,
        email3: emailSchema,
      },
      required: ["email1", "email2", "email3"],
    };

    try {
      const result = await generateWithClaude<ProcurementCadence>({
        prompt,
        system: cadenceInstructions,
        schema,
      });
      setAccountData((prev) => ({
        ...prev,
        step5CadenceInstructions: cadenceInstructions,
        procurementCadence: result,
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to generate procurement cadence. Please try again.");
    } finally {
      setLoadingCadence(false);
    }
  };

  const strategy = accountData.procurementStrategy;
  const cadence = accountData.procurementCadence;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Navigate the procurement process for{" "}
          <strong>{accountData.companyName || "this account"}</strong> by
          identifying key vendor management contacts and preparing your approval
          strategy.
        </p>
        <button
          onClick={() => setShowGemConfig(!showGemConfig)}
          className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
        >
          <Settings className="w-3 h-3" />
          {showGemConfig ? "Hide Gem Config" : "Configure Gem"}
        </button>
      </div>

      {showGemConfig && (
        <div className="mb-4 p-5 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in slide-in-from-top-2 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Sales Strategist Gem Instructions (Part 3)
            </label>
            <textarea
              className="w-full h-32 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none resize-none custom-scrollbar"
              value={gemInstructions}
              onChange={(e) => setGemInstructions(e.target.value)}
            />
          </div>
          <div className="pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Cadence Copywriter Gem Instructions (Part 4)
            </label>
            <textarea
              className="w-full h-32 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none resize-none custom-scrollbar"
              value={cadenceInstructions}
              onChange={(e) => setCadenceInstructions(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Part 1 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800"></div>
          <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Part 1
            </span>
            Target Procurement (ZoomInfo)
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Copy this boolean search string directly into ZoomInfo&apos;s Job
            Title field to instantly pull the procurement, sourcing, and vendor
            management team.
          </p>
          <div className="relative group">
            <div className="bg-[#0f172a] text-emerald-400 font-mono text-sm p-4 rounded-lg pr-14 break-all shadow-inner border border-slate-700">
              {BOOLEAN_STRING}
            </div>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          {copied && (
            <p className="text-emerald-600 text-xs mt-2 font-medium">
              Copied to clipboard!
            </p>
          )}
        </div>

        {/* Part 2 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <span className="bg-blue-50 text-blue-600 border border-blue-100 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Part 2
                </span>
                Import Procurement Contacts
              </h4>
              <p className="text-sm text-gray-500">
                Paste raw text or upload the CSV of the contacts exported from
                ZoomInfo.
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".csv,.txt"
                id="csv-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap shadow-sm"
              >
                <Upload className="w-4 h-4" /> Upload CSV
              </label>
            </div>
          </div>
          <div>
            <textarea
              className="w-full h-32 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar"
              placeholder="Paste your CSV or raw contact text here (e.g., Name, Title, Email, LinkedIn Profile...)"
              value={rawContacts}
              onChange={(e) => setRawContacts(e.target.value)}
              onBlur={handleSaveContacts}
            />
            {accountData.procurementContacts && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Contacts saved to memory.
              </p>
            )}
          </div>
        </div>

        {/* Part 3 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Part 3
                </span>
                Procurement Strategy
              </h4>
              <p className="text-sm text-gray-500">
                Analyze your gathered contacts to map personas and draft your
                outreach.
              </p>
            </div>
            <button
              onClick={runStrategy}
              disabled={!rawContacts.trim() || loadingStrategy}
              className={`shrink-0 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                !rawContacts.trim()
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              }`}
            >
              {loadingStrategy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crosshair className="w-4 h-4" />
              )}
              {strategy ? "Re-Run Strategy" : "Run Strategy"}
            </button>
          </div>

          {strategy && (
            <div className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
              <div className="bg-emerald-50/30 rounded-xl p-5 border border-emerald-100 shadow-sm space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" /> Structure &amp;
                        Playbook
                      </h5>
                      <div className="bg-white p-4 rounded-lg border border-emerald-50 shadow-sm space-y-3">
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            Org Insights
                          </span>
                          <p className="text-sm text-gray-800 mt-0.5">
                            {strategy.orgStructureInsights}
                          </p>
                        </div>
                        <div className="border-t border-gray-100 pt-2">
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            Tech Prediction
                          </span>
                          <p className="text-sm text-gray-800 mt-0.5">
                            {strategy.techStackPrediction}
                          </p>
                        </div>
                        <div className="border-t border-gray-100 pt-2">
                          <span className="text-xs font-bold text-emerald-600 uppercase">
                            Recommended Play
                          </span>
                          <p className="text-sm font-semibold text-emerald-900 mt-0.5">
                            {strategy.entryStrategy}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Target className="w-4 h-4" /> Top Targets
                      </h5>
                      <div className="space-y-3">
                        {strategy.topTargets.map((target, tIdx) => (
                          <div
                            key={tIdx}
                            className="bg-white p-3 rounded-lg border border-emerald-50 shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-gray-900">
                                {target.name}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                {target.personaBucket}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 block mb-2">
                              {target.title}
                            </span>
                            <p className="text-sm text-gray-700 border-l-2 border-emerald-300 pl-2">
                              {target.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4" /> The Hook
                      </h5>
                      <p className="text-sm text-gray-800 leading-relaxed bg-white p-4 rounded-lg border border-emerald-50 shadow-sm font-medium">
                        {strategy.theHook}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Mail className="w-4 h-4" /> Draft &quot;F-Letter&quot;
                        Script
                      </h5>
                      <div className="bg-white p-5 rounded-lg border border-emerald-50 shadow-sm space-y-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Trigger (Focus on them)
                          </span>
                          <p className="text-sm text-gray-800">
                            {strategy.draftFLetter.trigger}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Connection (Toptal)
                          </span>
                          <p className="text-sm text-gray-800">
                            {strategy.draftFLetter.connection}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Call to Action
                          </span>
                          <p className="text-sm font-semibold text-emerald-700">
                            {strategy.draftFLetter.cta}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Part 4 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Part 4
                </span>
                Procurement Email Cadence
              </h4>
              <p className="text-sm text-gray-500">
                Generate a 3-email &quot;Cold-to-Meeting&quot; cadence tailored
                for your procurement contacts.
              </p>
            </div>
            <button
              onClick={runCadence}
              disabled={!strategy || loadingCadence}
              className={`shrink-0 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                !strategy
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              }`}
              title={!strategy ? "Run Part 3 Strategy First" : "Generate Cadence"}
            >
              {loadingCadence ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {cadence ? "Regenerate Cadence" : "Generate Cadence"}
            </button>
          </div>

          {cadence && (
            <div className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-6">
                {[
                  {
                    label: "Day 1",
                    title: 'Email 1: The "Talent Friction" Hook',
                    email: cadence.email1,
                    bg: "bg-indigo-600",
                  },
                  {
                    label: "Day 4",
                    title: 'Email 2: The "Procurement Value" Case',
                    email: cadence.email2,
                    bg: "bg-indigo-500",
                  },
                  {
                    label: "Day 11",
                    title: 'Email 3: The "Low-Friction" Close',
                    email: cadence.email3,
                    bg: "bg-indigo-400",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-indigo-50/40 border border-indigo-100 rounded-xl overflow-hidden shadow-sm"
                  >
                    <div className="bg-indigo-100/50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                      <span
                        className={`${item.bg} text-white text-xs font-bold px-2 py-1 rounded`}
                      >
                        {item.label}
                      </span>
                      <span className="font-semibold text-indigo-900 text-sm">
                        {item.title}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                          Subject
                        </span>
                        <p className="text-sm font-semibold text-gray-900 bg-white p-2 rounded border border-gray-100">
                          {item.email.subject}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                          Body
                        </span>
                        <div className="text-sm text-gray-800 bg-white p-3 rounded border border-gray-100 whitespace-pre-wrap leading-relaxed">
                          {item.email.body}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={onComplete}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all shadow-sm"
        >
          Mark Procurement Complete
        </button>
      </div>
    </div>
  );
}
