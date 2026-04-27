"use client";

import { useState } from "react";
import { ChevronDown, Network, Plus } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { TeamLink } from "@/lib/types";

export function TeamLinkSearch({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [name, setName] = useState("");
  const [personType, setPersonType] = useState("Internal Team Member");
  const [connection, setConnection] = useState("");
  const [notes, setNotes] = useState("");

  const links = accountData.teamLinks || [];

  const handleAdd = () => {
    if (!name.trim()) return;
    const newLink: TeamLink = {
      id: Date.now(),
      name: name.trim(),
      personType,
      connection: connection.trim(),
      notes: notes.trim(),
      date: new Date().toLocaleString([], { dateStyle: "short" }),
      contacted: false,
    };
    setAccountData((prev) => ({
      ...prev,
      teamLinks: [newLink, ...(prev.teamLinks || [])],
    }));
    setName("");
    setPersonType("Internal Team Member");
    setConnection("");
    setNotes("");
  };

  const handleToggle = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      teamLinks: prev.teamLinks.map((l) =>
        l.id === id ? { ...l, contacted: !l.contacted } : l,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Identify and log internal team members or Toptal talent who have past
          experience or connections to{" "}
          <strong>{accountData.companyName || "this account"}</strong>.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Person Type
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value)}
                >
                  <option value="Internal Team Member">Internal Team Member</option>
                  <option value="Toptal Talent">Toptal Talent</option>
                  <option value="Alumni / Former Client">Alumni / Former Client</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Connection To Account
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., Former Engineering Manager"
                value={connection}
                onChange={(e) => setConnection(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Notes / LinkedIn URL
            </label>
            <textarea
              className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
              placeholder="Additional context or profile link..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Save Link
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Network className="w-4 h-4 text-slate-500" /> Saved Connections
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {links.length}
          </span>
        </h4>

        {links.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No connections logged yet.
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {links.map((link) => (
              <div
                key={link.id}
                className={`bg-white p-4 rounded-lg border shadow-sm flex gap-3 animate-in fade-in slide-in-from-top-2 transition-all ${link.contacted ? "border-slate-100 bg-slate-50/50 opacity-75" : "border-slate-200"}`}
              >
                <div className="flex items-start gap-3 w-full">
                  <input
                    type="checkbox"
                    checked={link.contacted || false}
                    onChange={() => handleToggle(link.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span
                          className={`font-bold text-sm ${link.contacted ? "text-slate-500 line-through" : "text-slate-800"}`}
                        >
                          {link.name}
                        </span>
                        <span
                          className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${link.contacted ? "bg-slate-200 text-slate-400" : "bg-blue-100 text-blue-700"}`}
                        >
                          {link.personType}
                        </span>
                        {link.connection && (
                          <span
                            className={`text-sm font-medium ml-2 ${link.contacted ? "text-slate-400" : "text-slate-500"}`}
                          >
                            - {link.connection}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{link.date}</span>
                    </div>
                    {link.notes && (
                      <p
                        className={`text-sm whitespace-pre-wrap mt-2 ${link.contacted ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {link.notes}
                      </p>
                    )}
                  </div>
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
          Mark Team Link Search Complete
        </button>
      </div>
    </div>
  );
}
