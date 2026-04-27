"use client";

import { useState } from "react";
import { History, Plus } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { PreviousContact } from "@/lib/types";

export function PreviousContacts({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [salesforceLink, setSalesforceLink] = useState("");
  const [notes, setNotes] = useState("");

  const contacts = accountData.previousContacts || [];

  const handleAdd = () => {
    if (!name.trim()) return;
    const newContact: PreviousContact = {
      id: Date.now(),
      name: name.trim(),
      title: title.trim(),
      salesforceLink: salesforceLink.trim(),
      notes: notes.trim(),
      dateAdded: new Date().toLocaleString([], { dateStyle: "short" }),
      contacted: false,
    };
    setAccountData((prev) => ({
      ...prev,
      previousContacts: [newContact, ...(prev.previousContacts || [])],
    }));
    setName("");
    setTitle("");
    setSalesforceLink("");
    setNotes("");
  };

  const handleToggle = (id: number) => {
    setAccountData((prev) => ({
      ...prev,
      previousContacts: prev.previousContacts.map((c) =>
        c.id === id ? { ...c, contacted: !c.contacted } : c,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          List past contacts that Toptal has booked meetings with at{" "}
          <strong>{accountData.companyName || "this account"}</strong>. Consider
          contacting these individuals first.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., Sarah Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Title / Role
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
                placeholder="e.g., VP of Engineering"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Salesforce Link
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-sm text-gray-800"
              placeholder="https://..."
              value={salesforceLink}
              onChange={(e) => setSalesforceLink(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Past Context / Notes
            </label>
            <textarea
              className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
              placeholder="When was the last meeting? What was discussed? LinkedIn URL..."
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
              <Plus className="w-4 h-4" /> Save Contact
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" /> Saved Previous Contacts
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-auto">
            {contacts.length}
          </span>
        </h4>

        {contacts.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">
            No previous contacts logged yet.
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`bg-white p-4 rounded-lg border shadow-sm flex gap-3 animate-in fade-in slide-in-from-top-2 transition-all ${contact.contacted ? "border-slate-100 bg-slate-50/50 opacity-75" : "border-slate-200"}`}
              >
                <div className="flex items-start gap-3 w-full">
                  <input
                    type="checkbox"
                    checked={contact.contacted || false}
                    onChange={() => handleToggle(contact.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span
                          className={`font-bold text-sm ${contact.contacted ? "text-slate-500 line-through" : "text-slate-800"}`}
                        >
                          {contact.name}
                        </span>
                        {contact.title && (
                          <span
                            className={`text-sm font-medium ml-2 ${contact.contacted ? "text-slate-400" : "text-slate-500"}`}
                          >
                            - {contact.title}
                          </span>
                        )}
                        {contact.salesforceLink && (
                          <a
                            href={
                              contact.salesforceLink.startsWith("http")
                                ? contact.salesforceLink
                                : `https://${contact.salesforceLink}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-500 hover:text-blue-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            [Salesforce]
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {contact.dateAdded}
                      </span>
                    </div>
                    {contact.notes && (
                      <p
                        className={`text-sm whitespace-pre-wrap mt-2 ${contact.contacted ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {contact.notes}
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
          Mark Previous Contacts Complete
        </button>
      </div>
    </div>
  );
}
