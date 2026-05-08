"use client";

import { useState } from "react";
import {
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import type { LeaderProfile as LeaderProfileData } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PROCUREMENT_LEADER_PROFILE_GEM } from "@/lib/gems";

export function LeaderProfile({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.procurementEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = engine.contactMap.find(
    (c) => c.id === engine.selectedContactId,
  );

  if (!selected) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Pick a leader in the Contact Map step first.
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") return;
      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          leaderImage: reader.result as string,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setAccountData((prev) => ({
      ...prev,
      procurementEngine: { ...prev.procurementEngine, leaderImage: null },
    }));
  };

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const screenshotNote = engine.leaderImage
        ? "\n\nA LinkedIn screenshot is attached. Treat it as the most authoritative source for this leader's title, team, scope, and recent activity. Web search is supplementary — corroborate, do not contradict."
        : "";
      const prompt = `Profile this procurement leader at ${accountData.companyName || "the target company"}:\n\nName: ${selected.name}\nTitle: ${selected.title}\nClassified function: ${selected.function}\nSeniority: ${selected.seniority}\nWhat they likely own (initial inference): ${selected.ownsHint}${screenshotNote}`;
      const schema = {
        type: "OBJECT",
        properties: {
          team: { type: "STRING" },
          scope: { type: "STRING" },
          reportingChain: { type: "STRING" },
          recentActivity: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                headline: { type: "STRING" },
                source: { type: "STRING" },
              },
              required: ["headline", "source"],
            },
          },
        },
        required: ["team", "scope", "reportingChain", "recentActivity"],
      };
      const result = await generateWithClaude<LeaderProfileData>({
        prompt,
        system: DEFAULT_PROCUREMENT_LEADER_PROFILE_GEM,
        schema,
        webSearch: true,
        image: engine.leaderImage,
      });
      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          leaderProfile: result,
          // Reset downstream output when the profile changes.
          priorities: [],
          craftedMessage: "",
        },
      }));
    } catch (err) {
      console.error("LeaderProfile error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to research leader.",
      );
    } finally {
      setLoading(false);
    }
  };

  const profile = engine.leaderProfile;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Research <strong>{selected.name}</strong> ({selected.title}) at{" "}
        {accountData.companyName || "the target company"} — what their team
        owns, who they report to, and what they&apos;ve said publicly.
      </p>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          LinkedIn Screenshot{" "}
          <span className="text-slate-400 font-normal normal-case">
            (optional — prioritized over web research when provided)
          </span>
        </label>
        <div className="border-2 border-dashed border-blue-200 rounded-lg h-24 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-blue-50/50 transition-colors">
          {engine.leaderImage ? (
            <div className="w-full h-full relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={engine.leaderImage}
                alt={`LinkedIn screenshot for ${selected.name}`}
                className="w-full h-full object-cover opacity-60"
              />
              <button
                onClick={removeImage}
                className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-600 bg-white/80 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
              >
                Remove Image
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                id="procurement-leader-image-upload"
                className="hidden"
                onChange={handleImageUpload}
              />
              <label
                htmlFor="procurement-leader-image-upload"
                className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-blue-500 hover:text-blue-700 transition-colors"
              >
                <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                <span className="text-[11px] font-medium">
                  Click to upload LinkedIn screenshot
                </span>
              </label>
            </>
          )}
        </div>
      </div>

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
        {profile ? "Re-Run Leader Profile" : "Run Leader Profile"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {profile && (
        <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5 space-y-4">
          <div>
            <h5 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">
              Team
            </h5>
            <p className="text-sm text-slate-800">{profile.team}</p>
          </div>
          <div>
            <h5 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">
              Scope
            </h5>
            <p className="text-sm text-slate-800">{profile.scope}</p>
          </div>
          <div>
            <h5 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">
              Reporting Chain
            </h5>
            <p className="text-sm text-slate-800">{profile.reportingChain}</p>
          </div>
          {profile.recentActivity.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2">
                Recent Activity
              </h5>
              <ul className="space-y-1.5">
                {profile.recentActivity.map((a, i) => (
                  <li key={i} className="text-sm text-slate-800">
                    • {a.headline}
                    {a.source && /^https?:\/\//i.test(a.source) && (
                      <>
                        {" — "}
                        <a
                          href={a.source}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        >
                          source
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue to Priorities <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
