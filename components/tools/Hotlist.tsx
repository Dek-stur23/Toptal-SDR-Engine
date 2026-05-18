"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  FileSpreadsheet,
  Flame,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { ChatMessage as ChatTurn } from "@/lib/api";
import type {
  AccountData,
  HotlistChannel,
  HotlistMessage,
  HotlistPriority,
  HotlistProspect,
} from "@/lib/types";
import { generateWithClaude, streamChatTurn } from "@/lib/api";
import {
  DEFAULT_HOTLIST_AUTOFILL_GEM,
  DEFAULT_HOTLIST_BULK_AUTOFILL_GEM,
  DEFAULT_HOTLIST_NEXT_STEP_GEM,
} from "@/lib/gems";
import {
  createMessage,
  createProspect,
  patchMessageById,
  patchProspectById,
  prependProspects,
  removeMessageById,
  removeProspectById,
} from "@/lib/hotlist";

interface ExtractedFields {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
}

interface BulkExtractResult {
  contacts: ExtractedFields[];
}

interface BulkPreviewRow extends ExtractedFields {
  id: string;
  selected: boolean;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let curr = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(curr);
        curr = "";
      } else {
        curr += ch;
      }
    }
    out.push(curr);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    return row;
  });
}

function mapCsvRowsToPreview(
  rows: Record<string, string>[],
): BulkPreviewRow[] {
  const firstNameKeys = ["first name", "firstname", "first", "given name"];
  const lastNameKeys = [
    "last name",
    "lastname",
    "last",
    "family name",
    "surname",
  ];
  const fullNameKeys = ["name", "full name", "contact name", "contact"];
  const titleKeys = ["title", "job title", "position", "role"];
  const companyKeys = [
    "company",
    "company name",
    "organization",
    "employer",
    "account",
  ];
  const linkedinKeys = [
    "linkedin",
    "linkedin url",
    "linkedin profile",
    "profile url",
    "li url",
  ];

  const pick = (row: Record<string, string>, keys: string[]): string => {
    for (const k of keys) {
      const v = row[k];
      if (v) return v;
    }
    return "";
  };

  const out: BulkPreviewRow[] = [];
  rows.forEach((row, i) => {
    let firstName = pick(row, firstNameKeys);
    let lastName = pick(row, lastNameKeys);
    const fullName = pick(row, fullNameKeys);
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ");
    }
    const title = pick(row, titleKeys);
    const company = pick(row, companyKeys);
    const linkedinUrl = pick(row, linkedinKeys);
    if (!firstName && !lastName && !company) return; // skip empty rows
    out.push({
      id: `csv-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      firstName,
      lastName,
      title,
      company,
      linkedinUrl,
      selected: true,
    });
  });
  return out;
}

const PRIORITY_BADGE: Record<HotlistPriority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const CHANNEL_ICON = (channel: HotlistChannel) => {
  switch (channel) {
    case "Email":
      return <Mail className="w-3.5 h-3.5 text-blue-500" />;
    case "LinkedIn":
      return <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />;
    case "Phone":
      return <Phone className="w-3.5 h-3.5 text-emerald-500" />;
    case "Meeting":
      return <Calendar className="w-3.5 h-3.5 text-amber-500" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-slate-500" />;
  }
};


export function Hotlist({ accountData, setAccountData }: ToolProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(accountData.companyName || "");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [priority, setPriority] = useState<HotlistPriority>("high");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [booleanCopied, setBooleanCopied] = useState(false);

  const [bulkPreview, setBulkPreview] = useState<BulkPreviewRow[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkAddedCount, setBulkAddedCount] = useState(0);
  const [bulkSource, setBulkSource] = useState<"screenshot" | "csv" | null>(
    null,
  );

  const hotlist = accountData.hotlist || [];
  const [chatProspectId, setChatProspectId] = useState<number | null>(null);
  const chatProspect = hotlist.find((p) => p.id === chatProspectId) ?? null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setExtractError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setExtractError("");
  };

  const autofillFromImage = async () => {
    if (!image) return;
    setExtracting(true);
    setExtractError("");
    try {
      const schema = {
        type: "OBJECT",
        properties: {
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          title: { type: "STRING" },
          company: { type: "STRING" },
          linkedinUrl: { type: "STRING" },
        },
        required: ["firstName", "lastName", "title", "company", "linkedinUrl"],
      };
      const result = await generateWithClaude<ExtractedFields>({
        prompt:
          "Extract the visible name, title, company, and LinkedIn URL from this screenshot. Return empty string for any field you cannot read with confidence. Do NOT extract emails or phone numbers.",
        system: DEFAULT_HOTLIST_AUTOFILL_GEM,
        schema,
        image,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.company) setCompany(result.company);
      if (result.linkedinUrl) setLinkedinUrl(result.linkedinUrl);
    } catch (err) {
      console.error("Hotlist autofill error:", err);
      setExtractError(
        err instanceof Error
          ? err.message
          : "Failed to extract details from the screenshot.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const addProspect = () => {
    if (!firstName.trim() && !lastName.trim() && !company.trim()) return;
    const prospect = createProspect({
      firstName,
      lastName,
      title,
      company,
      linkedinUrl,
      priority,
      notes,
      image,
    });
    setAccountData((prev) => ({
      ...prev,
      hotlist: prependProspects(prev.hotlist ?? [], [prospect]),
    }));
    setFirstName("");
    setLastName("");
    setTitle("");
    setCompany(accountData.companyName || "");
    setLinkedinUrl("");
    setPriority("high");
    setNotes("");
    setImage(null);
    setExtractError("");
  };

  const updateProspect = (id: number, patch: Partial<HotlistProspect>) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: patchProspectById(prev.hotlist ?? [], id, patch),
    }));
  };

  const removeProspect = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: removeProspectById(prev.hotlist ?? [], id),
    }));
  };

  const addMessage = (prospectId: number, msg: HotlistMessage) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist ?? []).map((p) =>
        p.id === prospectId
          ? { ...p, messages: [msg, ...(p.messages ?? [])] }
          : p,
      ),
    }));
  };

  const removeMessage = (prospectId: number, messageId: number) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist ?? []).map((p) =>
        p.id === prospectId
          ? { ...p, messages: removeMessageById(p.messages ?? [], messageId) }
          : p,
      ),
    }));
  };

  const updateMessage = (
    prospectId: number,
    messageId: number,
    patch: Partial<HotlistMessage>,
  ) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: patchMessageById(prev.hotlist ?? [], prospectId, messageId, patch),
    }));
  };

  const handleBulkScreenshot = (file: File) => {
    setBulkLoading(true);
    setBulkError("");
    setBulkAddedCount(0);
    setBulkSource("screenshot");
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result !== "string") {
        setBulkError("Could not read file.");
        setBulkLoading(false);
        return;
      }
      try {
        const schema = {
          type: "OBJECT",
          properties: {
            contacts: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  firstName: { type: "STRING" },
                  lastName: { type: "STRING" },
                  title: { type: "STRING" },
                  company: { type: "STRING" },
                  linkedinUrl: { type: "STRING" },
                },
                required: [
                  "firstName",
                  "lastName",
                  "title",
                  "company",
                  "linkedinUrl",
                ],
              },
            },
          },
          required: ["contacts"],
        };
        const result = await generateWithClaude<BulkExtractResult>({
          prompt:
            "Extract every visible contact from this screenshot. Return as many as you can read with confidence. Skip rows that have neither a readable name nor a readable company. Do not extract emails or phone numbers.",
          system: DEFAULT_HOTLIST_BULK_AUTOFILL_GEM,
          schema,
          image: reader.result,
        });
        const rows: BulkPreviewRow[] = (result.contacts || [])
          .filter(
            (c) =>
              !!(c.firstName?.trim() || c.lastName?.trim() || c.company?.trim()),
          )
          .map((c, i) => ({
            id: `img-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            firstName: c.firstName?.trim() ?? "",
            lastName: c.lastName?.trim() ?? "",
            title: c.title?.trim() ?? "",
            company: c.company?.trim() ?? "",
            linkedinUrl: c.linkedinUrl?.trim() ?? "",
            selected: true,
          }));
        if (rows.length === 0) {
          setBulkError("No contacts were extracted from the screenshot.");
        } else {
          setBulkPreview(rows);
        }
      } catch (err) {
        console.error("Bulk screenshot error:", err);
        setBulkError(
          err instanceof Error
            ? err.message
            : "Failed to extract contacts from the screenshot.",
        );
      } finally {
        setBulkLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBulkCsv = (file: File) => {
    setBulkLoading(true);
    setBulkError("");
    setBulkAddedCount(0);
    setBulkSource("csv");
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        setBulkError("Could not read file.");
        setBulkLoading(false);
        return;
      }
      try {
        const rows = parseCsv(reader.result);
        const preview = mapCsvRowsToPreview(rows);
        if (preview.length === 0) {
          setBulkError(
            "No contacts found. The CSV needs a header row with at least Name (or First Name + Last Name) or Company columns.",
          );
        } else {
          setBulkPreview(preview);
        }
      } catch (err) {
        console.error("Bulk CSV error:", err);
        setBulkError(
          err instanceof Error ? err.message : "Could not parse the CSV.",
        );
      } finally {
        setBulkLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleBulkRow = (id: string) => {
    setBulkPreview((prev) =>
      prev
        ? prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
        : prev,
    );
  };

  const setAllBulk = (selected: boolean) => {
    setBulkPreview((prev) => (prev ? prev.map((r) => ({ ...r, selected })) : prev));
  };

  const clearBulkPreview = () => {
    setBulkPreview(null);
    setBulkError("");
    setBulkAddedCount(0);
    setBulkSource(null);
  };

  const commitBulkPreview = () => {
    if (!bulkPreview) return;
    const selectedRows = bulkPreview.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setBulkError("Select at least one contact to add.");
      return;
    }
    const sourceTag =
      bulkSource === "csv" ? "CSV bulk add" : "screenshot bulk add";
    const dateAdded = new Date().toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
    const newProspects = selectedRows.map((r) =>
      createProspect({
        firstName: r.firstName,
        lastName: r.lastName,
        title: r.title,
        company: r.company || accountData.companyName || "",
        linkedinUrl: r.linkedinUrl,
        priority: "high",
        notes: `Added via ${sourceTag}.`,
        dateAdded,
      }),
    );
    setAccountData((prev) => ({
      ...prev,
      hotlist: prependProspects(prev.hotlist ?? [], newProspects),
    }));
    setBulkAddedCount(newProspects.length);
    setBulkPreview(null);
    setBulkSource(null);
    setTimeout(() => setBulkAddedCount(0), 3000);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Build your highest-priority prospect list and keep a per-prospect log of
        messages sent and responses received.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4 text-orange-500" /> Add Prospect
        </h4>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Screenshot{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (optional — autofills fields and is saved to the prospect)
                </span>
              </label>
              {image && (
                <button
                  onClick={autofillFromImage}
                  disabled={extracting}
                  className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {extracting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {extracting ? "Extracting..." : "Autofill from image"}
                </button>
              )}
            </div>
            <div className="border-2 border-dashed border-orange-200 rounded-lg h-24 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-orange-50/30 transition-colors">
              {image ? (
                <div className="w-full h-full relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Prospect screenshot"
                    className="w-full h-full object-cover opacity-70"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-600 bg-white/80 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    id="hotlist-image-upload"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <label
                    htmlFor="hotlist-image-upload"
                    className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-orange-500 hover:text-orange-700 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                    <span className="text-[11px] font-medium">
                      Click to upload a screenshot
                    </span>
                  </label>
                </>
              )}
            </div>
            {extractError && (
              <p className="text-red-500 text-xs mt-2">{extractError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="LinkedIn URL"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="sm:w-1/4">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as HotlistPriority)
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Why they&apos;re hot{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (optional)
                </span>
              </label>
              <textarea
                className="w-full h-16 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-none custom-scrollbar shadow-sm"
                placeholder="Initiative, trigger event, mutual connection, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={addProspect}
              disabled={
                !firstName.trim() && !lastName.trim() && !company.trim()
              }
              className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add to Hotlist
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-1 flex items-center gap-2 text-sm">
          <Upload className="w-4 h-4 text-orange-500" /> Bulk Add
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Upload a screenshot of a contact list (LinkedIn search, CRM table,
          etc.) or a CSV. Review the extracted rows before committing.
        </p>

        {!bulkPreview && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              id="hotlist-bulk-screenshot"
              className="hidden"
              disabled={bulkLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBulkScreenshot(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="hotlist-bulk-screenshot"
              className={`cursor-pointer bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${bulkLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <ImageIcon className="w-4 h-4" /> Upload Screenshot
            </label>

            <input
              type="file"
              accept=".csv,text/csv"
              id="hotlist-bulk-csv"
              className="hidden"
              disabled={bulkLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBulkCsv(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="hotlist-bulk-csv"
              className={`cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${bulkLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Upload CSV
            </label>

            {bulkLoading && (
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {bulkSource === "screenshot"
                  ? "Extracting contacts from screenshot…"
                  : "Parsing CSV…"}
              </span>
            )}
            {bulkAddedCount > 0 && (
              <span className="text-xs text-emerald-700 font-semibold">
                ✓ Added {bulkAddedCount} to hotlist
              </span>
            )}
          </div>
        )}

        {bulkError && (
          <p className="text-red-500 text-sm mt-3">{bulkError}</p>
        )}

        {bulkPreview && (
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Preview — {bulkPreview.filter((r) => r.selected).length} of{" "}
                {bulkPreview.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setAllBulk(true)}
                  className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 uppercase tracking-wider"
                >
                  Select all
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  onClick={() => setAllBulk(false)}
                  className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 uppercase tracking-wider"
                >
                  Deselect all
                </button>
              </div>
            </div>
            <ul className="max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {bulkPreview.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-start gap-2 border rounded-md px-3 py-2 ${r.selected ? "border-orange-200 bg-orange-50/40" : "border-slate-200 bg-white opacity-70"}`}
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => toggleBulkRow(r.id)}
                    className="mt-0.5 w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-900">
                      {r.firstName} {r.lastName}
                    </span>
                    <p className="text-xs text-slate-500">
                      {r.title}
                      {r.title && r.company ? " @ " : ""}
                      {r.company}
                    </p>
                    {r.linkedinUrl && (
                      <p className="text-[11px] text-blue-600 break-all">
                        {r.linkedinUrl}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={clearBulkPreview}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={commitBulkPreview}
                disabled={bulkPreview.filter((r) => r.selected).length === 0}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add{" "}
                {bulkPreview.filter((r) => r.selected).length} to Hotlist
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" /> Hotlist
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {hotlist.length}
          </span>
        </h4>

        {hotlist.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No prospects on the hotlist yet. Add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {hotlist.map((p) => (
              <ProspectCard
                key={p.id}
                prospect={p}
                onUpdate={(patch) => updateProspect(p.id, patch)}
                onRemove={() => removeProspect(p.id)}
                onAddMessage={(m) => addMessage(p.id, m)}
                onRemoveMessage={(mid) => removeMessage(p.id, mid)}
                onUpdateMessage={(mid, patch) =>
                  updateMessage(p.id, mid, patch)
                }
                onOpenChat={() => setChatProspectId(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {(() => {
        const fullNames = hotlist
          .map((p) => `${p.firstName} ${p.lastName}`.trim())
          .filter(Boolean);
        if (fullNames.length === 0) return null;
        const booleanString = fullNames.map((n) => `"${n}"`).join(" OR ");
        const copy = () => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(booleanString);
            setBooleanCopied(true);
            setTimeout(() => setBooleanCopied(false), 2000);
          }
        };
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <Flame className="w-4 h-4 text-orange-500" /> Boolean Name
                String
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-1">
                  {fullNames.length}
                </span>
              </h4>
              <button
                onClick={copy}
                className="text-xs font-semibold text-orange-700 hover:text-orange-900 flex items-center gap-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-md transition-colors"
              >
                <Copy className="w-3 h-3" /> {booleanCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Paste into LinkedIn Sales Navigator or any search tool that
              supports boolean operators to surface every hotlist prospect at
              once.
            </p>
            <pre className="text-xs text-emerald-400 bg-[#0f172a] border border-slate-700 p-3 rounded-md whitespace-pre-wrap break-all font-mono leading-relaxed">
              {booleanString}
            </pre>
          </div>
        );
      })()}

      {chatProspect && (
        <NextStepChatModal
          prospect={chatProspect}
          accountData={accountData}
          onClose={() => setChatProspectId(null)}
          onSaveAsDraft={(body) =>
            addMessage(
              chatProspect.id,
              createMessage({
                channel: "Other",
                subject: "AI-recommended draft",
                body,
              }),
            )
          }
        />
      )}
    </div>
  );
}

function ProspectCard({
  prospect,
  onUpdate,
  onRemove,
  onAddMessage,
  onRemoveMessage,
  onUpdateMessage,
  onOpenChat,
}: {
  prospect: HotlistProspect;
  onUpdate: (patch: Partial<HotlistProspect>) => void;
  onRemove: () => void;
  onAddMessage: (m: HotlistMessage) => void;
  onRemoveMessage: (id: number) => void;
  onUpdateMessage: (id: number, patch: Partial<HotlistMessage>) => void;
  onOpenChat: () => void;
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [draftChannel, setDraftChannel] = useState<HotlistChannel>("Email");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftResponse, setDraftResponse] = useState("");
  const [expandedMsg, setExpandedMsg] = useState<Record<number, boolean>>({});
  const [viewingImage, setViewingImage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HotlistProspect>(prospect);

  // Keep draft in sync with the prospect when not actively editing.
  // (Prevents stale draft if the prospect changes underneath, e.g. via
  // a message log change reflowing the parent state.)
  useEffect(() => {
    if (!editing) setDraft(prospect);
  }, [prospect, editing]);

  const startEdit = () => {
    setDraft(prospect);
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(prospect);
    setEditing(false);
  };
  const saveEdit = () => {
    const nextLinkedinUrl = draft.linkedinUrl.trim();
    const nextImage = draft.image;
    // Guard: don't silently overwrite a populated linkedinUrl/screenshot with
    // empty unless the user explicitly confirms. These are expensive to
    // recover (LinkedIn screenshots in particular), so a misclick on the
    // image "Remove" button or an accidental select-all-delete in the URL
    // field should not silently destroy data.
    const clearingLinkedin =
      !!prospect.linkedinUrl.trim() && nextLinkedinUrl === "";
    const clearingImage = !!prospect.image && nextImage === null;
    if (clearingLinkedin || clearingImage) {
      const losing: string[] = [];
      if (clearingLinkedin) losing.push("LinkedIn URL");
      if (clearingImage) losing.push("LinkedIn screenshot");
      const msg = `You're about to clear the ${losing.join(" and ")} on this prospect. This cannot be undone except via the Restore Snapshot menu. Continue?`;
      if (!window.confirm(msg)) return;
    }
    onUpdate({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      title: draft.title.trim(),
      company: draft.company.trim(),
      linkedinUrl: nextLinkedinUrl,
      priority: draft.priority,
      image: nextImage,
    });
    setEditing(false);
  };

  const handleEditImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setDraft((prev) => ({ ...prev, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const messages = prospect.messages || [];

  const submitMessage = () => {
    if (!draftBody.trim()) return;
    const msg = createMessage({
      channel: draftChannel,
      subject: draftSubject,
      body: draftBody.trim(),
      response: draftResponse,
    });
    onAddMessage(msg);
    setDraftChannel("Email");
    setDraftSubject("");
    setDraftBody("");
    setDraftResponse("");
  };

  const copyBody = (body: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(body);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        {prospect.image && (
          <button
            onClick={() => setViewingImage(true)}
            className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="View saved screenshot"
            aria-label="View saved screenshot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prospect.image}
              alt={`Screenshot for ${prospect.firstName} ${prospect.lastName}`}
              className="w-full h-full object-cover"
            />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-sm text-slate-900">
              {prospect.firstName} {prospect.lastName}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[prospect.priority]}`}
            >
              {prospect.priority}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {prospect.title}
            {prospect.title && prospect.company ? " @ " : ""}
            {prospect.company}
          </p>
        </div>
        <div className="shrink-0 flex items-start gap-1.5">
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2 py-1 rounded-md transition-colors"
            title="Edit prospect"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => {
              const fullName =
                `${prospect.firstName} ${prospect.lastName}`.trim() ||
                "this prospect";
              if (
                window.confirm(`Remove ${fullName} from the hotlist?`)
              ) {
                onRemove();
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2 py-1 rounded-md transition-colors"
            title="Remove prospect from the hotlist"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      </div>

      {prospect.linkedinUrl && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
          <a
            href={
              prospect.linkedinUrl.startsWith("http")
                ? prospect.linkedinUrl
                : `https://${prospect.linkedinUrl}`
            }
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <MessageCircle className="w-3 h-3" /> LinkedIn
          </a>
        </div>
      )}

      {editing && (
        <div className="border-t border-slate-100 pt-3 space-y-3 bg-slate-50/50 -mx-4 px-4 py-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.firstName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, firstName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.lastName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, lastName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Title
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.title}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, title: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Company
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.company}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, company: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                LinkedIn URL
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.linkedinUrl}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, linkedinUrl: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                value={draft.priority}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    priority: e.target.value as HotlistPriority,
                  }))
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Screenshot
              </label>
              <div className="flex items-center gap-2">
                {draft.image && (
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.image}
                      alt="Current screenshot"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  id={`hotlist-edit-image-${prospect.id}`}
                  className="hidden"
                  onChange={handleEditImage}
                />
                <label
                  htmlFor={`hotlist-edit-image-${prospect.id}`}
                  className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {draft.image ? "Replace" : "Upload"}
                </label>
                {draft.image && (
                  <button
                    onClick={() =>
                      setDraft((p) => ({ ...p, image: null }))
                    }
                    className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2 py-1.5 rounded-md transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={cancelEdit}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onOpenChat}
        className="w-full text-xs font-semibold text-orange-700 hover:text-white bg-orange-50 hover:bg-orange-600 border border-orange-200 hover:border-orange-600 px-3 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5" /> Recommend Next Step
      </button>

      <div className="border-t border-slate-100 pt-2">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          className="w-full p-2 text-sm text-gray-800 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-y custom-scrollbar shadow-sm bg-white"
          placeholder="What makes them a top priority? Mutual connections, recent triggers, etc."
          value={prospect.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
        />
      </div>

      <div className="border-t border-slate-100 pt-2">
        <button
          onClick={() => setShowMessages(!showMessages)}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
        >
          {showMessages ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          Messages
          <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
            {messages.length}
          </span>
        </button>

        {showMessages && (
          <div className="mt-3 space-y-3">
            <div className="bg-orange-50/40 border border-orange-100 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  className="rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                  value={draftChannel}
                  onChange={(e) =>
                    setDraftChannel(e.target.value as HotlistChannel)
                  }
                >
                  <option value="Email">Email</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Phone">Phone</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  className="sm:col-span-2 rounded-md border border-gray-300 px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-white text-sm text-gray-800"
                  placeholder="Subject (optional)"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                />
              </div>
              <textarea
                className="w-full h-20 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-y custom-scrollbar shadow-sm bg-white"
                placeholder="Message body..."
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
              />
              <textarea
                className="w-full h-12 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-y custom-scrollbar shadow-sm bg-white"
                placeholder="Response received (optional)"
                value={draftResponse}
                onChange={(e) => setDraftResponse(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  onClick={submitMessage}
                  disabled={!draftBody.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3 h-3" /> Save Message
                </button>
              </div>
            </div>

            {messages.length > 0 && (
              <ul className="space-y-2">
                {messages.map((m) => {
                  const open = !!expandedMsg[m.id];
                  return (
                    <li
                      key={m.id}
                      className="border border-slate-200 rounded-md p-3 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {CHANNEL_ICON(m.channel)}
                            <span className="text-xs font-semibold text-slate-800">
                              {m.channel}
                            </span>
                            {m.subject && (
                              <span className="text-xs text-slate-600 truncate">
                                — {m.subject}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 ml-auto">
                              {m.date}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setExpandedMsg((prev) => ({
                                ...prev,
                                [m.id]: !prev[m.id],
                              }))
                            }
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                          >
                            {open ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            {open ? "Hide message" : "Show message"}
                          </button>
                          {open && (
                            <div className="mt-2 space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <pre className="flex-1 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 border border-slate-200 p-2 rounded">
                                  {m.body}
                                </pre>
                                <button
                                  onClick={() => copyBody(m.body)}
                                  className="shrink-0 text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                                  title="Copy message"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                                  Response
                                </span>
                                <textarea
                                  value={m.response}
                                  onChange={(e) =>
                                    onUpdateMessage(m.id, {
                                      response: e.target.value,
                                    })
                                  }
                                  placeholder="Add or update the response received from this contact..."
                                  className="w-full text-sm text-slate-700 bg-emerald-50/40 border border-emerald-100 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200 outline-none p-2 rounded resize-y custom-scrollbar shadow-sm"
                                  rows={2}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onRemoveMessage(m.id)}
                          className="shrink-0 text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {viewingImage && prospect.image && (
        <div
          onClick={() => setViewingImage(false)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={prospect.image}
            alt={`Screenshot for ${prospect.firstName} ${prospect.lastName}`}
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setViewingImage(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center transition-colors text-xl"
            aria-label="Close image preview"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function buildProspectContext(
  prospect: HotlistProspect,
  account: AccountData,
): string {
  const fullName = `${prospect.firstName} ${prospect.lastName}`.trim() || "Unknown";
  const lines: string[] = [];
  lines.push(`Prospect: ${fullName}`);
  if (prospect.title) lines.push(`Title: ${prospect.title}`);
  if (prospect.company) lines.push(`Company: ${prospect.company}`);
  if (prospect.linkedinUrl) lines.push(`LinkedIn: ${prospect.linkedinUrl}`);
  lines.push(`Priority on user's hotlist: ${prospect.priority}`);
  if (prospect.dateAdded)
    lines.push(`Added to hotlist on: ${prospect.dateAdded}`);
  if (prospect.notes.trim()) {
    lines.push(`\nWhy they're hot (user's notes):\n${prospect.notes.trim()}`);
  }

  const msgs = prospect.messages ?? [];
  if (msgs.length === 0) {
    lines.push(`\nMessage history: NO PRIOR CONTACT YET.`);
  } else {
    lines.push(`\nMessage history (most recent first, ${msgs.length} total):`);
    msgs.forEach((m, i) => {
      lines.push(
        `  ${i + 1}. ${m.date || "(no date)"} — ${m.channel}${m.subject ? ` — subj: "${m.subject}"` : ""}`,
      );
      if (m.body) {
        const trimmed =
          m.body.length > 400 ? m.body.slice(0, 400) + "…" : m.body;
        lines.push(`     Body: ${trimmed.replace(/\n/g, " ")}`);
      }
      if (m.response.trim()) {
        lines.push(`     Response received: ${m.response.trim()}`);
      } else {
        lines.push(`     Response received: (none logged)`);
      }
    });
  }

  const acctLines: string[] = [];
  if (account.companyName) acctLines.push(`Account: ${account.companyName}`);
  if (account.accountStatus)
    acctLines.push(`Toptal relationship status: ${account.accountStatus}`);
  if (account.aiResearch?.prioritiesAndChallenges) {
    acctLines.push(
      `Company priorities & challenges:\n${account.aiResearch.prioritiesAndChallenges}`,
    );
  }
  if (account.recentNewsResult?.data?.executiveSummary) {
    acctLines.push(
      `Recent news executive summary:\n${account.recentNewsResult.data.executiveSummary}`,
    );
  }
  const initiatives = account.initiativeResearch?.initiatives ?? [];
  if (initiatives.length > 0) {
    acctLines.push(
      `Active initiatives at the account:\n${initiatives
        .slice(0, 3)
        .map((i) => `- ${i.name}: ${i.analysis ?? ""}`)
        .join("\n")}`,
    );
  }
  if (acctLines.length > 0) {
    lines.push(`\nAccount intel:\n${acctLines.join("\n")}`);
  }

  lines.push(`\nToday's date: ${new Date().toDateString()}`);
  return lines.join("\n");
}

function NextStepChatModal({
  prospect,
  accountData,
  onClose,
  onSaveAsDraft,
}: {
  prospect: HotlistProspect;
  accountData: AccountData;
  onClose: () => void;
  onSaveAsDraft: (body: string) => void;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const initialRanRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const systemPrompt = useMemo(() => {
    const context = buildProspectContext(prospect, accountData);
    return `${DEFAULT_HOTLIST_NEXT_STEP_GEM}\n\n=== PROSPECT + ACCOUNT CONTEXT ===\n${context}`;
  }, [prospect, accountData]);

  const sendTurn = async (text: string, history: ChatTurn[]) => {
    setError("");
    setStreamingText("");
    setStreaming(true);
    const next: ChatTurn[] = [...history, { role: "user", content: text }];
    try {
      const fullText = await streamChatTurn({
        system: systemPrompt,
        messages: next,
        onDelta: (delta) => {
          setStreamingText((prev) => prev + delta);
        },
      });
      setMessages([...next, { role: "assistant", content: fullText }]);
      setStreamingText("");
    } catch (err) {
      console.error("Next-step chat error:", err);
      setError(err instanceof Error ? err.message : "Failed.");
      setMessages(next);
      setStreamingText("");
    } finally {
      setStreaming(false);
    }
  };

  // Pre-stream the initial recommendation on mount.
  useEffect(() => {
    if (initialRanRef.current) return;
    initialRanRef.current = true;
    sendTurn(
      "Walk me through your read of this prospect's situation, then give me the phased outreach plan to book a meeting. Include drafted messages I can send.",
      [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom whenever new content arrives.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (messages.length >= 20) {
      setError(
        "This conversation is getting long. Close and start fresh to keep responses fast.",
      );
      return;
    }
    setInput("");
    sendTurn(text, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveAsDraft = (index: number, body: string) => {
    onSaveAsDraft(body);
    setSavedIds((prev) => new Set(prev).add(index));
  };

  const prospectFullName =
    `${prospect.firstName} ${prospect.lastName}`.trim() || "this prospect";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-orange-100 text-orange-700 p-1.5 rounded-md shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm truncate">
                Next Step for {prospectFullName}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                MeetingCloser Pro — ephemeral chat, closes on dismissal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-md transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/50 custom-scrollbar"
        >
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              content={m.content}
              showSaveAsDraft={m.role === "assistant"}
              saved={savedIds.has(i)}
              onSaveAsDraft={() => saveAsDraft(i, m.content)}
            />
          ))}
          {streaming && (
            <ChatBubble role="assistant" content={streamingText} streaming />
          )}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 p-3 space-y-2 bg-white">
          <div className="flex gap-2">
            <textarea
              className="flex-1 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-none shadow-sm"
              rows={2}
              placeholder='Ask a follow-up (e.g. "draft the LinkedIn version", "shorter and more direct")'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="self-end bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Press Enter to send. Shift+Enter for a new line.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  streaming = false,
  showSaveAsDraft = false,
  saved = false,
  onSaveAsDraft,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  showSaveAsDraft?: boolean;
  saved?: boolean;
  onSaveAsDraft?: () => void;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-orange-600 text-white px-3 py-2 rounded-lg text-sm whitespace-pre-wrap shadow-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
        <div className="prose prose-sm prose-slate max-w-none prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-p:my-1.5 prose-li:my-0.5 prose-a:text-blue-600">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || (streaming ? "Thinking…" : "")}
          </ReactMarkdown>
        </div>
        {streaming && (
          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> streaming…
          </div>
        )}
        {showSaveAsDraft && !streaming && content.trim().length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={onSaveAsDraft}
              disabled={saved}
              className="text-[11px] font-semibold text-orange-700 hover:text-orange-900 flex items-center gap-1 disabled:text-emerald-600 disabled:cursor-default"
            >
              {saved ? (
                <>
                  <Save className="w-3 h-3" /> Saved to prospect
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" /> Save as draft
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
