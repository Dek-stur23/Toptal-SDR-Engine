"use client";

import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Circle,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Search,
  Target,
  TrendingUp,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { IcpIntelData } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_ICP_INTEL_GEM } from "@/lib/gems";

interface ExtractedFields {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
}

export function IcpIntel({
  accountData,
  setAccountData,
  setActiveActionTool,
}: ToolProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(accountData.companyName || "");
  const [liText, setLiText] = useState("");
  const [liImage, setLiImage] = useState<string | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const latestResult = accountData.icpIntelResult;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setLiImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!liText.trim() && !liImage) return;
    setIsExtracting(true);

    const prompt = `Extract the contact details from the following LinkedIn profile data.\nText Data: ${liText || "None. See attached image."}`;
    const sysPrompt = `You are a data extraction assistant. Extract the first name, last name, current job title, and current company from the provided LinkedIn profile. Return empty strings if a value is not found.`;
    const schema = {
      type: "OBJECT",
      properties: {
        firstName: { type: "STRING" },
        lastName: { type: "STRING" },
        title: { type: "STRING" },
        company: { type: "STRING" },
      },
      required: ["firstName", "lastName", "title", "company"],
    };

    try {
      const result = await generateWithClaude<ExtractedFields>({
        prompt,
        system: sysPrompt,
        schema,
        image: liImage,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.company) setCompany(result.company);
    } catch (err) {
      console.error(err);
      alert("Failed to extract details from LinkedIn context.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRunIntel = async () => {
    if (!firstName.trim() || !lastName.trim() || !title.trim() || !company.trim()) {
      alert("Please provide First Name, Last Name, Title, and Company.");
      return;
    }
    setIsResearching(true);
    setAccountData((prev) => ({ ...prev, icpIntelResult: null }));

    const prompt = `
      Target Contact: ${firstName} ${lastName}
      Title: ${title}
      Company: ${company}

      Additional LinkedIn/Context Info:
      ${liText ? liText : liImage ? "See attached image for LinkedIn profile." : "None provided."}

      Analyze this contact to determine what products, projects, or initiatives they are likely involved in at ${company}.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        executiveSummary: {
          type: "OBJECT",
          properties: {
            primaryFocus: { type: "STRING" },
            likelyKPIs: { type: "STRING" },
          },
          required: ["primaryFocus", "likelyKPIs"],
        },
        evidenceBackedInvolvement: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              confirmedProject: { type: "STRING" },
              verifiedSource: { type: "STRING" },
            },
            required: ["confirmedProject", "verifiedSource"],
          },
        },
        logicalInferences: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              inferredPriority: { type: "STRING" },
              reasoning: { type: "STRING" },
            },
            required: ["inferredPriority", "reasoning"],
          },
        },
        strategicPriorities: { type: "ARRAY", items: { type: "STRING" } },
        recommendedTalkingPoints: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: [
        "executiveSummary",
        "evidenceBackedInvolvement",
        "logicalInferences",
        "strategicPriorities",
        "recommendedTalkingPoints",
      ],
    };

    try {
      const result = await generateWithClaude<IcpIntelData>({
        prompt,
        system: DEFAULT_ICP_INTEL_GEM,
        schema,
        image: liImage,
      });

      const confirmedStr =
        result.evidenceBackedInvolvement
          ?.map((p) => p.confirmedProject)
          .join(", ") || "None";
      const inferredStr =
        result.logicalInferences?.map((p) => p.inferredPriority).join(", ") ||
        "None";
      const draftContext = `ICP Research for ${firstName.trim()} ${lastName.trim()} (${title.trim()}):\n- Focus: ${result.executiveSummary.primaryFocus}\n- Confirmed Projects: ${confirmedStr}\n- Inferred Projects: ${inferredStr}\n- Talking Points: ${result.recommendedTalkingPoints.join(" | ")}`;

      setAccountData((prev) => ({
        ...prev,
        icpIntelResult: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          title: title.trim(),
          company: company.trim(),
          liText,
          result,
          date: new Date().toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
        },
        messagingLiText: liText,
        messagingLiImage: liImage,
        messagingContext: draftContext,
        messagingContactName: `${firstName.trim()} ${lastName.trim()}`,
      }));

      setFirstName("");
      setLastName("");
      setTitle("");
      setLiText("");
      setLiImage(null);
    } catch (err) {
      console.error(err);
      alert("Failed to run ICP Intel.");
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Research a specific contact to map out their likely projects,
          responsibilities, and how to pitch them.
        </p>
      </div>

      <div className="w-full p-5 bg-blue-50/30 border border-blue-100 rounded-xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-5">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-blue-100 pb-2">
              <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" /> Contact Details
              </h5>
              {(liText.trim() || liImage) && (
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isExtracting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {isExtracting ? "Extracting..." : "Autofill"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Title *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Company *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-100 pb-2">
              <Layers className="w-4 h-4" /> LinkedIn Context (Optional)
            </h5>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Paste LinkedIn Details
              </label>
              <textarea
                className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
                placeholder="Paste their About section, experience, or recent posts..."
                value={liText}
                onChange={(e) => setLiText(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Or Upload Screenshot
              </label>
              <div className="border-2 border-dashed border-blue-200 rounded-lg h-20 flex flex-col items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-blue-50/50 transition-colors">
                {liImage ? (
                  <div className="w-full h-full relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={liImage}
                      alt="LinkedIn Profile"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <button
                      onClick={() => setLiImage(null)}
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
                      id="intel-image-upload"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <label
                      htmlFor="intel-image-upload"
                      className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                      <span className="text-[11px] font-medium">
                        Click to upload screenshot
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleRunIntel}
          disabled={
            isResearching ||
            !firstName.trim() ||
            !lastName.trim() ||
            !title.trim() ||
            !company.trim()
          }
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isResearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isResearching ? "Researching Contact..." : "Run ICP Intel"}
        </button>
      </div>

      {latestResult && (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" /> Latest Research Result
          </h4>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-slate-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-slate-800">
                  {latestResult.firstName} {latestResult.lastName}
                </span>
                <span className="text-sm text-slate-500 ml-2 border-l border-slate-300 pl-2">
                  {latestResult.title} @ {latestResult.company}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {latestResult.date}
              </span>
            </div>

            <div className="p-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Primary Focus
                  </span>
                  <p className="text-sm text-slate-800">
                    {latestResult.result.executiveSummary.primaryFocus}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Likely KPIs
                  </span>
                  <p className="text-sm text-slate-800">
                    {latestResult.result.executiveSummary.likelyKPIs}
                  </p>
                </div>
              </div>

              {latestResult.result.evidenceBackedInvolvement.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-500" /> Evidence-Backed
                    Involvement
                  </h5>
                  <div className="space-y-2">
                    {latestResult.result.evidenceBackedInvolvement.map(
                      (proj, i) => (
                        <div
                          key={i}
                          className="bg-emerald-50/30 p-3 rounded-lg border border-emerald-100"
                        >
                          <span className="font-semibold text-sm text-slate-800">
                            {proj.confirmedProject}
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed mt-1">
                            <strong className="text-slate-500">
                              Verified Source:
                            </strong>{" "}
                            {proj.verifiedSource.startsWith("http") ? (
                              <a
                                href={proj.verifiedSource}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:underline"
                              >
                                {proj.verifiedSource}
                              </a>
                            ) : (
                              proj.verifiedSource
                            )}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {latestResult.result.logicalInferences.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> Logical Inferences
                  </h5>
                  <div className="space-y-2">
                    {latestResult.result.logicalInferences.map((inf, i) => (
                      <div
                        key={i}
                        className="bg-amber-50/30 p-3 rounded-lg border border-amber-100"
                      >
                        <span className="font-semibold text-sm text-slate-800">
                          {inf.inferredPriority}
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed mt-1">
                          <strong className="text-slate-500">Reasoning:</strong>{" "}
                          {inf.reasoning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> Strategic
                    Priorities
                  </h5>
                  <ul className="space-y-1.5 bg-indigo-50/30 p-3 rounded-lg border border-indigo-100">
                    {latestResult.result.strategicPriorities.map((p, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-700 flex items-start gap-1.5"
                      >
                        <Circle className="w-1.5 h-1.5 text-indigo-400 shrink-0 mt-1.5" />
                        <span className="leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Recommended
                    Talking Points
                  </h5>
                  <ul className="space-y-1.5 bg-amber-50/30 p-3 rounded-lg border border-amber-100">
                    {latestResult.result.recommendedTalkingPoints.map(
                      (point, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-700 flex items-start gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>

              {setActiveActionTool && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      const confirmedStr =
                        latestResult.result.evidenceBackedInvolvement
                          ?.map((p) => p.confirmedProject)
                          .join(", ") || "None";
                      const inferredStr =
                        latestResult.result.logicalInferences
                          ?.map((p) => p.inferredPriority)
                          .join(", ") || "None";
                      const restoredContext = `ICP Research for ${latestResult.firstName} ${latestResult.lastName} (${latestResult.title}):\n- Focus: ${latestResult.result.executiveSummary.primaryFocus}\n- Confirmed Projects: ${confirmedStr}\n- Inferred Projects: ${inferredStr}\n- Talking Points: ${latestResult.result.recommendedTalkingPoints.join(" | ")}`;
                      setAccountData((prev) => ({
                        ...prev,
                        messagingLiText: latestResult.liText || "",
                        messagingContext: restoredContext,
                        messagingContactName: `${latestResult.firstName} ${latestResult.lastName}`,
                      }));
                      setActiveActionTool("messaging");
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg w-fit shadow-sm"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Start Messaging Draft
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
