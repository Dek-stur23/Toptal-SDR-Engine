"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { PriorityItem } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PROCUREMENT_PRIORITIES_GEM } from "@/lib/gems";

export function Priorities({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.procurementEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = engine.contactMap.find(
    (c) => c.id === engine.selectedContactId,
  );
  const profile = engine.leaderProfile;

  if (!selected || !profile) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run Leader Profile first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const companyContext = [
        accountData.aiResearch?.recentNews
          ? `Recent News:\n${accountData.aiResearch.recentNews}`
          : "",
        accountData.aiResearch?.prioritiesAndChallenges
          ? `Strategic Priorities & Challenges:\n${accountData.aiResearch.prioritiesAndChallenges}`
          : "",
        accountData.initiativeResearch?.initiatives?.length
          ? `Active Initiatives:\n${accountData.initiativeResearch.initiatives.map((i) => `- ${i.name}: ${i.analysis}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const prompt = `Leader: ${selected.name} (${selected.title}) at ${accountData.companyName || "the target company"}\n\nLeader Profile:\nTeam: ${profile.team}\nScope: ${profile.scope}\nReporting Chain: ${profile.reportingChain}\nRecent Activity:\n${profile.recentActivity.map((a) => `- ${a.headline}`).join("\n") || "(none)"}\n\nCompany Context:\n${companyContext || "(no Phase 1 research available — rely on the leader profile and public knowledge)"}`;

      const schema = {
        type: "OBJECT",
        properties: {
          priorities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                priority: { type: "STRING" },
                reasoning: { type: "STRING" },
                evidenceSource: { type: "STRING" },
              },
              required: ["priority", "reasoning", "evidenceSource"],
            },
          },
        },
        required: ["priorities"],
      };

      const result = await generateWithClaude<{ priorities: PriorityItem[] }>({
        prompt,
        system: DEFAULT_PROCUREMENT_PRIORITIES_GEM,
        schema,
        webSearch: true,
      });

      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          priorities: result.priorities || [],
          // Reset selection + crafted message when priorities change.
          selectedPriorityIndex: null,
          craftedMessage: "",
        },
      }));
    } catch (err) {
      console.error("Priorities error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to derive priorities.",
      );
    } finally {
      setLoading(false);
    }
  };

  const priorities = engine.priorities;
  const selectedIndex = engine.selectedPriorityIndex;

  const selectPriority = (index: number) => {
    setAccountData((prev) => {
      const current = prev.procurementEngine.selectedPriorityIndex;
      const sameSelection = current === index;
      return {
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          selectedPriorityIndex: sameSelection ? null : index,
          // Changing the focus invalidates the previous draft.
          craftedMessage: sameSelection
            ? prev.procurementEngine.craftedMessage
            : "",
        },
      };
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Map what <strong>{selected.name}</strong> likely cares about right now —
        a prioritized list of KPIs and pain points anchored in the leader
        profile and the company&apos;s strategic context. Click a priority to
        mark it as the focus for the Procurement Pitch.
      </p>

      <button
        onClick={run}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        {priorities.length > 0 ? "Re-Run Priorities" : "Run Priorities"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {priorities.length > 0 && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
            Priorities &amp; Pain
          </h4>
          <ul className="space-y-2">
            {priorities.map((p, i) => {
              const isSelected = selectedIndex === i;
              return (
                <li
                  key={i}
                  onClick={() => selectPriority(i)}
                  className={`text-sm text-slate-800 border rounded-lg p-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-blue-400 bg-blue-50/60"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">
                        {i + 1}. {p.priority}
                      </span>
                      {p.reasoning && (
                        <p className="text-slate-600 mt-1">{p.reasoning}</p>
                      )}
                      {p.evidenceSource &&
                        /^https?:\/\//i.test(p.evidenceSource) && (
                          <a
                            href={p.evidenceSource}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-block mt-1 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                          >
                            Source
                          </a>
                        )}
                    </div>
                    {isSelected ? (
                      <span className="shrink-0 text-blue-700 text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Focus
                      </span>
                    ) : (
                      <span className="shrink-0 text-slate-400 text-[10px] font-medium tracking-wider uppercase">
                        Click to focus
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {selectedIndex === null && (
            <p className="text-[11px] text-slate-500 italic">
              No focus selected — the Procurement Pitch will weigh all
              priorities equally. Click one above to anchor the pitch on it.
            </p>
          )}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Procurement Pitch{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
