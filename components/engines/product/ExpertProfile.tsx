"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PRODUCT_EXPERT_GEM } from "@/lib/gems";

export function ExpertProfile({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.productEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!engine.analysis.trim() || !engine.selectedProduct.trim()) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run Step 1 (Product Analysis) first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const company = accountData.companyName || "the organization";
      const prompt = `Product: ${engine.selectedProduct}\nCompany: ${company}\n\nStep 1 Product Analysis (use this as the source for the components):\n${engine.analysis}\n\nSo, based on these components, if ${company} was in need of skilled experts to contribute to this platform, who would they be? What skillsets and expertise would they have? What tools would they be proficient in?`;
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_PRODUCT_EXPERT_GEM,
        webSearch: true,
      });
      setAccountData((prev) => ({
        ...prev,
        productEngine: {
          ...prev.productEngine,
          expertProfile:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("Expert profile error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to build expert profile.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Based on the components in the <strong>Product Analysis</strong>,
        identify the categories of expert engineers{" "}
        {accountData.companyName || "the company"} would need to contribute to{" "}
        <strong>{engine.selectedProduct}</strong> — including the expertise,
        skillsets, and tools each category should bring.
      </p>

      <button
        onClick={run}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        {engine.expertProfile ? "Re-Run Expert Profile" : "Run Expert Profile"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.expertProfile && (
        <div className="bg-purple-50/30 border border-purple-100 rounded-xl p-5 space-y-3">
          <div className="prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-h3:mt-4 prose-p:my-2 prose-li:my-0.5 prose-table:text-xs prose-th:font-semibold prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {engine.expertProfile}
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
