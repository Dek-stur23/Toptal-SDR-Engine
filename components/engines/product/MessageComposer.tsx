"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PRODUCT_MESSAGE_GEM } from "@/lib/gems";

// Defensive scrub — even if the model slips an em-dash through, strip it here
// so the rendered draft is always clean.
function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

export function MessageComposer({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.productEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (
    !engine.analysis.trim() ||
    !engine.expertProfile.trim() ||
    !engine.contact.firstName.trim()
  ) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Complete Steps 1–3 first (Product Analysis, Expert Profile, and a
        contact with at least a first name).
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const today = new Date().toDateString();
      const company = accountData.companyName || "the organization";
      const contact = engine.contact;
      const prompt = `Today: ${today}
Product: ${engine.selectedProduct}
Company: ${company}
Contact First Name: ${contact.firstName}
Contact Last Name: ${contact.lastName}
Contact Title: ${contact.title || "(unknown)"}

Step 1 Product Analysis (use this for the technical signals and the two hurdles):
${engine.analysis}

Step 2 Expert Profile (use this for the parenthetical list of expert categories in the Toptal pitch):
${engine.expertProfile}

Draft the email per the strict format. Remember: no em-dashes anywhere.`;

      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_PRODUCT_MESSAGE_GEM,
      });
      const cleaned = stripEmDashes(
        typeof result === "string" ? result : String(result ?? ""),
      );
      setAccountData((prev) => ({
        ...prev,
        productEngine: {
          ...prev.productEngine,
          craftedMessage: cleaned,
        },
      }));
    } catch (err) {
      console.error("Message composer error:", err);
      setError(err instanceof Error ? err.message : "Failed to draft message.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(engine.craftedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Draft a personalized email to{" "}
        <strong>
          {engine.contact.firstName} {engine.contact.lastName}
        </strong>{" "}
        about <strong>{engine.selectedProduct}</strong>. The draft pulls from
        the Product Analysis (Step 1) and Expert Profile (Step 2) and follows
        the strict format. No em-dashes.
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
        {engine.craftedMessage ? "Re-Run Composer" : "Compose Message"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.craftedMessage && (
        <div className="bg-purple-50/30 border border-purple-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-purple-800 text-sm uppercase tracking-wider">
              Email Draft
            </h4>
            <button
              onClick={handleCopy}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded border border-purple-100">
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
