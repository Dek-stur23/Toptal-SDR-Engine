"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight as ChevronRightIcon, Eye, Pencil } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { StackBuckets } from "@/lib/types";
import { STACK_BUCKETS, stackHasAny } from "@/lib/stack";

type Mode = "edit" | "preview";

export function StackMapper({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const stack = accountData.softwareEngine.stack;

  const update = (key: keyof StackBuckets, value: string) => {
    setAccountData((prev) => ({
      ...prev,
      softwareEngine: {
        ...prev.softwareEngine,
        stack: { ...prev.softwareEngine.stack, [key]: value },
      },
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Paste the StackMapper output for{" "}
        <strong>{accountData.companyName || "the company"}</strong> into each
        section below. Markdown (tables, links, headings) renders in preview.
      </p>

      <div className="space-y-3">
        {STACK_BUCKETS.map((bucket) => (
          <BucketCard
            key={bucket.key}
            label={bucket.label}
            value={stack[bucket.key]}
            onChange={(v) => update(bucket.key, v)}
          />
        ))}
      </div>

      {stackHasAny(stack) && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={onComplete}
            className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
          >
            Save &amp; Continue to FeatureMapper{" "}
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function BucketCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hasContent = value.trim().length > 0;
  const [open, setOpen] = useState(!hasContent);
  const [mode, setMode] = useState<Mode>(hasContent ? "preview" : "edit");

  return (
    <div className="border border-blue-100 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-slate-500" />
          )}
          <span className="font-semibold text-sm text-slate-900">{label}</span>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            hasContent
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-slate-50 text-slate-400 border border-slate-100"
          }`}
        >
          {hasContent ? "Filled" : "Empty"}
        </span>
      </button>

      {open && (
        <div className="border-t border-blue-100 px-4 py-3 space-y-3">
          {hasContent && (
            <div className="flex justify-end">
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-xs">
                <button
                  onClick={() => setMode("edit")}
                  className={`px-2 py-1 flex items-center gap-1 transition-colors ${
                    mode === "edit"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => setMode("preview")}
                  className={`px-2 py-1 flex items-center gap-1 transition-colors ${
                    mode === "preview"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
            </div>
          )}

          {mode === "edit" || !hasContent ? (
            <textarea
              className="w-full h-48 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-y custom-scrollbar font-mono"
              placeholder={`Paste the ${label} markdown here...`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <div className="prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-p:my-2 prose-li:my-0.5 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
