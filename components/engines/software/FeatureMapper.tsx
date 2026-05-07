"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_FEATURE_MAPPER_GEM } from "@/lib/gems";
import { stackHasAny, stackToText } from "@/lib/stack";

export function FeatureMapper({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const [productInput, setProductInput] = useState(engine.productInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!stackHasAny(engine.stack)) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Fill in at least one StackMapper section first.
      </div>
    );
  }

  const run = async () => {
    if (!productInput.trim()) {
      setError("Provide a product, initiative, or feature to map.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const prompt = `Stack Map:\n${stackToText(engine.stack)}\n\nProduct / Initiative / Feature:\n${productInput}\n\nIdentify the relevant stack components and how each is involved.`;
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_FEATURE_MAPPER_GEM,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          productInput,
          featureMap: typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("FeatureMapper error:", err);
      setError(err instanceof Error ? err.message : "Failed to run FeatureMapper.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Match the stack components to a specific product, initiative, or
        feature.
      </p>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Product / Initiative / Feature *
        </label>
        <textarea
          className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
          placeholder="e.g. 'Realtime fraud detection in the payments platform' or 'Customer-facing AI assistant'..."
          value={productInput}
          onChange={(e) => setProductInput(e.target.value)}
        />
      </div>

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
        Run FeatureMapper
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.featureMap && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
            Feature Map
          </h4>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
            {engine.featureMap}
          </pre>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Keyword Generator{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
