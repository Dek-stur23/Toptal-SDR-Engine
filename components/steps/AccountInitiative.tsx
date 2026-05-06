"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Sparkles, Target } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { InitiativeResearch } from "@/lib/types";
import { generateWithClaude, getStatusContext } from "@/lib/api";
import { DEFAULT_INITIATIVE_GEM } from "@/lib/gems";

export function AccountInitiative({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!accountData.aiResearch) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Please complete Step 2 (Account Overview) first.
      </div>
    );
  }

  const runGem = async () => {
    setLoading(true);
    setError("");

    const prompt = `Based on the company ${accountData.companyName}, identify strategic business initiatives and critical challenges following your system instructions.${getStatusContext(accountData.accountStatus)}`;
    const systemPrompt = DEFAULT_INITIATIVE_GEM.replace(
      "{{Current_Date}}",
      new Date().toLocaleDateString(),
    );

    const itemSchema = {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        primarySource: { type: "STRING" },
        supportingEvidence: { type: "STRING" },
        analysis: { type: "STRING" },
        toptalHook: { type: "STRING" },
      },
      required: [
        "name",
        "primarySource",
        "supportingEvidence",
        "analysis",
        "toptalHook",
      ],
    };

    const schema = {
      type: "OBJECT",
      properties: {
        metadata: { type: "STRING" },
        initiatives: { type: "ARRAY", items: itemSchema },
        challenges: { type: "ARRAY", items: itemSchema },
      },
      required: ["metadata", "initiatives", "challenges"],
    };

    try {
      const result = await generateWithClaude<InitiativeResearch>({
        prompt,
        system: systemPrompt,
        schema,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        initiativeResearch: result,
      }));
    } catch {
      setError("Failed to gather initiative data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const research = accountData.initiativeResearch;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-2">
          Identify what <strong>{accountData.companyName}</strong> is actively
          trying to build, and the technical debt/challenges standing in their
          way.
        </p>

        <div className="flex mt-4">
          <button
            onClick={runGem}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Run Strategy Gem
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {research && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col gap-1 border-b border-indigo-200 pb-3">
            <div className="flex items-center gap-2 text-indigo-800 font-semibold text-lg">
              <Target className="w-6 h-6" />
              Executive Sales Intelligence: {accountData.companyName}
            </div>
            {research.metadata && (
              <p className="text-xs text-indigo-600 font-medium">
                Analyzed Date Range: {research.metadata}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-indigo-800 text-sm uppercase tracking-wider">
              Top Initiatives
            </h3>
            {research.initiatives.map((init, idx) => (
              <div
                key={`init-${idx}`}
                className="bg-white p-5 rounded-lg border border-indigo-200 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h4 className="text-base font-bold text-gray-900 mb-2">
                  {init.name}
                </h4>
                <div className="flex gap-4 mb-3 text-xs text-gray-500">
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    <strong>Primary:</strong> {init.primarySource}
                  </span>
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    <strong>Supporting:</strong> {init.supportingEvidence}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {init.analysis}
                </p>
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-md">
                  <h5 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                    Toptal Hook
                  </h5>
                  <p className="text-sm text-indigo-900 italic">
                    &quot;{init.toptalHook}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4 border-t border-indigo-200">
            <h3 className="font-bold text-red-800 text-sm uppercase tracking-wider flex items-center gap-2">
              Critical Challenges
            </h3>
            {research.challenges.map((challenge, idx) => (
              <div
                key={`chal-${idx}`}
                className="bg-white p-5 rounded-lg border border-red-200 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 className="text-base font-bold text-gray-900 mb-2">
                  {challenge.name}
                </h4>
                <div className="flex gap-4 mb-3 text-xs text-gray-500">
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    <strong>Primary:</strong> {challenge.primarySource}
                  </span>
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    <strong>Supporting:</strong> {challenge.supportingEvidence}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {challenge.analysis}
                </p>
                <div className="bg-red-50 border border-red-100 p-3 rounded-md">
                  <h5 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
                    Toptal Hook
                  </h5>
                  <p className="text-sm text-red-900 italic">
                    &quot;{challenge.toptalHook}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={onComplete}
              className="text-indigo-700 hover:text-indigo-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Architect <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
