"use client";

import { useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, ChevronDown } from "lucide-react";
import type { StepProps } from "@/components/types";
import type { AccountStatus } from "@/lib/types";

export function AccountRelationship({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const [status, setStatus] = useState<AccountStatus>(accountData.accountStatus);

  const handleSave = () => {
    setAccountData((prev) => ({ ...prev, accountStatus: status }));
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <p className="text-sm text-gray-600">
          Define your current relationship with this account. This context will be
          used to tailor all AI-generated strategies and messaging.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Account Status
        </label>
        <div className="relative">
          <select
            className="w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 text-gray-800 font-medium"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus)}
          >
            <option value="" disabled>
              Select the relationship status...
            </option>
            <option value="Signed Account - Active">
              Signed Account - Active
            </option>
            <option value="Signed Account - Dormant">
              Signed Account - Dormant
            </option>
            <option value="Unsigned Account">Unsigned Account</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {status === "Signed Account - Active" && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800">
              <strong className="block mb-1">Active Client</strong>
              Toptal has a contract with this account and has worked with /
              generated revenue with the account in the last 12 months.
            </p>
          </div>
        )}

        {status === "Signed Account - Dormant" && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong className="block mb-1">Dormant Client</strong>
              Toptal has a signed contract on file with the account but has not
              generated revenue or delivered work for the account in at least 12
              months and potentially never.
            </p>
          </div>
        )}

        {status === "Unsigned Account" && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 animate-in fade-in">
            <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              <strong className="block mb-1">Prospect</strong>
              Toptal does not currently have a signed contract with this account.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={!status}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save &amp; Continue
        </button>
      </div>
    </div>
  );
}
