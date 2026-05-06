"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_MESSAGE_CRAFTER_GEM } from "@/lib/gems";

export function MessageCrafter({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const contact = engine.contact;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasContact =
    !!contact.firstName && !!contact.lastName && !!contact.title;

  if (!engine.featureMap || !hasContact) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run FeatureMapper and Upload Contact first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `Contact:\n${contact.firstName} ${contact.lastName} - ${contact.title} @ ${contact.company}\n\nLinkedIn Context:\n${contact.liText || "(see attached image, if any)"}\n\nProduct / Initiative / Feature:\n${engine.productInput}\n\nRelevant Stack Components (FeatureMapper output):\n${engine.featureMap}\n\nCraft a personalized outreach message for this contact.`;
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_MESSAGE_CRAFTER_GEM,
        image: contact.liImage,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          craftedMessage:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch {
      setError("Failed to craft message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(engine.craftedMessage);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate messaging tailored to{" "}
        <strong>
          {contact.firstName} {contact.lastName}
        </strong>
        , the product/initiative, and the relevant stack components.
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
        Craft Message
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.craftedMessage && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
              Drafted Message
            </h4>
            <button
              onClick={copyToClipboard}
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
