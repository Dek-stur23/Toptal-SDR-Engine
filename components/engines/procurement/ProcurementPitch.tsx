"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PROCUREMENT_PITCH_GEM } from "@/lib/gems";

export function ProcurementPitch({
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
  const priorities = engine.priorities;

  if (!selected || !profile || priorities.length === 0) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run Leader Profile and Priorities first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prioritiesBlock = priorities
        .map((p, i) => `${i + 1}. ${p.priority} — ${p.reasoning}`)
        .join("\n");
      const prompt = `Company: ${accountData.companyName || "the target company"}
Contact: ${selected.name} (${selected.title})
Function: ${selected.function}
What they likely own: ${selected.ownsHint}

Leader Profile:
- Team: ${profile.team}
- Scope: ${profile.scope}
- Reporting Chain: ${profile.reportingChain}
- Recent Activity: ${profile.recentActivity.map((a) => a.headline).join("; ") || "(none)"}

Priorities & Pain:
${prioritiesBlock}

Draft the personalized procurement-leader email per the strict format.`;

      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_PROCUREMENT_PITCH_GEM,
      });

      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          craftedMessage:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("ProcurementPitch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to draft procurement pitch.",
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(engine.craftedMessage);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate a personalized email for{" "}
        <strong>{selected.name}</strong> using the profile + priorities
        gathered above. ProcurementVoice Pro frames Toptal as the
        de-risking layer, not the engineering vendor.
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
        {engine.craftedMessage ? "Re-Run Procurement Pitch" : "Craft Procurement Pitch"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.craftedMessage && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
              Procurement Leader Outreach
            </h4>
            <button
              onClick={copy}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded border border-blue-100">
            {engine.craftedMessage}
          </pre>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-emerald-700 hover:text-emerald-900 font-medium text-sm flex items-center gap-1"
            >
              Mark Complete <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
