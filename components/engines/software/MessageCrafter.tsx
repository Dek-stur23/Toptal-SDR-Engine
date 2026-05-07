"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import {
  DEFAULT_MESSAGE_CRAFTER_GEM,
  DEFAULT_TECHNOGRAPHIC_PITCH_GEM,
} from "@/lib/gems";

type ActionKey = "technographic" | "personalized";

const COMPANY_PLACEHOLDER = "the target company";

function buildContext(args: {
  contactLine: string;
  liText: string;
  productInput: string;
  stackMap: string;
  featureMap: string;
  keywords: string;
  companyName: string;
}) {
  return [
    `Company: ${args.companyName || COMPANY_PLACEHOLDER}`,
    `Contact:\n${args.contactLine}`,
    `LinkedIn Context:\n${args.liText || "(see attached image, if any)"}`,
    `Product / Initiative / Feature:\n${args.productInput || "(not provided)"}`,
    `StackMapper Output:\n${args.stackMap || "(none)"}`,
    `FeatureMapper Output:\n${args.featureMap || "(none)"}`,
    `TalentSource (Keyword Generator) Output:\n${args.keywords || "(none)"}`,
  ].join("\n\n");
}

export function MessageCrafter({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const contact = engine.contact;
  const [loading, setLoading] = useState<ActionKey | null>(null);
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

  const contactLine = `${contact.firstName} ${contact.lastName} - ${contact.title} @ ${contact.company}`;

  const buildPrompt = (intro: string) =>
    `${intro}\n\n${buildContext({
      contactLine,
      liText: contact.liText,
      productInput: engine.productInput,
      stackMap: engine.stackMap,
      featureMap: engine.featureMap,
      keywords: engine.keywords,
      companyName: accountData.companyName,
    })}`;

  const runTechnographic = async () => {
    setLoading("technographic");
    setError("");
    try {
      const prompt = buildPrompt(
        "Synthesize the inputs below into the OutreachSynthesizer Pro 'Talent Friction' Insight email format.",
      );
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_TECHNOGRAPHIC_PITCH_GEM,
        image: contact.liImage,
      });
      setAccountData((prev) => ({
        ...prev,
        softwareEngine: {
          ...prev.softwareEngine,
          technographicPitch:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch {
      setError("Failed to craft technographic sales pitch. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const runPersonalized = async () => {
    setLoading("personalized");
    setError("");
    try {
      const prompt = buildPrompt(
        "Craft a personalized outreach message for this contact using the inputs below.",
      );
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
      setError("Failed to craft personalized message. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const runBoth = async () => {
    setLoading("technographic");
    setError("");
    try {
      await runTechnographic();
      await runPersonalized();
    } finally {
      setLoading(null);
    }
  };

  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const eitherOutput = !!engine.technographicPitch || !!engine.craftedMessage;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate messaging tailored to{" "}
        <strong>
          {contact.firstName} {contact.lastName}
        </strong>
        . Pick one option, the other, or run both.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OptionCard
          title="Craft Technographic Sales Pitch"
          description='OutreachSynthesizer Pro converts your StackMapper / FeatureMapper / TalentSource intel into the "Talent Friction" Insight email aimed at VPs of Engineering / CTOs.'
          buttonLabel="Craft Technographic Pitch"
          loading={loading === "technographic"}
          disabled={loading !== null}
          onRun={runTechnographic}
        />
        <OptionCard
          title="Craft Personalized Outreach"
          description="MessageCrafter writes a short, peer-to-peer outreach message tied to the contact, the initiative, and the relevant stack components."
          buttonLabel="Craft Personalized Message"
          loading={loading === "personalized"}
          disabled={loading !== null}
          onRun={runPersonalized}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={runBoth}
          disabled={loading !== null}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          Or run both
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.technographicPitch && (
        <ResultCard
          heading="Technographic Sales Pitch"
          content={engine.technographicPitch}
          onCopy={() => copy(engine.technographicPitch)}
        />
      )}

      {engine.craftedMessage && (
        <ResultCard
          heading="Personalized Outreach"
          content={engine.craftedMessage}
          onCopy={() => copy(engine.craftedMessage)}
        />
      )}

      {eitherOutput && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={onComplete}
            className="text-emerald-700 hover:text-emerald-900 font-medium text-sm flex items-center gap-1"
          >
            Mark Complete <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function OptionCard({
  title,
  description,
  buttonLabel,
  loading,
  disabled,
  onRun,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  loading: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="border border-blue-100 rounded-xl bg-white p-4 flex flex-col gap-3 shadow-sm">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-1">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onRun}
        disabled={disabled}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-sm"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {buttonLabel}
      </button>
    </div>
  );
}

function ResultCard({
  heading,
  content,
  onCopy,
}: {
  heading: string;
  content: string;
  onCopy: () => void;
}) {
  return (
    <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
          {heading}
        </h4>
        <button
          onClick={onCopy}
          className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
      <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded border border-blue-100">
        {content}
      </pre>
    </div>
  );
}
