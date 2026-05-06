"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Circle,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import type { ArchitectResult, InitiativeOrChallenge } from "@/lib/types";
import { generateWithClaude, getStatusContext } from "@/lib/api";
import { DEFAULT_ARCHITECT_GEM } from "@/lib/gems";

type StrategicItem = InitiativeOrChallenge & { type: "Initiative" | "Challenge" };

export function InitiativeArchitect({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  if (
    !accountData.initiativeResearch ||
    (!accountData.initiativeResearch.initiatives.length &&
      !accountData.initiativeResearch.challenges.length)
  ) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Please complete Step 3 (Account Initiative &amp; Challenges) first.
      </div>
    );
  }

  const strategicItems: StrategicItem[] = [
    ...accountData.initiativeResearch.initiatives.map((i) => ({
      ...i,
      type: "Initiative" as const,
    })),
    ...accountData.initiativeResearch.challenges.map((c) => ({
      ...c,
      type: "Challenge" as const,
    })),
  ];

  const architectResults = accountData.architectResults || {};

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => ({
      ...prev,
      [idx]: prev[idx] === false ? true : false,
    }));
  };

  const runArchitect = async (item: StrategicItem, index: number) => {
    setLoadingId(index);

    const prompt = `
      Company Name: ${accountData.companyName}
      Specific Initiative/Challenge: ${item.name}
      Context/Analysis: ${item.analysis}
      ${getStatusContext(accountData.accountStatus)}

      Generate the architectural and strategic breakdown for this initiative following your system instructions.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        simpleEnglish: { type: "STRING" },
        projectAnatomy: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              pillar: { type: "STRING" },
              description: { type: "STRING" },
            },
            required: ["pillar", "description"],
          },
        },
        talentMap: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING" },
              roles: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["category", "roles"],
          },
        },
        salesEdgeQuestions: { type: "ARRAY", items: { type: "STRING" } },
        redFlags: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: [
        "simpleEnglish",
        "projectAnatomy",
        "talentMap",
        "salesEdgeQuestions",
        "redFlags",
      ],
    };

    try {
      const result = await generateWithClaude<ArchitectResult>({
        prompt,
        system: DEFAULT_ARCHITECT_GEM,
        schema,
      });
      setAccountData((prev) => ({
        ...prev,
        architectResults: { ...(prev.architectResults || {}), [index]: result },
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to generate architecture for this item. Please try again.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 mb-2">
        Architect specific talent solutions and messaging hooks for each
        identified initiative.
      </p>

      <div className="space-y-4">
        {strategicItems.map((item, idx) => {
          const isExpanded = expandedItems[idx] !== false;
          const result = architectResults[idx];

          return (
            <div
              key={idx}
              className={`border bg-white rounded-lg shadow-sm transition-all hover:border-amber-300 ${
                item.type === "Challenge" ? "border-red-100" : "border-indigo-100"
              }`}
            >
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer"
                onClick={() => toggleItem(idx)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.type === "Challenge"
                          ? "bg-red-100 text-red-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                    {item.name}
                  </h4>
                </div>
                <div className="text-gray-400 pl-4">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mt-1">{item.analysis}</p>
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row gap-2 mt-2 xl:mt-0">
                      <button
                        onClick={() => runArchitect(item, idx)}
                        disabled={loadingId === idx}
                        className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 whitespace-nowrap"
                      >
                        {loadingId === idx ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {result ? "Re-Run Architect" : "Run Architect"}
                      </button>
                    </div>
                  </div>

                  {result && (
                    <div className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                      <div className="bg-[#FFFDF7] rounded-xl p-5 space-y-6 border border-amber-100 shadow-sm">
                        <div>
                          <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Lightbulb className="w-4 h-4" /> The &quot;Simple
                            English&quot; Breakdown
                          </h5>
                          <p className="text-sm text-gray-800 leading-relaxed bg-white p-3 rounded-lg border border-amber-50 shadow-sm">
                            {result.simpleEnglish}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Layers className="w-4 h-4" /> Project Anatomy
                            </h5>
                            <div className="space-y-2">
                              {result.projectAnatomy.map((anatomy, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="bg-white p-3 rounded-lg border border-amber-50 text-sm shadow-sm"
                                >
                                  <span className="font-semibold text-amber-900 block mb-0.5">
                                    {anatomy.pillar}
                                  </span>
                                  <span className="text-gray-700">
                                    {anatomy.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <Users className="w-4 h-4" /> Toptal Talent Map
                            </h5>
                            <div className="space-y-3">
                              {result.talentMap.map((category, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="bg-white p-3 rounded-lg border border-amber-50 shadow-sm"
                                >
                                  <span className="font-semibold text-xs text-amber-700 uppercase block mb-1.5">
                                    {category.category}
                                  </span>
                                  <ul className="space-y-1">
                                    {category.roles.map((role, rIdx) => (
                                      <li
                                        key={rIdx}
                                        className="text-sm text-gray-700 flex items-start gap-1.5"
                                      >
                                        <Circle className="w-1.5 h-1.5 text-amber-400 shrink-0 mt-1.5" />
                                        <span>{role}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                          <div>
                            <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <HelpCircle className="w-4 h-4" /> &quot;Sales
                              Edge&quot; Questions
                            </h5>
                            <ul className="space-y-2">
                              {result.salesEdgeQuestions.map((q, qIdx) => (
                                <li
                                  key={qIdx}
                                  className="bg-white p-3 rounded-lg border border-amber-50 text-sm text-gray-800 font-medium italic shadow-sm"
                                >
                                  &quot;{q}&quot;
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" /> Red Flags
                              &amp; Cost of Delay
                            </h5>
                            <ul className="space-y-2">
                              {result.redFlags.map((flag, fIdx) => (
                                <li
                                  key={fIdx}
                                  className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-900 flex items-start gap-2 shadow-sm"
                                >
                                  <Circle className="w-1.5 h-1.5 text-red-500 shrink-0 mt-1.5" />
                                  <span>{flag}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onComplete}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all shadow-sm"
        >
          Save &amp; Continue to Procurement
        </button>
      </div>
    </div>
  );
}
