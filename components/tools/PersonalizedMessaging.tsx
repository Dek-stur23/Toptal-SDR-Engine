"use client";

import { useState } from "react";
import {
  History,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { MessagingLog } from "@/lib/types";
import { generateWithClaude, getStatusContext } from "@/lib/api";
import { DEFAULT_MESSAGING_GEM } from "@/lib/gems";

interface MessagingResult {
  linkedinMessage: string;
  emailMessage: string;
  hookUsed: string;
}

export function PersonalizedMessaging({
  accountData,
  setAccountData,
}: ToolProps) {
  const liText = accountData.messagingLiText || "";
  const setLiText = (val: string) =>
    setAccountData((prev) => ({ ...prev, messagingLiText: val }));

  const liImage = accountData.messagingLiImage;
  const setLiImage = (val: string | null) =>
    setAccountData((prev) => ({ ...prev, messagingLiImage: val }));

  const composerContext = accountData.messagingContext || "";
  const setComposerContext = (val: string) =>
    setAccountData((prev) => ({ ...prev, messagingContext: val }));

  const contactName = accountData.messagingContactName || "";
  const setContactName = (val: string) =>
    setAccountData((prev) => ({ ...prev, messagingContactName: val }));

  const focus = accountData.messagingFocus || [];
  const removeFocus = (i: number) =>
    setAccountData((prev) => ({
      ...prev,
      messagingFocus: (prev.messagingFocus || []).filter((_, j) => j !== i),
    }));
  const clearFocus = () =>
    setAccountData((prev) => ({ ...prev, messagingFocus: [] }));

  const logs = accountData.messagingLogs || [];
  const generatedNotes = accountData.generatedMessaging || "";

  const [isComposing, setIsComposing] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setLiImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCompose = async () => {
    if (!liText.trim() && !liImage) return;
    setIsComposing(true);
    setAccountData((prev) => ({ ...prev, generatedMessaging: "" }));

    const focusBlock =
      focus.length > 0
        ? `\nFOCUS POINTS (anchor the message on these — they are the user's selected priorities):\n${focus.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}\n`
        : "";

    const prompt = `
      Account Context:
      Company Name: ${accountData.companyName}
      ${getStatusContext(accountData.accountStatus)}

      Initiatives: ${accountData.initiativeResearch?.initiatives?.map((i) => i.name).join(", ") || "Unknown"}

      Contact LinkedIn Information:
      ${liText ? liText : "See attached image for LinkedIn profile."}
${focusBlock}
      ${composerContext ? `Additional Context/Notes from User:\n${composerContext}\n` : ""}

      Generate personalized outreach for this contact based on their LinkedIn profile and the account context.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        linkedinMessage: { type: "STRING" },
        emailMessage: { type: "STRING" },
        hookUsed: { type: "STRING" },
      },
      required: ["linkedinMessage", "emailMessage", "hookUsed"],
    };

    try {
      const result = await generateWithClaude<MessagingResult>({
        prompt,
        system: DEFAULT_MESSAGING_GEM,
        schema,
        image: liImage,
      });
      const formatted = `[Personalized Hook Used: ${result.hookUsed}]\n\n--- LinkedIn Message ---\n${result.linkedinMessage}\n\n--- Email Message ---\n${result.emailMessage}`;
      setAccountData((prev) => ({ ...prev, generatedMessaging: formatted }));
    } catch (err) {
      console.error(err);
      alert("Failed to compose message.");
    } finally {
      setIsComposing(false);
    }
  };

  const handleLog = () => {
    const newLog: MessagingLog = {
      id: Date.now(),
      contactName: contactName.trim() || "Unknown Contact",
      date: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      linkedin: false,
      email: false,
      preview: generatedNotes.trim()
        ? generatedNotes.substring(0, 100).replace(/\n/g, " ") + "..."
        : "Manual outreach logged.",
    };
    setAccountData((prev) => ({
      ...prev,
      messagingLogs: [newLog, ...(prev.messagingLogs || [])],
    }));
  };

  const toggleChannel = (id: number, channel: "linkedin" | "email") => {
    setAccountData((prev) => ({
      ...prev,
      messagingLogs: prev.messagingLogs.map((l) =>
        l.id === id ? { ...l, [channel]: !l[channel] } : l,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Generate highly personalized outreach based on the account&apos;s
          specific initiatives and the prospect&apos;s LinkedIn profile.
        </p>
      </div>

      <div className="w-full p-5 bg-purple-50/30 border border-purple-100 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Paste LinkedIn Details
            </label>
            <textarea
              className="w-full h-24 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none resize-none custom-scrollbar shadow-sm"
              placeholder="Paste their About section, experience, or recent posts..."
              value={liText}
              onChange={(e) => setLiText(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Or Upload Screenshot
            </label>
            <div className="border-2 border-dashed border-purple-200 rounded-lg h-24 flex flex-col items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-purple-50/50 transition-colors">
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
                    id="li-image-upload"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <label
                    htmlFor="li-image-upload"
                    className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-purple-500 hover:text-purple-700 transition-colors"
                  >
                    <ImageIcon className="w-6 h-6 mb-1.5 opacity-80" />
                    <span className="text-xs font-medium">
                      Click to upload screenshot
                    </span>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        {focus.length > 0 && (
          <div className="mb-5 p-3 bg-purple-50/60 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Focus Points{" "}
                <span className="text-[10px] font-normal normal-case text-purple-600">
                  ({focus.length})
                </span>
              </label>
              <button
                onClick={clearFocus}
                className="text-[10px] font-semibold text-slate-500 hover:text-red-600 uppercase tracking-wider"
              >
                Clear all
              </button>
            </div>
            <p className="text-[11px] text-purple-700/80 mb-2">
              These came from your ICP Intel selections. The AI will anchor the
              message on them.
            </p>
            <ul className="space-y-1">
              {focus.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 bg-white border border-purple-100 rounded px-2 py-1.5 text-xs text-slate-800"
                >
                  <span className="flex-1 min-w-0">{f}</span>
                  <button
                    onClick={() => removeFocus(i)}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    aria-label={`Remove focus point ${i + 1}`}
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Additional Context / Custom Notes (Optional)
          </label>
          <textarea
            className="w-full h-16 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none resize-none custom-scrollbar shadow-sm"
            placeholder="Add any specific angles, recent news, or instructions..."
            value={composerContext}
            onChange={(e) => setComposerContext(e.target.value)}
          />
        </div>

        <button
          onClick={handleCompose}
          disabled={isComposing || (!liText.trim() && !liImage)}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
        >
          {isComposing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isComposing ? "Drafting..." : "Compose Personalized Outreach"}
        </button>

        <div className="border-t border-purple-100 pt-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Generated Messaging
          </label>
          <textarea
            className="w-full h-56 p-4 text-sm text-gray-800 border border-purple-200 rounded-md focus:ring-2 focus:ring-purple-500 outline-none resize-none custom-scrollbar shadow-inner bg-[#FFFDF7]"
            placeholder="Your generated messaging will appear here..."
            value={generatedNotes}
            onChange={(e) =>
              setAccountData((prev) => ({
                ...prev,
                generatedMessaging: e.target.value,
              }))
            }
          />

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="flex-1">
              <label className="block text-xs font-medium text-purple-800 mb-1">
                Contact Name for Log
              </label>
              <input
                type="text"
                placeholder="e.g., Jane Doe"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full sm:max-w-xs rounded-md border border-purple-200 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
              />
            </div>
            <button
              onClick={handleLog}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center gap-2 whitespace-nowrap mt-2 sm:mt-0"
            >
              <Plus className="w-4 h-4" /> Log Message
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-purple-100">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-purple-500" /> Messaging Log
          </h4>
          {logs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm italic border border-dashed border-purple-200 rounded-lg bg-purple-50/30">
              No messages logged for this account yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-gray-900 truncate">
                        {log.contactName}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {log.date}
                      </span>
                    </div>
                    <p
                      className="text-xs text-gray-500 truncate"
                      title={log.preview}
                    >
                      {log.preview}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={log.linkedin}
                        onChange={() => toggleChannel(log.id, "linkedin")}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        LinkedIn
                      </span>
                    </label>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={log.email}
                        onChange={() => toggleChannel(log.id, "email")}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Email
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
