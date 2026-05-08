"use client";

import { useState } from "react";
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { ActivityLog } from "@/lib/types";

const iconForType = (type: string) => {
  switch (type) {
    case "Email Sent":
      return <Mail className="w-4 h-4 text-blue-500" />;
    case "LinkedIn Message":
      return <MessageCircle className="w-4 h-4 text-indigo-500" />;
    case "Phone Call":
      return <Phone className="w-4 h-4 text-emerald-500" />;
    case "Meeting / Discovery":
      return <Calendar className="w-4 h-4 text-amber-500" />;
    case "Message Sent":
      return <Send className="w-4 h-4 text-violet-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-500" />;
  }
};

export function LogEngagement({ accountData, setAccountData }: ToolProps) {
  const [activityType, setActivityType] = useState("Phone Call");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const logs = accountData.activityLogs || [];

  const handleLog = () => {
    if (!notes.trim() && !message.trim()) return;
    const newLog: ActivityLog = {
      id: Date.now(),
      type: activityType,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      company: company.trim(),
      linkedinUrl: linkedinUrl.trim(),
      notes: notes.trim(),
      date: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      ...(message.trim() ? { message: message.trim() } : {}),
    };
    setAccountData((prev) => ({
      ...prev,
      activityLogs: [newLog, ...(prev.activityLogs || [])],
    }));
    setFirstName("");
    setLastName("");
    setTitle("");
    setCompany("");
    setLinkedinUrl("");
    setNotes("");
    setMessage("");
  };

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Log your engagements and outreach for{" "}
          <strong>{accountData.companyName || "this account"}</strong> to
          maintain a running history.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                First Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Last Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Title
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Company
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                LinkedIn URL
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/3">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Activity Type
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  <option value="Phone Call">Phone Call</option>
                  <option value="Meeting / Discovery">Meeting / Discovery</option>
                  <option value="Email Sent">Email Sent</option>
                  <option value="LinkedIn Message">LinkedIn Message</option>
                  <option value="Message Sent">Message Sent</option>
                  <option value="Other Note">Other Note</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="w-full sm:w-2/3">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Engagement Notes
              </label>
              <textarea
                className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
                placeholder="What was discussed? Next steps?..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Full Message <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              className="w-full h-24 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-y custom-scrollbar shadow-sm font-sans"
              placeholder="Paste the full message body here, if applicable..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleLog}
              disabled={!notes.trim() && !message.trim()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Log Engagement
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" /> Engagement History
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {logs.length}
          </span>
        </h4>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No engagements logged yet. Start dialing!
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {logs.map((log) => {
              const isExpanded = !!expanded[log.id];
              return (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex gap-3 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="mt-0.5 shrink-0">{iconForType(log.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-sm text-slate-800">
                          {log.type}
                        </span>
                        {(log.firstName || log.lastName || log.company) && (
                          <span className="text-sm font-medium text-slate-500 ml-2">
                            with {log.firstName} {log.lastName}
                            {log.title ? ` (${log.title})` : ""}
                            {log.company ? ` @ ${log.company}` : ""}
                          </span>
                        )}
                        {log.linkedinUrl && (
                          <a
                            href={
                              log.linkedinUrl.startsWith("http")
                                ? log.linkedinUrl
                                : `https://${log.linkedinUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:text-blue-700 hover:underline text-sm font-semibold"
                          >
                            LinkedIn
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium shrink-0 ml-2">
                        {log.date}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                        {log.notes}
                      </p>
                    )}
                    {log.message && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <button
                          onClick={() => toggleExpanded(log.id)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          {isExpanded ? "Hide message" : "Show message"}
                        </button>
                        {isExpanded && (
                          <pre className="mt-2 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 border border-slate-200 p-3 rounded">
                            {log.message}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
