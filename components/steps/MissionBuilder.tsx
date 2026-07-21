"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Plus, Rocket, Send, X } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { Mission, MissionTask } from "@/lib/types";

function genTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function MissionBuilder({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [missionName, setMissionName] = useState("");
  const [missionType, setMissionType] = useState("Generic-Broad");
  const [details, setDetails] = useState("");
  const [links, setLinks] = useState("");
  const [draftTasks, setDraftTasks] = useState<MissionTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");

  const missions = accountData.missions || [];

  const addDraftTask = () => {
    const label = newTaskLabel.trim();
    if (!label) return;
    setDraftTasks((prev) => [
      ...prev,
      { id: genTaskId(), label, completed: false },
    ]);
    setNewTaskLabel("");
  };

  const removeDraftTask = (id: string) => {
    setDraftTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLaunch = () => {
    if (!details.trim()) return;
    const newMission: Mission = {
      id: Date.now(),
      name: missionName.trim() || "Unnamed Mission",
      type: missionType,
      details: details.trim(),
      links: links.trim(),
      dateLaunched: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      completed: false,
      resultsBriefing: "",
      tasks: draftTasks,
    };
    setAccountData((prev) => ({
      ...prev,
      missions: [newMission, ...(prev.missions || [])],
    }));
    setMissionName("");
    setMissionType("Generic-Broad");
    setDetails("");
    setLinks("");
    setDraftTasks([]);
    setNewTaskLabel("");
  };

  const toggleComplete = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      missions: prev.missions.map((m) =>
        m.id === id ? { ...m, completed: !m.completed } : m,
      ),
    }));
  };

  const updateResults = (id: number, text: string) => {
    setAccountData((prev) => ({
      ...prev,
      missions: prev.missions.map((m) =>
        m.id === id ? { ...m, resultsBriefing: text } : m,
      ),
    }));
  };

  const toggleTask = (missionId: number, taskId: string) => {
    setAccountData((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => {
        if (m.id !== missionId) return m;
        return {
          ...m,
          tasks: (m.tasks || []).map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t,
          ),
        };
      }),
    }));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Outline and log the next mission you are building and launching for{" "}
        <strong>{accountData.companyName || "this account"}</strong>.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Mission Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., Q3 VP Outreach"
                value={missionName}
                onChange={(e) => setMissionName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Mission Type
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                  value={missionType}
                  onChange={(e) => setMissionType(e.target.value)}
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

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Custom Steps
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Add the prep steps you want this mission to track. None are added
              by default.
            </p>

            {draftTasks.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {draftTasks.map((task, idx) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5"
                  >
                    <span className="text-xs font-mono text-slate-400 w-5">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 text-sm text-slate-800">
                      {task.label}
                    </span>
                    <button
                      onClick={() => removeDraftTask(task.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      aria-label={`Remove ${task.label}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-sm text-gray-800"
                placeholder="Add a step (e.g., Build target list)"
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftTask();
                  }
                }}
              />
              <button
                onClick={addDraftTask}
                disabled={!newTaskLabel.trim()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 border border-slate-200"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleLaunch}
              disabled={!details.trim()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" /> Launch Mission
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-slate-500" /> Launched Missions
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {missions.length}
          </span>
        </h4>

        {missions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No missions launched yet. Time to build one!
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className={`bg-white p-4 rounded-lg border shadow-sm flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 transition-all ${mission.completed ? "border-slate-100 bg-slate-50/50 opacity-75" : "border-slate-200"}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={mission.completed || false}
                      onChange={() => toggleComplete(mission.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-bold text-sm ${mission.completed ? "text-slate-500 line-through" : "text-slate-800"}`}
                        >
                          {mission.name}
                        </span>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                          {mission.type}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5 ${mission.completed ? "text-slate-500" : "text-emerald-600"}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                        {mission.completed ? "Completed" : "Launched"}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {mission.dateLaunched}
                  </span>
                </div>

                <p
                  className={`text-sm mt-2 whitespace-pre-wrap ${mission.completed ? "text-slate-500" : "text-slate-700"}`}
                >
                  {mission.details}
                </p>

                {mission.links && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">
                      Links:
                    </span>
                    <a
                      href={
                        mission.links.startsWith("http")
                          ? mission.links
                          : `https://${mission.links}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-medium hover:underline break-all ${mission.completed ? "text-blue-400" : "text-blue-600"}`}
                    >
                      {mission.links}
                    </a>
                  </div>
                )}

                {mission.tasks && mission.tasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                      Mission Steps
                    </label>
                    <div className="space-y-1.5 pl-1">
                      {mission.tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex items-center gap-2 cursor-pointer group w-fit"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(mission.id, task.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span
                            className={`text-sm transition-all ${task.completed ? "text-slate-400 line-through" : "text-slate-700 group-hover:text-slate-900"}`}
                          >
                            {task.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Results Briefing
                  </label>
                  <textarea
                    className="w-full h-16 p-2 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm bg-white"
                    placeholder="How did this mission perform? (e.g., 2 meetings booked, low open rate...)"
                    value={mission.resultsBriefing || ""}
                    onChange={(e) => updateResults(mission.id, e.target.value)}
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
          Mark Mission Builder Complete
        </button>
      </div>
    </div>
  );
}
