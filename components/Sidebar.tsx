"use client";

import { useState } from "react";
import type { Account } from "@/lib/types";
import { accountProgress } from "@/lib/storage";

interface Props {
  accounts: Account[];
  activeAccountId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCreateAccount: () => void;
  onSelectAccount: (id: string) => void;
  onArchiveAccount: (id: string) => void;
  onRestoreAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
}

export function Sidebar(props: Props) {
  const {
    accounts,
    activeAccountId,
    collapsed,
    onToggleCollapsed,
    onCreateAccount,
    onSelectAccount,
    onArchiveAccount,
    onRestoreAccount,
    onDeleteAccount,
  } = props;

  const active = accounts.filter((a) => a.status === "active");
  const archived = accounts.filter((a) => a.status === "archived");
  const [archivedOpen, setArchivedOpen] = useState(false);

  if (collapsed) {
    return (
      <aside className="fixed left-0 top-0 bottom-0 z-30 w-12 bg-ink-900 border-r border-ink-800 flex flex-col items-center py-4 gap-3">
        <button
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          className="h-8 w-8 rounded-md hover:bg-ink-800 text-ink-400 hover:text-white flex items-center justify-center"
        >
          »
        </button>
        <button
          onClick={onCreateAccount}
          title="New account"
          className="h-8 w-8 rounded-md bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center text-lg font-bold"
        >
          +
        </button>
        <div className="mt-1 flex flex-col gap-1.5 items-center overflow-y-auto scroll-soft flex-1 w-full px-1">
          {active.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelectAccount(a.id)}
              title={a.name || "Untitled account"}
              className={[
                "h-8 w-8 rounded-md flex items-center justify-center text-xs font-semibold border",
                a.id === activeAccountId
                  ? "border-brand-500 bg-brand-600/20 text-white"
                  : "border-ink-700 bg-ink-800 text-ink-300 hover:border-ink-600",
              ].join(" ")}
            >
              {initials(a.name)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-30 w-72 bg-ink-900 border-r border-ink-800 flex flex-col">
      <div className="px-4 py-4 border-b border-ink-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <div className="leading-tight">
            <div className="text-[11px] text-ink-500">Toptal</div>
            <div className="text-sm font-semibold text-white">SDR Engine</div>
          </div>
        </div>
        <button
          onClick={onToggleCollapsed}
          title="Collapse sidebar"
          className="h-7 w-7 rounded-md hover:bg-ink-800 text-ink-400 hover:text-white flex items-center justify-center"
        >
          «
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onCreateAccount}
          className="w-full rounded-md bg-brand-600 hover:bg-brand-500 transition px-3 py-2 text-sm font-medium text-white flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">+</span>
          New Account
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-soft px-2 pb-3">
        <SectionHeading label="Active" count={active.length} />
        {active.length === 0 ? (
          <div className="px-2 py-6 text-xs text-ink-500">
            No active accounts yet. Click{" "}
            <span className="text-ink-300">New Account</span> to start one.
          </div>
        ) : (
          <ul className="space-y-1">
            {active.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                isActive={a.id === activeAccountId}
                onSelect={() => onSelectAccount(a.id)}
                onArchive={() => onArchiveAccount(a.id)}
                onDelete={() => onDeleteAccount(a.id)}
              />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setArchivedOpen((v) => !v)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs uppercase tracking-wide text-ink-500 hover:text-ink-300"
            >
              <span>
                Archived{" "}
                <span className="text-ink-600">({archived.length})</span>
              </span>
              <span>{archivedOpen ? "−" : "+"}</span>
            </button>
            {archivedOpen && (
              <ul className="space-y-1 mt-1">
                {archived.map((a) => (
                  <AccountRow
                    key={a.id}
                    account={a}
                    isActive={a.id === activeAccountId}
                    archived
                    onSelect={() => onSelectAccount(a.id)}
                    onRestore={() => onRestoreAccount(a.id)}
                    onDelete={() => onDeleteAccount(a.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-2 pt-2 pb-1 flex items-center justify-between text-xs uppercase tracking-wide text-ink-500">
      <span>{label}</span>
      <span className="text-ink-600">{count}</span>
    </div>
  );
}

interface RowProps {
  account: Account;
  isActive: boolean;
  archived?: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}

function AccountRow({
  account,
  isActive,
  archived,
  onSelect,
  onArchive,
  onRestore,
  onDelete,
}: RowProps) {
  const { complete, total } = accountProgress(account);
  return (
    <li>
      <div
        className={[
          "group relative rounded-md border px-2.5 py-2 transition cursor-pointer",
          isActive
            ? "border-brand-500/60 bg-ink-800"
            : "border-transparent hover:bg-ink-800/60 hover:border-ink-800",
          archived ? "opacity-70" : "",
        ].join(" ")}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={[
              "h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-xs font-semibold",
              isActive
                ? "bg-brand-600 text-white"
                : "bg-ink-800 text-ink-300 border border-ink-700",
            ].join(" ")}
          >
            {initials(account.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white truncate">
              {account.name || "Untitled account"}
            </div>
            <div className="text-[11px] text-ink-500">
              {complete}/{total} steps · updated {shortDate(account.updatedAt)}
            </div>
          </div>
        </div>

        <div className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center gap-1">
          {archived && onRestore ? (
            <IconBtn
              title="Restore"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
            >
              ↩
            </IconBtn>
          ) : null}
          {!archived && onArchive ? (
            <IconBtn
              title="Archive"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
            >
              ▾
            </IconBtn>
          ) : null}
          <IconBtn
            title="Delete"
            danger
            onClick={(e) => {
              e.stopPropagation();
              if (
                confirm(
                  `Delete "${account.name || "Untitled account"}"? This cannot be undone.`,
                )
              ) {
                onDelete();
              }
            }}
          >
            ×
          </IconBtn>
        </div>
      </div>
    </li>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "h-6 w-6 rounded-md text-xs flex items-center justify-center border",
        danger
          ? "border-ink-700 bg-ink-900 text-ink-400 hover:text-red-300 hover:border-red-500/60"
          : "border-ink-700 bg-ink-900 text-ink-300 hover:text-white hover:border-ink-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "–";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "–";
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
