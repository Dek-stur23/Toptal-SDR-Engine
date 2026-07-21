"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PRODUCT_ANALYSIS_GEM } from "@/lib/gems";

export function ProductAnalysis({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.productEngine;
  const productMap = accountData.productMap;
  const entries = productMap?.entries ?? [];

  const [productInput, setProductInput] = useState(engine.selectedProduct || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    const target = productInput.trim();
    if (!target) {
      setError("Pick a product from the map or type one in first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const companyContext = accountData.companyName
        ? ` (at ${accountData.companyName})`
        : "";
      const prompt = `Can you analyze the ${target}${companyContext} platform/technology and extract 2-3 technical components?`;
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_PRODUCT_ANALYSIS_GEM,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        productEngine: {
          ...prev.productEngine,
          selectedProduct: target,
          analysis: typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("Product analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to run analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Pick a product or project from the Product &amp; Project Map (Phase 1
        Step 4) or type one in. The AI will analyze it and extract 2–3 key
        technical components.
      </p>

      {entries.length > 0 ? (
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Pick from Product &amp; Project Map
          </label>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 pr-9 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val) setProductInput(val);
              }}
            >
              <option value="">Choose…</option>
              {entries.map((entry, i) => (
                <option key={`${entry.name}-${i}`} value={entry.name}>
                  {entry.name} — {entry.category}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          Run Phase 1 Step 4 (Product &amp; Project Map) to populate the
          dropdown, or just type a product name below.
        </p>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Product or Project to Analyze *
        </label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
          placeholder="e.g., Ticketmaster Ignite"
          value={productInput}
          onChange={(e) => setProductInput(e.target.value)}
        />
      </div>

      <button
        onClick={run}
        disabled={loading || !productInput.trim()}
        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        {engine.analysis ? "Re-Run Analysis" : "Run Analysis"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.analysis && (
        <div className="bg-purple-50/30 border border-purple-100 rounded-xl p-5 space-y-3">
          <div className="prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-h3:mt-4 prose-p:my-2 prose-li:my-0.5 prose-table:text-xs prose-th:font-semibold prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {engine.analysis}
            </ReactMarkdown>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-purple-700 hover:text-purple-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
