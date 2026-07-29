"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { LushaCleanup } from "@/components/LushaCleanup";
import { LushaCsvPrep } from "@/components/LushaCsvPrep";

// Two-step ZoomInfo ↔ Lusha ↔ SalesLoft workflow.
//
// Step 1 (Prep): reshape a ZoomInfo Person export into a minimal
// Lusha-ready CSV (Part 1).
// Step 2 (Clean up): take the enriched CSV Lusha returns and produce
// a SalesLoft-mappable file, flagging apparent job changes along the
// way (Part 2).
//
// Rendering both under one page keeps the workflow discoverable and
// avoids the user hunting for two separate tools that pair together.

type Step = "prep" | "cleanup";

export function LushaCsvWorkflow() {
  const [step, setStep] = useState<Step>("prep");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> ZoomInfo → Lusha CSV
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Two-step CSV workflow. Prep a ZoomInfo export for Lusha enrichment,
          then clean up the file Lusha returns for SalesLoft import.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit">
        <StepButton
          active={step === "prep"}
          onClick={() => setStep("prep")}
          index={1}
          label="Prep for Lusha"
          sublabel="ZoomInfo → Lusha"
        />
        <StepButton
          active={step === "cleanup"}
          onClick={() => setStep("cleanup")}
          index={2}
          label="Clean up from Lusha"
          sublabel="Lusha → SalesLoft"
        />
      </div>

      {step === "prep" ? <LushaCsvPrep /> : <LushaCleanup />}
    </div>
  );
}

function StepButton({
  active,
  onClick,
  index,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  index: number;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          active ? "bg-white text-slate-900" : "bg-slate-200 text-slate-600"
        }`}
      >
        {index}
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-semibold leading-tight">{label}</span>
        <span
          className={`text-[10px] leading-tight ${
            active ? "text-white/70" : "text-slate-500"
          }`}
        >
          {sublabel}
        </span>
      </span>
    </button>
  );
}
