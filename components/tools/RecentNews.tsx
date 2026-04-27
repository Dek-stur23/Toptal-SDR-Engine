"use client";

import { useState } from "react";
import {
  BookOpen,
  Building2,
  FileText,
  Loader2,
  Newspaper,
  Search,
  Settings,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { RecentNewsData } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_RECENT_NEWS_GEM } from "@/lib/gems";

export function RecentNews({ accountData, setAccountData }: ToolProps) {
  const [company, setCompany] = useState(accountData.companyName || "");
  const [reportText, setReportText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGemConfig, setShowGemConfig] = useState(false);
  const [gemInstructions, setGemInstructions] = useState(
    accountData.recentNewsInstructions || DEFAULT_RECENT_NEWS_GEM,
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") setReportText(text);
    };
    reader.readAsText(file);
  };

  const handleRun = async () => {
    if (!company.trim()) {
      alert("Please enter a company name.");
      return;
    }
    setIsAnalyzing(true);
    setAccountData((prev) => ({ ...prev, recentNewsResult: null }));

    const prompt = `
      Target Company: ${company}
      ${reportText ? `Uploaded Document/Report Content:\n${reportText.substring(0, 30000)}` : "No document provided. Use the most recent public information you have."}

      Analyze the recent news/report and provide the intelligence brief following your instructions.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        executiveSummary: { type: "STRING" },
        keyEvents: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              headline: { type: "STRING" },
              details: { type: "STRING" },
              source: { type: "STRING" },
            },
            required: ["headline", "details", "source"],
          },
        },
        toptalOpportunity: { type: "STRING" },
      },
      required: ["executiveSummary", "keyEvents", "toptalOpportunity"],
    };

    try {
      const result = await generateWithClaude<RecentNewsData>({
        prompt,
        system: gemInstructions,
        schema,
      });
      setAccountData((prev) => ({
        ...prev,
        recentNewsInstructions: gemInstructions,
        recentNewsResult: {
          company: company.trim(),
          date: new Date().toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
          data: result,
        },
      }));
      setReportText("");
    } catch (err) {
      console.error(err);
      alert("Failed to analyze recent news. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const result = accountData.recentNewsResult;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Search public sources for the latest news, or upload a recent quarterly
          report to identify immediate talent triggers.
        </p>
        <button
          onClick={() => setShowGemConfig(!showGemConfig)}
          className="text-xs text-gray-500 hover:text-sky-600 flex items-center gap-1 transition-colors"
        >
          <Settings className="w-3 h-3" />
          {showGemConfig ? "Hide Gem Config" : "Configure Gem"}
        </button>
      </div>

      {showGemConfig && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in slide-in-from-top-2">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            News Analyst Gem Instructions
          </label>
          <textarea
            className="w-full h-40 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 outline-none resize-none custom-scrollbar"
            value={gemInstructions}
            onChange={(e) => setGemInstructions(e.target.value)}
          />
        </div>
      )}

      <div className="w-full p-5 bg-sky-50/30 border border-sky-100 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          <div className="space-y-4">
            <h5 className="text-xs font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-sky-100 pb-2">
              <Building2 className="w-4 h-4" /> Target Information
            </h5>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Company Name *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none text-sm text-gray-800 shadow-sm"
                placeholder="e.g., Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-sky-100 pb-2">
              <FileText className="w-4 h-4" /> Report Upload (Optional)
            </h5>
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-slate-700">
                Paste text or upload a document (10-Q, earnings, etc.)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".txt,.csv,.json"
                  id="news-doc-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label
                  htmlFor="news-doc-upload"
                  className="cursor-pointer bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap shadow-sm"
                >
                  <Upload className="w-4 h-4" /> Upload Doc
                </label>
              </div>
              <textarea
                className="w-full h-16 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 outline-none resize-none custom-scrollbar shadow-sm mt-1"
                placeholder="Or paste report text here..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={isAnalyzing || !company.trim()}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isAnalyzing ? "Analyzing..." : "Analyze Recent News"}
        </button>
      </div>

      {result && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-sky-500" /> Recent News Analysis
          </h4>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-sky-50 border-b border-sky-100 px-4 py-3 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-800">
                {result.company}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {result.date}
              </span>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-sky-500" /> Executive Summary
                </h5>
                <p className="text-sm text-gray-800 bg-sky-50/50 p-3 rounded-lg border border-sky-50 leading-relaxed">
                  {result.data.executiveSummary}
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-500" /> Key Events &amp;
                  Triggers
                </h5>
                <div className="space-y-3">
                  {result.data.keyEvents.map((event, i) => (
                    <div key={i} className="border-l-2 border-sky-400 pl-3 py-1">
                      <h6 className="font-semibold text-sm text-gray-900 mb-1">
                        {event.headline}
                      </h6>
                      <p className="text-sm text-gray-700 mb-1.5">
                        {event.details}
                      </p>
                      <span className="text-xs font-medium text-slate-400">
                        Source:{" "}
                        {event.source.startsWith("http") ? (
                          <a
                            href={event.source}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-500 hover:underline"
                          >
                            {event.source}
                          </a>
                        ) : (
                          event.source
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Toptal Opportunity
                </h5>
                <p className="text-sm text-emerald-900 font-medium leading-relaxed">
                  {result.data.toptalOpportunity}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
