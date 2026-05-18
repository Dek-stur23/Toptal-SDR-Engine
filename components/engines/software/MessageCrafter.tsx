"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Save, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { ActivityLog } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_TECHNICAL_AUDITOR_GEM } from "@/lib/gems";
import { loadImage } from "@/lib/imageStore";
import { stackToText } from "@/lib/stack";

const COMPANY_PLACEHOLDER = "the target company";

export function MessageCrafter({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const contact = engine.contact;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logged, setLogged] = useState(false);

  const hasContact =
    !!contact.firstName && !!contact.lastName && !!contact.title;

  if (!engine.featureMap || !hasContact) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run FeatureMapper and Upload Contact first.
      </div>
    );
  }

  const contactLine = `${contact.firstName} ${contact.lastName} - ${contact.title} @ ${contact.company}`;
  const companyName = accountData.companyName || COMPANY_PLACEHOLDER;

  const buildPrompt = () => {
    const intro =
      'Generate the DirectGap Pro "Direct Audit" email using the inputs below. Stay conversational and around 220 words; do not skip the QB analogy.';
    const context = [
      `Company: ${companyName}`,
      `Contact:\n${contactLine}`,
      `LinkedIn Context:\n${contact.liText || "(see attached image, if any)"}`,
      `Product / Initiative / Feature:\n${engine.productInput || "(not provided)"}`,
      `StackMapper Output:\n${stackToText(engine.stack) || "(none)"}`,
      `FeatureMapper Output:\n${engine.featureMap || "(none)"}`,
    ].join("\n\n");
    return `${intro}\n\n${context}`;
  };

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const imageBytes = contact.liImage
        ? await loadImage(contact.liImage)
        : null;
      const result = await generateWithClaude<string>({
        prompt: buildPrompt(),
        system: DEFAULT_TECHNICAL_AUDITOR_GEM,
        image: imageBytes,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          technicalAuditor:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("Technical auditor error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to craft technical auditor outreach.",
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const logMessage = () => {
    if (!engine.technicalAuditor) return;
    const newLog: ActivityLog = {
      id: Date.now(),
      type: "Message Sent",
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title,
      company: contact.company || companyName,
      linkedinUrl: "",
      notes: "Technical Auditor outreach drafted via Software Engine.",
      date: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      message: engine.technicalAuditor,
    };
    setAccountData((prev) => ({
      ...prev,
      activityLogs: [newLog, ...(prev.activityLogs || [])],
    }));
    setLogged(true);
    setTimeout(() => setLogged(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        DirectGap Pro produces a conversational &quot;Direct Audit&quot; email
        for{" "}
        <strong>
          {contact.firstName} {contact.lastName}
        </strong>
        : a stack list with plain-English purposes, a friction question, and
        the &quot;veteran QB on the bench&quot; pitch.
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
        Craft Technical Auditor Outreach
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.technicalAuditor && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
              Technical Auditor Outreach
            </h4>
            <button
              onClick={() => copy(engine.technicalAuditor)}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded border border-blue-100">
            {engine.technicalAuditor}
          </pre>
          <div className="pt-2 flex justify-end gap-3 items-center">
            <button
              onClick={logMessage}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              {logged ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Logged
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Log Message
                </>
              )}
            </button>
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
