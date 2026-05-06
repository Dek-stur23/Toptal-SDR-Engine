"use client";

import { useState } from "react";
import { ChevronRight, Copy, Loader2, Settings, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_KEYWORD_GENERATOR_GEM } from "@/lib/gems";

export function KeywordGenerator({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGemConfig, setShowGemConfig] = useState(false);
  const [gemInstructions, setGemInstructions] = useState(
    engine.keywordGeneratorGem || DEFAULT_KEYWORD_GENERATOR_GEM,
  );

  if (!engine.stackMap || !engine.featureMap) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run StackMapper and FeatureMapper first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `Stack Map:\n${engine.stackMap}\n\nFeature Map:\n${engine.featureMap}\n\nProduct / Initiative / Feature:\n${engine.productInput}\n\nProduce a boolean search string to identify individuals at ${accountData.companyName} likely working on it.`;
      const result = await generateWithClaude<string>({
        prompt,
        system: gemInstructions,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          keywords: typeof result === "string" ? result : String(result ?? ""),
          keywordGeneratorGem: gemInstructions,
        },
      }));
    } catch {
      setError("Failed to generate keywords. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(engine.keywords);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <p className="text-sm text-gray-600">
          Combine the stack and feature analyses into a boolean search string.
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
            Keyword Generator System Instructions
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
        Generate Keywords
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.keywords && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
              Boolean Search String
            </h4>
            <button
              onClick={copyToClipboard}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed bg-white p-3 rounded border border-blue-100">
            {engine.keywords}
          </pre>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Upload Contact{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
