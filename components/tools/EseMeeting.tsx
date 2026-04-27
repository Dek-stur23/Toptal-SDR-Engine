"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Users,
} from "lucide-react";
import type { ToolProps } from "@/components/types";
import type { EseMeeting as EseMeetingLog } from "@/lib/types";

const initialTasks = () => [
  {
    id: "q1",
    label:
      "Tell the ESE what you've been working on for the account. Reference the Cadence Builder if needed. Share results.",
    completed: false,
  },
  {
    id: "q2",
    label:
      "Ask the ESE if they have anything new they'd like to share about the account.",
    completed: false,
  },
  {
    id: "q3",
    label:
      "Review meetings logged with the ESE. Have they met with anyone else or do they have meetings coming up?",
    completed: false,
  },
  {
    id: "q4",
    label:
      "Review opps and STAs on the account. What's the most recent update and can you assist?",
    completed: false,
  },
  {
    id: "q5",
    label:
      "Discuss the next cadence you'll run. Do they have something in mind or can you make a recommendation?",
    completed: false,
  },
];

export function EseMeeting({ accountData, setAccountData }: ToolProps) {
  const [step, setStep] = useState(1);
  const [meetingDate, setMeetingDate] = useState("");
  const [discussedAccount, setDiscussedAccount] = useState(
    accountData.companyName || "",
  );
  const [notes, setNotes] = useState("");
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [tasks, setTasks] = useState(initialTasks());

  const logs = accountData.eseMeetings || [];
  const allCompleted = tasks.every((t) => t.completed);

  const handleContinue = () => {
    if (!meetingDate) return;
    setStep(2);
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleComplete = () => {
    const newMeeting: EseMeetingLog = {
      id: Date.now(),
      date: meetingDate,
      account: discussedAccount.trim() || accountData.companyName || "Unknown Account",
      notes: notes.trim(),
      loggedAt: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
    };

    setAccountData((prev) => ({
      ...prev,
      eseMeetings: [newMeeting, ...(prev.eseMeetings || [])],
    }));

    setStep(1);
    setMeetingDate("");
    setTasks(initialTasks());
    setNotes("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Prepare for and log your strategic alignment meetings with your
          Enterprise Sales Executive (ESE).
        </p>
      </div>

      {step === 1 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm max-w-md animate-in fade-in zoom-in-95">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Select Meeting Date
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800 mb-4"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
          />
          <button
            onClick={handleContinue}
            disabled={!meetingDate}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Continue to Meeting Prep
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-right-4">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> ESE Meeting Prep
            </h4>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Date: {meetingDate}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Account to Discuss
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                value={discussedAccount}
                onChange={(e) => setDiscussedAccount(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Discussion Topics Checklist
              </label>
              <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <span
                      className={`text-sm transition-all leading-relaxed ${task.completed ? "text-slate-400 line-through" : "text-slate-700 group-hover:text-slate-900"}`}
                    >
                      {task.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Additional Notes / Action Items
              </label>
              <textarea
                className="w-full h-24 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
                placeholder="Jot down any specific notes or takeaways..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep(1)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!allCompleted || !discussedAccount.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                title={!allCompleted ? "Complete all checklist items to unlock" : ""}
              >
                <CheckCircle2 className="w-4 h-4" /> Account Discussion Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm mt-6">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" /> Logged ESE Discussions
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
              {logs.length}
            </span>
          </h4>

          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {logs.map((log) => {
              const isExpanded = expandedLogs[log.id];
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col animate-in fade-in slide-in-from-top-2 transition-all"
                >
                  <div
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
                    onClick={() =>
                      setExpandedLogs((prev) => ({
                        ...prev,
                        [log.id]: !prev[log.id],
                      }))
                    }
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit">
                        {log.date}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {log.account}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
                        Logged: {log.loggedAt}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                      {log.notes ? (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap pl-3 border-l-2 border-slate-200">
                          {log.notes}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic pl-3 border-l-2 border-slate-100">
                          No additional notes recorded.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
