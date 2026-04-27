"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Rocket, Send } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { Cadence, CadenceTask } from "@/lib/types";

const defaultTasks = (): CadenceTask[] => [
  { id: "t1", label: "Build List", completed: false },
  { id: "t2", label: "Identify Existing Contacts", completed: false },
  { id: "t3", label: "Search for TeamLinks", completed: false },
  { id: "t4", label: "Develop Messaging", completed: false },
  { id: "t5", label: "LinkedIn Connect Requests", completed: false },
];

export function CadenceBuilder({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [cadenceName, setCadenceName] = useState("");
  const [cadenceType, setCadenceType] = useState("Generic-Broad");
  const [details, setDetails] = useState("");
  const [links, setLinks] = useState("");

  const cadences = accountData.cadences || [];

  const handleLaunch = () => {
    if (!details.trim()) return;
    const newCadence: Cadence = {
      id: Date.now(),
      name: cadenceName.trim() || "Unnamed Cadence",
      type: cadenceType,
      details: details.trim(),
      links: links.trim(),
      dateLaunched: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      completed: false,
      resultsBriefing: "",
      tasks: defaultTasks(),
    };
    setAccountData((prev) => ({
      ...prev,
      cadences: [newCadence, ...(prev.cadences || [])],
    }));
    setCadenceName("");
    setCadenceType("Generic-Broad");
    setDetails("");
    setLinks("");
  };

  const toggleComplete = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      cadences: prev.cadences.map((c) =>
        c.id === id ? { ...c, completed: !c.completed } : c,
      ),
    }));
  };

  const updateResults = (id: number, text: string) => {
    setAccountData((prev) => ({
      ...prev,
      cadences: prev.cadences.map((c) =>
        c.id === id ? { ...c, resultsBriefing: text } : c,
      ),
    }));
  };

  const toggleTask = (cadenceId: number, taskId: string) => {
    setAccountData((prev) => ({
      ...prev,
      cadences: prev.cadences.map((c) => {
        if (c.id !== cadenceId) return c;
        const tasks = c.tasks?.length ? c.tasks : defaultTasks();
        return {
          ...c,
          tasks: tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t,
          ),
        };
      }),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Outline and log the next cadence you are building and launching for{" "}
          <strong>{accountData.companyName || "this account"}</strong>.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Cadence Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., Q3 VP Outreach"
                value={cadenceName}
                onChange={(e) => setCadenceName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Cadence Type
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                  value={cadenceType}
                  onChange={(e) => setCadenceType(e.target.value)}
                >
                  <option value="Generic-Broad">Generic-Broad</option>
                  <option value="ICP Specific">ICP Specific</option>
                  <option value="Product-Specific">Product-Specific</option>
                  <option value="Initiative-Specific">Initiative-Specific</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Relevant Links
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., SalesLoft / Outreach URL..."
                value={links}
                onChange={(e) => setLinks(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Specific Details / Strategy
            </label>
            <textarea
              className="w-full h-24 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
              placeholder="Who are we targeting? What is the main message track?..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleLaunch}
              disabled={!details.trim()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" /> Launch Cadence
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-slate-500" /> Launched Cadences
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {cadences.length}
          </span>
        </h4>

        {cadences.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No cadences launched yet. Time to build one!
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {cadences.map((cadence) => (
              <div
                key={cadence.id}
                className={`bg-white p-4 rounded-lg border shadow-sm flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 transition-all ${cadence.completed ? "border-slate-100 bg-slate-50/50 opacity-75" : "border-slate-200"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={cadence.completed || false}
                      onChange={() => toggleComplete(cadence.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-bold text-sm ${cadence.completed ? "text-slate-500 line-through" : "text-slate-800"}`}
                        >
                          {cadence.name}
                        </span>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                          {cadence.type}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5 ${cadence.completed ? "text-slate-500" : "text-emerald-600"}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                        {cadence.completed ? "Completed" : "Launched"}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {cadence.dateLaunched}
                  </span>
                </div>

                <p
                  className={`text-sm mt-2 whitespace-pre-wrap ${cadence.completed ? "text-slate-500" : "text-slate-700"}`}
                >
                  {cadence.details}
                </p>

                {cadence.links && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">
                      Links:
                    </span>
                    <a
                      href={
                        cadence.links.startsWith("http")
                          ? cadence.links
                          : `https://${cadence.links}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium hover:underline break-all ${cadence.completed ? "text-blue-400" : "text-blue-600"}`}
                    >
                      {cadence.links}
                    </a>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Cadence Prep Checklist
                  </label>
                  <div className="space-y-1.5 pl-1 mb-4">
                    {(cadence.tasks?.length ? cadence.tasks : defaultTasks()).map(
                      (task) => (
                        <label
                          key={task.id}
                          className="flex items-center gap-2 cursor-pointer group w-fit"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(cadence.id, task.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span
                            className={`text-sm transition-all ${task.completed ? "text-slate-400 line-through" : "text-slate-700 group-hover:text-slate-900"}`}
                          >
                            {task.label}
                          </span>
                        </label>
                      ),
                    )}
                  </div>

                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 border-t border-slate-100 pt-3">
                    Results Briefing
                  </label>
                  <textarea
                    className="w-full h-16 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm bg-white"
                    placeholder="How did this cadence perform? (e.g., 2 meetings booked, low open rate...)"
                    value={cadence.resultsBriefing || ""}
                    onChange={(e) => updateResults(cadence.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={onComplete}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all shadow-sm"
        >
          Mark Cadence Builder Complete
        </button>
      </div>
    </div>
  );
}
