"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Sparkles } from "lucide-react";
import type { StepProps } from "@/components/types";
import type {
  ProcurementContact,
  ProcurementFunction,
  ProcurementSeniority,
} from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PROCUREMENT_CONTACT_MAP_GEM } from "@/lib/gems";

const FUNCTION_ORDER: ProcurementFunction[] = [
  "sourcing",
  "category",
  "vendor-mgmt",
  "ta-ops",
  "indirect",
  "it-procurement",
  "other",
];

const FUNCTION_LABEL: Record<ProcurementFunction, string> = {
  sourcing: "Sourcing",
  category: "Category Management",
  "vendor-mgmt": "Vendor Management",
  "ta-ops": "TA Operations",
  indirect: "Indirect Procurement",
  "it-procurement": "IT Procurement",
  other: "Other",
};

const SENIORITY_BADGE: Record<ProcurementSeniority, string> = {
  executive: "bg-violet-100 text-violet-800 border-violet-200",
  director: "bg-blue-100 text-blue-800 border-blue-200",
  manager: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ic: "bg-slate-100 text-slate-700 border-slate-200",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

const VALID_FUNCTIONS = new Set<string>(FUNCTION_ORDER);
const VALID_SENIORITIES = new Set<string>([
  "executive",
  "director",
  "manager",
  "ic",
  "unknown",
]);

function normalize(c: ProcurementContact): ProcurementContact {
  return {
    ...c,
    function: (VALID_FUNCTIONS.has(c.function)
      ? c.function
      : "other") as ProcurementFunction,
    seniority: (VALID_SENIORITIES.has(c.seniority)
      ? c.seniority
      : "unknown") as ProcurementSeniority,
  };
}

export function ContactMap({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.procurementEngine;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rawContacts = accountData.procurementContacts || "";

  if (!rawContacts.trim()) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Paste a procurement contact list in Phase 1 / Procurement Insights / Part
        2 first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `Classify the following raw procurement contact list pulled from ZoomInfo / LinkedIn / CSV:\n\n${rawContacts}`;
      const schema = {
        type: "OBJECT",
        properties: {
          contacts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                name: { type: "STRING" },
                title: { type: "STRING" },
                function: { type: "STRING" },
                seniority: { type: "STRING" },
                ownsHint: { type: "STRING" },
              },
              required: [
                "id",
                "name",
                "title",
                "function",
                "seniority",
                "ownsHint",
              ],
            },
          },
        },
        required: ["contacts"],
      };
      const result = await generateWithClaude<{
        contacts: ProcurementContact[];
      }>({
        prompt,
        system: DEFAULT_PROCUREMENT_CONTACT_MAP_GEM,
        schema,
      });
      const contactMap = (result.contacts || []).map(normalize);
      setAccountData((prev) => ({
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          contactMap,
          // Reset downstream state when re-running the map.
          selectedContactId: null,
          leaderImage: null,
          leaderProfile: null,
          priorities: [],
          craftedMessage: "",
        },
      }));
    } catch (err) {
      console.error("ContactMap error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to organize procurement contacts.",
      );
    } finally {
      setLoading(false);
    }
  };

  const select = (id: string) => {
    setAccountData((prev) => {
      const sameSelection = prev.procurementEngine.selectedContactId === id;
      return {
        ...prev,
        procurementEngine: {
          ...prev.procurementEngine,
          selectedContactId: sameSelection ? null : id,
          // Picking a new leader invalidates downstream output and resets
          // the uploaded LinkedIn screenshot so it doesn't bleed across leaders.
          leaderImage: sameSelection
            ? prev.procurementEngine.leaderImage
            : null,
          leaderProfile: sameSelection
            ? prev.procurementEngine.leaderProfile
            : null,
          priorities: sameSelection ? prev.procurementEngine.priorities : [],
          craftedMessage: sameSelection
            ? prev.procurementEngine.craftedMessage
            : "",
        },
      };
    });
  };

  const groups: Record<ProcurementFunction, ProcurementContact[]> = {
    sourcing: [],
    category: [],
    "vendor-mgmt": [],
    "ta-ops": [],
    indirect: [],
    "it-procurement": [],
    other: [],
  };
  for (const c of engine.contactMap) groups[c.function].push(c);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Organize the procurement contact list you uploaded earlier into named
        functions, then pick the leader you want to focus the rest of this
        engine on.
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
        {engine.contactMap.length > 0 ? "Re-Run Contact Map" : "Run Contact Map"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {engine.contactMap.length > 0 && (
        <div className="space-y-4 pt-2">
          {FUNCTION_ORDER.map((fn) => {
            const items = groups[fn];
            if (items.length === 0) return null;
            return (
              <section
                key={fn}
                className="border border-slate-200 bg-white rounded-xl p-4 shadow-sm"
              >
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  {FUNCTION_LABEL[fn]}
                  <span className="text-xs font-normal text-slate-400">
                    {items.length}
                  </span>
                </h4>
                <ul className="space-y-2">
                  {items.map((c) => {
                    const selected = engine.selectedContactId === c.id;
                    return (
                      <li
                        key={c.id}
                        className={`border rounded-lg p-3 transition-colors cursor-pointer ${selected ? "border-blue-400 bg-blue-50/50" : "border-slate-100 hover:border-slate-300"}`}
                        onClick={() => select(c.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900">
                                {c.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${SENIORITY_BADGE[c.seniority]}`}
                              >
                                {c.seniority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-1">
                              {c.title}
                            </p>
                            <p className="text-xs text-slate-700">
                              {c.ownsHint}
                            </p>
                          </div>
                          {selected ? (
                            <span className="shrink-0 text-blue-700 text-xs font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                            </span>
                          ) : (
                            <span className="shrink-0 text-slate-400 text-xs">
                              Click to select
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {engine.selectedContactId && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={onComplete}
                className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
              >
                Save &amp; Continue to Leader Profile{" "}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
