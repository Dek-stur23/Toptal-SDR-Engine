"use client";

import { useState } from "react";
import type { StepProps } from "@/components/types";

export function AccountContext({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [notes, setNotes] = useState(accountData.accountContextNotes || "");

  const handleSave = () => {
    setAccountData((prev) => ({ ...prev, accountContextNotes: notes }));
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Store starting notes, context from your Enterprise Sales Executive, or
          historical data found in Salesforce for{" "}
          <strong>{accountData.companyName || "this account"}</strong>.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Salesforce &amp; ESE Context
        </label>
        <textarea
          className="w-full h-40 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
          placeholder="e.g., The ESE mentioned they used to work with us in 2021 but churned due to budget. Need to focus on cost savings..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all shadow-sm"
        >
          Save &amp; Continue
        </button>
      </div>
    </div>
  );
}
