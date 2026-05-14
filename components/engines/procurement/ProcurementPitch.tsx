"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Flame, Loader2, Save, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { ActivityLog, HotlistProspect } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PROCUREMENT_PITCH_GEM } from "@/lib/gems";

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function ProcurementPitch({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.procurementEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logged, setLogged] = useState(false);
  const [addedToHotlist, setAddedToHotlist] = useState(false);

  const selected = engine.contactMap.find(
    (c) => c.id === engine.selectedContactId,
  );
  const profile = engine.leaderProfile;
  const priorities = engine.priorities;

  if (!selected || !profile || priorities.length === 0) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Run Leader Profile and Priorities first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const focusIndex = engine.selectedPriorityIndex;
      const focusPriority =
        focusIndex !== null && focusIndex >= 0 && focusIndex < priorities.length
          ? priorities[focusIndex]
          : null;
      const prioritiesBlock = priorities
        .map((p, i) => {
          const marker = i === focusIndex ? " [FOCUS — anchor the email here]" : "";
          return `${i + 1}.${marker} ${p.priority} — ${p.reasoning}`;
        })
        .join("\n");
      const focusLine = focusPriority
        ? `\nFOCUS PRIORITY (anchor the entire email on this one): "${focusPriority.priority}"\n`
        : "\nNo single focus selected; weigh the listed priorities together when picking the angle.\n";
      const prompt = `Company: ${accountData.companyName || "the target company"}
Contact: ${selected.name} (${selected.title})
Function: ${selected.function}
What they likely own: ${selected.ownsHint}

Leader Profile:
- Team: ${profile.team}
- Scope: ${profile.scope}
- Reporting Chain: ${profile.reportingChain}
- Recent Activity: ${profile.recentActivity.map((a) => a.headline).join("; ") || "(none)"}

Priorities & Pain:
${prioritiesBlock}
${focusLine}
Draft the personalized procurement-leader email per the strict format.`;

      const result = await generateWithClaude<string>({
        prompt,
        system: DEFAULT_PROCUREMENT_PITCH_GEM,
      });

      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          craftedMessage:
            typeof result === "string" ? result : String(result ?? ""),
        },
      }));
    } catch (err) {
      console.error("ProcurementPitch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to draft procurement pitch.",
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(engine.craftedMessage);
    }
  };

  const logMessage = () => {
    if (!engine.craftedMessage || !selected) return;
    const { firstName, lastName } = splitName(selected.name);
    const newLog: ActivityLog = {
      id: Date.now(),
      type: "Message Sent",
      firstName,
      lastName,
      title: selected.title,
      company: accountData.companyName || "",
      linkedinUrl: "",
      notes: "Procurement Pitch drafted via Procurement Engine.",
      date: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      message: engine.craftedMessage,
    };
    setAccountData((prev) => ({
      ...prev,
      activityLogs: [newLog, ...(prev.activityLogs || [])],
    }));
    setLogged(true);
    setTimeout(() => setLogged(false), 2000);
  };

  const addToHotlist = () => {
    if (!selected) return;
    const { firstName, lastName } = splitName(selected.name);
    const prospect: HotlistProspect = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      title: selected.title,
      company: accountData.companyName || "",
      linkedinUrl: "",
      priority: "high",
      notes: `Added from Procurement Engine (${selected.function}).`,
      dateAdded: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      messages: [],
      image: engine.leaderImage,
    };
    setAccountData((prev) => ({
      ...prev,
      hotlist: [prospect, ...(prev.hotlist || [])],
    }));
    setAddedToHotlist(true);
    setTimeout(() => setAddedToHotlist(false), 2000);
  };

  const focusIdx = engine.selectedPriorityIndex;
  const focusPriority =
    focusIdx !== null && focusIdx >= 0 && focusIdx < priorities.length
      ? priorities[focusIdx]
      : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Generate a personalized email for{" "}
        <strong>{selected.name}</strong> using the profile + priorities
        gathered above. ProcurementVoice Pro frames Toptal as the
        de-risking layer, not the engineering vendor.
      </p>

      {focusPriority ? (
        <div className="bg-blue-50/60 border border-blue-200 rounded-md p-3 text-sm text-slate-800">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            Focus priority
          </span>
          {focusPriority.priority}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No focus priority selected — the pitch will weigh all priorities
          together. Pick one in the Priorities step to anchor it.
        </p>
      )}

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
        {engine.craftedMessage ? "Re-Run Procurement Pitch" : "Craft Procurement Pitch"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.craftedMessage && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">
              Procurement Leader Outreach
            </h4>
            <button
              onClick={copy}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white p-3 rounded border border-blue-100">
            {engine.craftedMessage}
          </pre>
          <div className="pt-2 flex justify-end gap-3 items-center flex-wrap">
            <button
              onClick={addToHotlist}
              className="text-orange-700 hover:text-orange-900 font-medium text-sm flex items-center gap-1"
            >
              {addedToHotlist ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Added to Hotlist
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" /> Add to Hotlist
                </>
              )}
            </button>
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
