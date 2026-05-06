"use client";

import { useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronRight,
  CheckCircle2,
  Circle,
  Layers,
  Lightbulb,
  Loader2,
  Rocket,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import type { AiResearch } from "@/lib/types";
import { generateWithClaude, getStatusContext } from "@/lib/api";
import { DEFAULT_ACCOUNT_INTELLIGENCE_GEM } from "@/lib/gems";

export function AccountIntelligence({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [companyName, setCompanyName] = useState(accountData.companyName || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGemConfig, setShowGemConfig] = useState(false);
  const [gemInstructions, setGemInstructions] = useState(
    accountData.gemInstructions || DEFAULT_ACCOUNT_INTELLIGENCE_GEM,
  );

  if (!accountData.accountStatus) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Please complete Step 1 (Account Relationship) first.
      </div>
    );
  }

  const runGem = async () => {
    if (!companyName.trim()) {
      setError("Please enter a company name.");
      return;
    }
    setLoading(true);
    setError("");

    const prompt = `Generate a comprehensive account sales plan for ${companyName} following your system instructions.${getStatusContext(accountData.accountStatus)}`;

    const schema = {
      type: "OBJECT",
      properties: {
        corporateStructure: { type: "STRING" },
        recentNews: { type: "STRING" },
        keyBuyers: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              department: { type: "STRING" },
              roles: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["department", "roles"],
          },
        },
        prioritiesAndChallenges: { type: "STRING" },
        roadmap: { type: "STRING" },
        pursuitStrategies: { type: "STRING" },
        swotAnalysis: {
          type: "OBJECT",
          properties: {
            strengths: { type: "ARRAY", items: { type: "STRING" } },
            weaknesses: { type: "ARRAY", items: { type: "STRING" } },
            opportunities: { type: "ARRAY", items: { type: "STRING" } },
            threats: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["strengths", "weaknesses", "opportunities", "threats"],
        },
        otherInfo: { type: "STRING" },
      },
      required: [
        "corporateStructure",
        "recentNews",
        "keyBuyers",
        "prioritiesAndChallenges",
        "roadmap",
        "pursuitStrategies",
        "swotAnalysis",
        "otherInfo",
      ],
    };

    try {
      const result = await generateWithClaude<AiResearch>({
        prompt,
        system: gemInstructions,
        schema,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        companyName,
        gemInstructions,
        aiResearch: result,
      }));
    } catch {
      setError("Failed to gather intelligence. Make sure the API key is configured.");
    } finally {
      setLoading(false);
    }
  };

  const research = accountData.aiResearch;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-end mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Target Account / Company Name
          </label>
          <button
            onClick={() => setShowGemConfig(!showGemConfig)}
            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3 h-3" />
            {showGemConfig ? "Hide Gem Config" : "Configure Gem"}
          </button>
        </div>

        {showGemConfig && (
          <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in slide-in-from-top-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Custom Gem System Instructions
            </label>
            <textarea
              className="w-full h-24 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              value={gemInstructions}
              onChange={(e) => setGemInstructions(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">
              These instructions act as the brain of your Gem, dictating its
              personality and knowledge.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="e.g., Stripe, Airbnb, or ACME Corp"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setAccountData((prev) => ({ ...prev, companyName: e.target.value }));
            }}
          />
          <button
            onClick={runGem}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Run AI Gem
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {research && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-blue-800 font-semibold border-b border-blue-200 pb-3 text-lg">
            <Building2 className="w-6 h-6" />
            Account Sales Plan: {accountData.companyName}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4" /> Corporate Structure
              </h4>
              <p className="text-gray-800 text-sm leading-relaxed">
                {research.corporateStructure}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Recent News &amp; Events
              </h4>
              <p className="text-gray-800 text-sm leading-relaxed">
                {research.recentNews}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Priorities &amp; Challenges
            </h4>
            <p className="text-gray-800 text-sm leading-relaxed">
              {research.prioritiesAndChallenges}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Rocket className="w-4 h-4" /> 12-Month Roadmap
              </h4>
              <p className="text-gray-800 text-sm leading-relaxed">
                {research.roadmap}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Pursuit Strategies (Toptal)
              </h4>
              <p className="text-gray-800 text-sm leading-relaxed">
                {research.pursuitStrategies}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Key Buyers Organization
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {research.keyBuyers.map((dept, idx) => (
                <div
                  key={idx}
                  className="bg-blue-50/50 p-3 rounded border border-blue-50"
                >
                  <span className="font-semibold text-sm text-blue-800 block mb-2">
                    {dept.department}
                  </span>
                  <ul className="space-y-1">
                    {dept.roles.map((role, rIdx) => (
                      <li
                        key={rIdx}
                        className="text-xs text-gray-700 flex items-start gap-1.5"
                      >
                        <Circle className="w-1.5 h-1.5 text-blue-400 shrink-0 mt-1.5" />
                        <span>{role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> SWOT Analysis (Toptal vs{" "}
              {accountData.companyName})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-green-50/50 p-3 rounded border border-green-100">
                <span className="font-semibold text-xs text-green-800 uppercase block mb-2">
                  Strengths
                </span>
                <ul className="space-y-1">
                  {research.swotAnalysis.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-700 flex gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />{" "}
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-50/50 p-3 rounded border border-red-100">
                <span className="font-semibold text-xs text-red-800 uppercase block mb-2">
                  Weaknesses
                </span>
                <ul className="space-y-1">
                  {research.swotAnalysis.weaknesses.map((w, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-700 flex gap-1.5"
                    >
                      <Circle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />{" "}
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
                <span className="font-semibold text-xs text-blue-800 uppercase block mb-2">
                  Opportunities
                </span>
                <ul className="space-y-1">
                  {research.swotAnalysis.opportunities.map((o, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-700 flex gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />{" "}
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-50/50 p-3 rounded border border-amber-100">
                <span className="font-semibold text-xs text-amber-800 uppercase block mb-2">
                  Threats
                </span>
                <ul className="space-y-1">
                  {research.swotAnalysis.threats.map((t, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-700 flex gap-1.5"
                    >
                      <Circle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />{" "}
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Initiatives <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
