"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Settings, Sparkles } from "lucide-react";
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
  const [showGemConfig, setShowGemConfig] = useState(false);
  const [gemInstructions, setGemInstructions] = useState(
    engine.stackMapperGem || DEFAULT_STACK_MAPPER_GEM,
  );

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
        system: gemInstructions,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          stackMap: typeof result === "string" ? result : String(result ?? ""),
          stackMapperGem: gemInstructions,
        },
      }));
    } catch {
      setError("Failed to run StackMapper. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <p className="text-sm text-gray-600">
          Research <strong>{accountData.companyName || "the company"}</strong>{" "}
          and build a comprehensive map of its likely technology stack.
        </p>
        <button
          onClick={() => setShowGemConfig(!showGemConfig)}
          className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
        >
          <Settings className="w-3 h-3" />
          {showGemConfig ? "Hide Gem" : "Configure Gem"}
        </button>
      </div>

      {showGemConfig && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            StackMapper System Instructions
          </label>
          <textarea
            className="w-full h-40 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar"
            value={gemInstructions}
            onChange={(e) => setGemInstructions(e.target.value)}
          />
        </div>
      )}

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
