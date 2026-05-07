"use client";

import { useState } from "react";
import {
  Beaker,
  Box,
  ChevronRight,
  Globe,
  Layers,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import type {
  ProductCategory,
  ProductMap,
  ProductMapEntry,
  ProductStatus,
} from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_PRODUCT_MAP_GEM } from "@/lib/gems";

const CATEGORY_ORDER: ProductCategory[] = [
  "recent-launch",
  "in-development",
  "customer-facing",
  "platform",
];

const CATEGORY_META: Record<
  ProductCategory,
  { label: string; description: string; icon: typeof Globe; accent: string }
> = {
  "customer-facing": {
    label: "Customer-Facing",
    description: "End-user products the company sells or offers.",
    icon: Globe,
    accent: "border-blue-200 bg-blue-50/40",
  },
  platform: {
    label: "Platform & Developer",
    description: "APIs, SDKs, integrations, and B2B/developer products.",
    icon: Box,
    accent: "border-violet-200 bg-violet-50/40",
  },
  "recent-launch": {
    label: "Recent Launches",
    description: "Launched or announced live within the last ~12 months.",
    icon: Rocket,
    accent: "border-emerald-200 bg-emerald-50/40",
  },
  "in-development": {
    label: "In Development",
    description: "Publicly announced but not yet generally available.",
    icon: Beaker,
    accent: "border-amber-200 bg-amber-50/40",
  },
};

const STATUS_BADGE: Record<ProductStatus, string> = {
  live: "bg-emerald-100 text-emerald-800 border-emerald-200",
  announced: "bg-amber-100 text-amber-800 border-amber-200",
  "in-development": "bg-amber-100 text-amber-800 border-amber-200",
  deprecated: "bg-slate-100 text-slate-600 border-slate-200",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};

const VALID_CATEGORIES = new Set<string>([
  "customer-facing",
  "platform",
  "recent-launch",
  "in-development",
]);
const VALID_STATUSES = new Set<string>([
  "live",
  "announced",
  "in-development",
  "deprecated",
  "unknown",
]);

function normalizeEntry(e: ProductMapEntry): ProductMapEntry {
  const category = (
    VALID_CATEGORIES.has(e.category) ? e.category : "customer-facing"
  ) as ProductCategory;
  const status = (
    VALID_STATUSES.has(e.status) ? e.status : "unknown"
  ) as ProductStatus;
  return { ...e, category, status };
}

function groupByCategory(
  entries: ProductMapEntry[],
): Record<ProductCategory, ProductMapEntry[]> {
  const groups: Record<ProductCategory, ProductMapEntry[]> = {
    "customer-facing": [],
    platform: [],
    "recent-launch": [],
    "in-development": [],
  };
  for (const e of entries) groups[e.category].push(normalizeEntry(e));
  return groups;
}

export function ProductMap({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!accountData.companyName?.trim()) {
    return (
      <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-lg">
        Set a company name on the account first.
      </div>
    );
  }

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `Build a public product/project map for ${accountData.companyName}. Enumerate the company's publicly visible products, features, integrations, and announced initiatives. Each entry must cite a real, verifiable URL on the company's own domain when possible.`;
      const schema = {
        type: "OBJECT",
        properties: {
          metadata: { type: "STRING" },
          entries: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                category: { type: "STRING" },
                description: { type: "STRING" },
                status: { type: "STRING" },
                primarySource: { type: "STRING" },
                evidenceSummary: { type: "STRING" },
              },
              required: [
                "name",
                "category",
                "description",
                "status",
                "primarySource",
                "evidenceSummary",
              ],
            },
          },
        },
        required: ["metadata", "entries"],
      };
      const result = await generateWithClaude<ProductMap>({
        prompt,
        system: DEFAULT_PRODUCT_MAP_GEM,
        schema,
        webSearch: true,
      });
      setAccountData((prev) => ({ ...prev, productMap: result }));
    } catch (err) {
      console.error("ProductMap error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to research product map. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const map = accountData.productMap;
  const groups = map ? groupByCategory(map.entries) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Research <strong>{accountData.companyName}</strong>&apos;s public
        products, features, and projects, grouped by category.
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
        {map ? "Re-Run Product Map" : "Run Product Map"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {map && groups && (
        <div className="space-y-5 pt-2">
          {map.metadata && (
            <p className="text-xs text-slate-500 italic">{map.metadata}</p>
          )}

          {CATEGORY_ORDER.map((cat) => {
            const items = groups[cat];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <section
                key={cat}
                className={`border rounded-xl p-4 ${meta.accent}`}
              >
                <header className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-slate-700" />
                  <h3 className="font-semibold text-sm text-slate-900">
                    {meta.label}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {items.length}
                    </span>
                  </h3>
                </header>
                <p className="text-xs text-slate-500 mb-3">{meta.description}</p>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <ProductCard key={`${item.name}-${i}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onComplete}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              Save &amp; Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!map && !loading && (
        <div className="text-xs text-slate-500 flex items-center gap-1.5 italic">
          <Layers className="w-3.5 h-3.5" />
          Click Run Product Map to generate the catalog.
        </div>
      )}
    </div>
  );
}

function ProductCard({ item }: { item: ProductMapEntry }) {
  const sourceIsLink =
    !!item.primarySource && /^https?:\/\//i.test(item.primarySource);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h4 className="font-semibold text-sm text-slate-900">{item.name}</h4>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_BADGE[item.status]}`}
        >
          {item.status.replace("-", " ")}
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">
        {item.description}
      </p>
      {item.evidenceSummary && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Evidence:</span>{" "}
          {item.evidenceSummary}
        </p>
      )}
      {sourceIsLink && (
        <a
          href={item.primarySource}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Source
        </a>
      )}
    </div>
  );
}
