"use client";

import { useState } from "react";
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Flame,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Trash2,
  Wand2,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type {
  HotlistChannel,
  HotlistMessage,
  HotlistPriority,
  HotlistProspect,
} from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_HOTLIST_AUTOFILL_GEM } from "@/lib/gems";

interface ExtractedFields {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  linkedinUrl: string;
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

function genId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function Hotlist({ accountData, setAccountData }: ToolProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(accountData.companyName || "");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState<HotlistPriority>("high");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const hotlist = accountData.hotlist || [];

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
          email: { type: "STRING" },
          phone: { type: "STRING" },
          linkedinUrl: { type: "STRING" },
        },
        required: [
          "firstName",
          "lastName",
          "title",
          "company",
          "email",
          "phone",
          "linkedinUrl",
        ],
      };
      const result = await generateWithClaude<ExtractedFields>({
        prompt:
          "Extract every contact detail you can read from this screenshot. Return empty string for any field you cannot read with confidence.",
        system: DEFAULT_HOTLIST_AUTOFILL_GEM,
        schema,
        image,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.company) setCompany(result.company);
      if (result.email) setEmail(result.email);
      if (result.phone) setPhone(result.phone);
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
    const prospect: HotlistProspect = {
      id: genId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      company: company.trim(),
      linkedinUrl: linkedinUrl.trim(),
      email: email.trim(),
      phone: phone.trim(),
      priority,
      notes: notes.trim(),
      dateAdded: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      messages: [],
    };
    setAccountData((prev) => ({
      ...prev,
      hotlist: [prospect, ...(prev.hotlist || [])],
    }));
    setFirstName("");
    setLastName("");
    setTitle("");
    setCompany(accountData.companyName || "");
    setLinkedinUrl("");
    setEmail("");
    setPhone("");
    setPriority("high");
    setNotes("");
    setImage(null);
    setExtractError("");
  };

  const updateProspect = (id: number, patch: Partial<HotlistProspect>) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist || []).map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  };

  const removeProspect = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist || []).filter((p) => p.id !== id),
    }));
  };

  const addMessage = (prospectId: number, msg: HotlistMessage) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist || []).map((p) =>
        p.id === prospectId
          ? { ...p, messages: [msg, ...(p.messages || [])] }
          : p,
      ),
    }));
  };

  const removeMessage = (prospectId: number, messageId: number) => {
    setAccountData((prev) => ({
      ...prev,
      hotlist: (prev.hotlist || []).map((p) =>
        p.id === prospectId
          ? {
              ...p,
              messages: (p.messages || []).filter((m) => m.id !== messageId),
            }
          : p,
      ),
    }));
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
                Screenshot Autofill{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (LinkedIn, email signature, CRM card — optional)
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  onUpdate,
  onRemove,
  onAddMessage,
  onRemoveMessage,
}: {
  prospect: HotlistProspect;
  onUpdate: (patch: Partial<HotlistProspect>) => void;
  onRemove: () => void;
  onAddMessage: (m: HotlistMessage) => void;
  onRemoveMessage: (id: number) => void;
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [draftChannel, setDraftChannel] = useState<HotlistChannel>("Email");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftResponse, setDraftResponse] = useState("");
  const [expandedMsg, setExpandedMsg] = useState<Record<number, boolean>>({});

  const messages = prospect.messages || [];

  const submitMessage = () => {
    if (!draftBody.trim()) return;
    const msg: HotlistMessage = {
      id: genId(),
      channel: draftChannel,
      subject: draftSubject.trim(),
      body: draftBody.trim(),
      date: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      response: draftResponse.trim(),
    };
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
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-red-600 transition-colors p-1"
          title="Remove prospect"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {(prospect.email || prospect.phone || prospect.linkedinUrl) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
          {prospect.email && (
            <a
              href={`mailto:${prospect.email}`}
              className="flex items-center gap-1 hover:text-blue-600"
            >
              <Mail className="w-3 h-3" /> {prospect.email}
            </a>
          )}
          {prospect.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {prospect.phone}
            </span>
          )}
          {prospect.linkedinUrl && (
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
          )}
        </div>
      )}

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
                              {m.response && (
                                <div>
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                                    Response
                                  </span>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-emerald-50/40 border border-emerald-100 p-2 rounded">
                                    {m.response}
                                  </p>
                                </div>
                              )}
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
    </div>
  );
}
