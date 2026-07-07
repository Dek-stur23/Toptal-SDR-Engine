"use client";

import { useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  History,
  MoreVertical,
  Plus,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Account } from "@/lib/types";
import {
  clearAllBackups,
  estimateAppStorageBytes,
  listBackups,
  type BackupSlot,
} from "@/lib/storage";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  accounts: Account[];
  currentAccountId: string | null;
  isSidebarOpen: boolean;
  isArchivedSectionOpen: boolean;
  currentView: "account" | "goals";
  onClose: () => void;
  onAddAccount: () => void;
  onSelectAccount: (id: string) => void;
  onRenameAccount: (id: string, name: string) => void;
  onArchiveAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onToggleArchivedSection: () => void;
  onExportState: () => void;
  onImportState: (file: File) => void;
  onRestoreBackup: (slot: BackupSlot) => void;
  onSelectGoalsView: () => void;
}

export function Sidebar({
  accounts,
  currentAccountId,
  isSidebarOpen,
  isArchivedSectionOpen,
  currentView,
  onClose,
  onAddAccount,
  onSelectAccount,
  onRenameAccount,
  onArchiveAccount,
  onDeleteAccount,
  onToggleArchivedSection,
  onExportState,
  onImportState,
  onRestoreBackup,
  onSelectGoalsView,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showBackups, setShowBackups] = useState(false);
  const [backups, setBackups] = useState<BackupSlot[]>([]);
  const [storageBytes, setStorageBytes] = useState<number | undefined>(
    undefined,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshBackupModal = () => {
    setBackups(listBackups());
    setStorageBytes(estimateAppStorageBytes());
  };

  const openBackups = () => {
    refreshBackupModal();
    setShowBackups(true);
  };

  const handleClearAllBackups = () => {
    if (
      !window.confirm(
        "Clear all snapshot slots? This frees space in your browser so a large state import can succeed, but you'll lose the rollback history.",
      )
    ) {
      return;
    }
    const cleared = clearAllBackups();
    refreshBackupModal();
    window.alert(`Cleared ${cleared} snapshot slot${cleared === 1 ? "" : "s"}.`);
  };

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  const startRename = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    setEditingId(acc.id);
    setEditingName(acc.name);
    setMenuOpenId(null);
  };

  const submitRename = (id: string) => {
    if (editingName.trim()) {
      onRenameAccount(id, editingName.trim());
    }
    setEditingId(null);
  };

  const renderItem = (acc: Account, archived: boolean) => {
    const isActive = currentAccountId === acc.id;
    const isEditing = editingId === acc.id;

    return (
      <div
        key={acc.id}
        onClick={() => onSelectAccount(acc.id)}
        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all relative ${
          isActive
            ? "bg-slate-800 text-white shadow-inner border border-slate-700/50"
            : archived
              ? "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 border border-transparent"
              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
        }`}
      >
        <div
          className={`flex items-center gap-3 overflow-hidden flex-1 ${archived ? "opacity-70" : ""}`}
        >
          <div
            className={`p-1.5 rounded-md ${
              isActive
                ? archived
                  ? "bg-slate-700 text-slate-300"
                  : "bg-blue-500/20 text-blue-400"
                : archived
                  ? "bg-slate-800/50 text-slate-600"
                  : "bg-slate-800 text-slate-500"
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
          </div>
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => submitRename(acc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename(acc.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-700 text-white text-sm px-2 py-1 rounded w-full outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <span className="text-sm font-medium truncate">{acc.name}</span>
          )}
        </div>

        {!isEditing && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpenId === acc.id ? null : acc.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity p-1.5 hover:bg-slate-700 rounded-md"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpenId === acc.id && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                  }}
                />
                <div className="absolute right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95">
                  {!archived && (
                    <button
                      onClick={(e) => startRename(e, acc)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Rename
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveAccount(acc.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    {archived ? (
                      <>
                        <ArchiveRestore className="w-3.5 h-3.5" /> Unarchive
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAccount(acc.id);
                      setMenuOpenId(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 flex items-center gap-2 transition-colors border-t border-slate-700/50 mt-1 pt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${isSidebarOpen ? "w-72" : "w-0"} transition-all duration-300 ease-in-out bg-slate-900 flex flex-col shrink-0 overflow-hidden shadow-xl z-20 relative`}
    >
      <div className="p-5 border-b border-slate-800 flex justify-between items-center whitespace-nowrap">
        <h2 className="text-slate-200 font-semibold text-sm tracking-wide uppercase">
          Your Accounts
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        <button
          onClick={onAddAccount}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Account
        </button>
        <button
          onClick={onSelectGoalsView}
          className={`w-full py-2 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
            currentView === "goals"
              ? "bg-slate-700 text-white shadow-inner"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200"
          }`}
        >
          <Target className="w-4 h-4" /> Goals &amp; Benchmarks
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
        {activeAccounts.map((acc) => renderItem(acc, false))}

        {archivedAccounts.length > 0 && (
          <div className="mt-6">
            <button
              onClick={onToggleArchivedSection}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 hover:text-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5" />
                Archived ({archivedAccounts.length})
              </div>
              {isArchivedSectionOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {isArchivedSectionOpen && (
              <div className="mt-2 space-y-1">
                {archivedAccounts.map((acc) => renderItem(acc, true))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
          Backup
        </p>
        <div className="flex gap-2">
          <button
            onClick={onExportState}
            className="flex-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-1.5 transition-colors"
            title="Download all accounts and state as JSON"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-1.5 transition-colors"
            title="Restore from a previously exported JSON file"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportState(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>
        <button
          onClick={openBackups}
          className="w-full text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-1.5 transition-colors"
          title="Restore from an automatic local snapshot"
        >
          <History className="w-3.5 h-3.5" /> Restore Snapshot
        </button>
      </div>

      {showBackups && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4"
          onClick={() => setShowBackups(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Local snapshots</h3>
              <button
                onClick={() => setShowBackups(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The app keeps the last {3} saved snapshots in your browser. Slot
              0 is the state just before the most recent save. Restoring
              replaces your current accounts and state.
            </p>
            {storageBytes !== undefined && (
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Storage used: </span>
                  <span className="font-semibold text-slate-700">
                    {formatBytes(storageBytes)}
                  </span>
                  <span className="text-slate-400"> of ~5 MB browser quota</span>
                </div>
                {backups.length > 0 && (
                  <button
                    onClick={handleClearAllBackups}
                    className="text-[11px] font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-2 py-1 rounded transition-colors"
                    title="Free up local storage by removing all snapshot slots"
                  >
                    Clear all to free space
                  </button>
                )}
              </div>
            )}
            {backups.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No snapshots yet. They are created automatically as you work.
              </p>
            ) : (
              <ul className="space-y-2">
                {backups.map((b) => {
                  const total = b.state.accounts.reduce(
                    (sum, a) => sum + (a.accountData?.hotlist?.length ?? 0),
                    0,
                  );
                  return (
                    <li
                      key={b.index}
                      className="border border-slate-200 rounded-md p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          Slot {b.index}
                        </p>
                        <p className="text-xs text-slate-500">
                          {b.state.accounts.length} account
                          {b.state.accounts.length === 1 ? "" : "s"} ·{" "}
                          {total} hotlist prospect{total === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Restore snapshot ${b.index}? This will replace your current state. (Your current state will not be backed up beyond what's already in the snapshot slots.)`,
                            )
                          ) {
                            onRestoreBackup(b);
                            setShowBackups(false);
                          }
                        }}
                        className="text-xs font-semibold text-orange-700 hover:text-white bg-orange-50 hover:bg-orange-600 border border-orange-200 hover:border-orange-600 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Restore
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
