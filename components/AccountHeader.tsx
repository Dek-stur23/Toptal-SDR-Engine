"use client";

import type { Account } from "@/lib/types";
import { accountProgress } from "@/lib/storage";

interface Props {
  account: Account;
  onAccountNameChange: (name: string) => void;
  leftOffset: number;
}

export function AccountHeader({
  account,
  onAccountNameChange,
  leftOffset,
}: Props) {
  const { complete, total } = accountProgress(account);
  const pct = Math.round((complete / total) * 100);

  return (
    <header
      className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900/70 backdrop-blur transition-[padding]"
      style={{ paddingLeft: leftOffset }}
    >
      <div className="mx-auto max-w-5xl px-6 py-5 flex items-center gap-6">
        <div className="flex-1">
          <label className="block text-xs text-ink-400 mb-1">
            Account name
          </label>
          <input
            value={account.name}
            onChange={(e) => onAccountNameChange(e.target.value)}
            placeholder="e.g. Acme Global Holdings"
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-white placeholder-ink-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="w-48">
          <div className="flex items-center justify-between text-xs text-ink-400 mb-1">
            <span>Progress</span>
            <span>
              {complete}/{total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {account.status === "archived" ? (
          <span className="text-xs uppercase tracking-wide text-amber-300 border border-amber-500/40 bg-amber-500/10 rounded-full px-2 py-1">
            Archived
          </span>
        ) : null}
      </div>
    </header>
  );
}
