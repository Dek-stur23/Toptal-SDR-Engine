"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import {
  DEFAULT_MESSAGE_CRAFTER_GEM,
  DEFAULT_TECHNICAL_AUDITOR_GEM,
  DEFAULT_TECHNOGRAPHIC_PITCH_GEM,
} from "@/lib/gems";
import { stackToText } from "@/lib/stack";

type ActionKey = "technographic" | "personalized" | "auditor";

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
      stackMap: stackToText(engine.stack),
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
    } catch (err) {
      console.error("Technographic pitch error:", err);
      setError(err instanceof Error ? err.message : "Failed to craft technographic sales pitch.");
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
    } catch (err) {
      console.error("Peer-to-peer outreach error:", err);
      setError(err instanceof Error ? err.message : "Failed to craft peer-to-peer message.");
    } finally {
      setLoading(null);
    }
  };

  const runAuditor = async () => {
    setLoading("auditor");
    setError("");
    try {
      const prompt = buildPrompt(
        'Generate the DirectGap Pro "Direct Audit" email using the inputs below. Be ultra-direct and stay under 120 words.',
      );
      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_TECHNICAL_AUDITOR_GEM,
        image: contact.liImage,
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
      setError(err instanceof Error ? err.message : "Failed to craft technical auditor outreach.");
    } finally {
      setLoading(null);
    }
  };

  const runAll = async () => {
    setError("");
    try {
      await runTechnographic();
      await runPersonalized();
      await runAuditor();
    } finally {
      setLoading(null);
    }
  };

  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const anyOutput =
    !!engine.technographicPitch ||
    !!engine.craftedMessage ||
    !!engine.technicalAuditor;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate messaging tailored to{" "}
        <strong>
          {contact.firstName} {contact.lastName}
        </strong>
        . Pick any of the three options or run all.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <OptionCard
          title="Craft Technographic Sales Pitch"
          description='OutreachSynthesizer Pro converts your StackMapper / FeatureMapper / TalentSource intel into the "Talent Friction" Insight email aimed at VPs of Engineering / CTOs.'
          buttonLabel="Craft Technographic Pitch"
          loading={loading === "technographic"}
          disabled={loading !== null}
          onRun={runTechnographic}
        />
        <OptionCard
          title="Peer-to-Peer Outreach"
          description='ArchitectWriter Pro synthesizes StackMapper and FeatureMapper into an "Architect-to-Architect" email — engineering observations, not marketing copy.'
          buttonLabel="Craft Peer-to-Peer Email"
          loading={loading === "personalized"}
          disabled={loading !== null}
          onRun={runPersonalized}
        />
        <OptionCard
          title="Craft Technical Auditor Outreach"
          description='DirectGap Pro produces an ultra-direct "Direct Audit" email under 120 words — a stack list plus one diagnostic friction question.'
          buttonLabel="Craft Auditor Email"
          loading={loading === "auditor"}
          disabled={loading !== null}
          onRun={runAuditor}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={runAll}
          disabled={loading !== null}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          Or run all
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
          heading="Peer-to-Peer Outreach"
          content={engine.craftedMessage}
          onCopy={() => copy(engine.craftedMessage)}
        />
      )}

      {engine.technicalAuditor && (
        <ResultCard
          heading="Technical Auditor Outreach"
          content={engine.technicalAuditor}
          onCopy={() => copy(engine.technicalAuditor)}
        />
      )}

      {anyOutput && (
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
