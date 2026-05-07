"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_STACK_MAPPER_GEM } from "@/lib/gems";

export function StackMapper({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!accountData.companyName.trim()) {
      setError("Set a company name on the account first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const prompt = `Build a comprehensive tech stack map for ${accountData.companyName}.`;
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_STACK_MAPPER_GEM,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          stackMap: typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("StackMapper error:", err);
      setError(err instanceof Error ? err.message : "Failed to run StackMapper.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Research <strong>{accountData.companyName || "the company"}</strong>{" "}
        and build a comprehensive map of its likely technology stack.
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
        Run StackMapper
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.stackMap && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
            Stack Map
          </h4>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
            {engine.stackMap}
          </pre>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to FeatureMapper{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
