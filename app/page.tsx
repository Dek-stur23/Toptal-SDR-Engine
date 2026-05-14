"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Download,
  FileText,
  Flame,
  History,
  Layers,
  Loader2,
  MessageSquare,
  Network,
  Newspaper,
  Package,
  Rocket,
  Search,
  Send,
  Target,
  Upload,
  User,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { StepCard } from "@/components/StepCard";
import { ToolCard } from "@/components/ToolCard";
import { AccountRelationship } from "@/components/steps/AccountRelationship";
import { AccountIntelligence } from "@/components/steps/AccountIntelligence";
import { AccountInitiative } from "@/components/steps/AccountInitiative";
import { ProductMap } from "@/components/steps/ProductMap";
import { ProcurementBureaucracy } from "@/components/steps/ProcurementBureaucracy";
import { AccountContext } from "@/components/steps/AccountContext";
import { PreviousContacts } from "@/components/steps/PreviousContacts";
import { TeamLinkSearch } from "@/components/steps/TeamLinkSearch";
import { MissionBuilder } from "@/components/steps/MissionBuilder";
import { RecentNews } from "@/components/tools/RecentNews";
import { IcpIntel } from "@/components/tools/IcpIntel";
import { PersonalizedMessaging } from "@/components/tools/PersonalizedMessaging";
import { LogEngagement } from "@/components/tools/LogEngagement";
import { EseMeeting } from "@/components/tools/EseMeeting";
import { Hotlist } from "@/components/tools/Hotlist";
import { StackMapper } from "@/components/engines/software/StackMapper";
import { FeatureMapper } from "@/components/engines/software/FeatureMapper";
import { UploadContact } from "@/components/engines/software/UploadContact";
import { MessageCrafter } from "@/components/engines/software/MessageCrafter";
import { ContactMap } from "@/components/engines/procurement/ContactMap";
import { LeaderProfile } from "@/components/engines/procurement/LeaderProfile";
import { Priorities } from "@/components/engines/procurement/Priorities";
import { ProcurementPitch } from "@/components/engines/procurement/ProcurementPitch";
import { ProductAnalysis } from "@/components/engines/product/ProductAnalysis";
import { ExpertProfile } from "@/components/engines/product/ExpertProfile";
import { exportAccountToPdf } from "@/lib/pdf";
import {
  createAccount,
  exportAppStateJson,
  loadAppState,
  parseImportedAppState,
  saveAppState,
} from "@/lib/storage";
import type { Account, AccountData, AppState, ToolId } from "@/lib/types";
import type { StepProps, ToolProps } from "@/components/types";

type StepDef = {
  id: number;
  title: string;
  icon: LucideIcon;
  Component: React.ComponentType<StepProps>;
};

type ToolDef = {
  id: ToolId;
  title: string;
  icon: LucideIcon;
  Component: React.ComponentType<ToolProps>;
};

const steps: StepDef[] = [
  { id: 1, title: "Account Relationship", icon: Users, Component: AccountRelationship },
  { id: 2, title: "Account Overview", icon: Briefcase, Component: AccountIntelligence },
  { id: 3, title: "Account Initiative & Challenges", icon: Target, Component: AccountInitiative },
  { id: 4, title: "Product & Project Map", icon: Layers, Component: ProductMap },
  { id: 5, title: "Procurement Insights", icon: FileText, Component: ProcurementBureaucracy },
  { id: 6, title: "Account Context", icon: BookOpen, Component: AccountContext },
  { id: 7, title: "Previous Contacts", icon: History, Component: PreviousContacts },
  { id: 8, title: "Team Link Search", icon: Network, Component: TeamLinkSearch },
  { id: 9, title: "Mission Builder", icon: Send, Component: MissionBuilder },
];

const softwareEngineSteps: StepDef[] = [
  { id: 1, title: "StackMapper", icon: Layers, Component: StackMapper },
  { id: 2, title: "FeatureMapper", icon: Code2, Component: FeatureMapper },
  { id: 3, title: "Upload Contact", icon: Upload, Component: UploadContact },
  { id: 4, title: "MessageCrafter", icon: MessageSquare, Component: MessageCrafter },
];

const procurementEngineSteps: StepDef[] = [
  { id: 1, title: "Contact Map", icon: Users, Component: ContactMap },
  { id: 2, title: "Leader Profile", icon: User, Component: LeaderProfile },
  { id: 3, title: "Priorities & Pain", icon: Target, Component: Priorities },
  { id: 4, title: "Procurement Pitch", icon: MessageSquare, Component: ProcurementPitch },
];

const productEngineSteps: StepDef[] = [
  { id: 1, title: "Product Analysis", icon: Layers, Component: ProductAnalysis },
  { id: 2, title: "Expert Profile", icon: Users, Component: ExpertProfile },
];

function scrollAnchorIntoView(anchorId: string) {
  if (typeof window === "undefined") return;
  // Wait two frames for React to flush state + render the newly-active step,
  // then smooth-scroll its anchor to the top of the viewport.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document
        .getElementById(anchorId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

const actionTools: ToolDef[] = [
  { id: "news", title: "Recent News", icon: Newspaper, Component: RecentNews },
  { id: "icpIntel", title: "ICP Intel", icon: User, Component: IcpIntel },
  { id: "messaging", title: "Personalized Messaging", icon: Wand2, Component: PersonalizedMessaging },
  { id: "hotlist", title: "Hotlist", icon: Flame, Component: Hotlist },
  { id: "log", title: "Log Engagement", icon: Activity, Component: LogEngagement },
  { id: "eseMeeting", title: "ESE Meeting", icon: Users, Component: EseMeeting },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    const initial = loadAppState();
    if (initial.accounts.length === 0) {
      const acc = createAccount();
      initial.accounts = [acc];
      initial.currentAccountId = acc.id;
    } else if (
      !initial.currentAccountId ||
      !initial.accounts.find((a) => a.id === initial.currentAccountId)
    ) {
      initial.currentAccountId = initial.accounts[0].id;
    }
    setState(initial);
  }, []);

  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const currentAccount = useMemo<Account | null>(() => {
    if (!state) return null;
    return (
      state.accounts.find((a) => a.id === state.currentAccountId) ??
      state.accounts[0] ??
      null
    );
  }, [state]);

  if (!state || !currentAccount) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F9FAFB] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="font-medium text-sm">Loading your accounts...</p>
      </div>
    );
  }

  const updateAccount = (id: string, modifier: (a: Account) => Account) => {
    setState((prev) => {
      if (!prev) return prev;
      const accounts = prev.accounts.map((a) => (a.id === id ? modifier(a) : a));
      return { ...prev, accounts };
    });
  };

  const setAccountData = (
    updater: AccountData | ((prev: AccountData) => AccountData),
  ) => {
    if (!currentAccount) return;
    updateAccount(currentAccount.id, (acc) => {
      const newData =
        typeof updater === "function" ? updater(acc.accountData) : updater;
      return {
        ...acc,
        accountData: newData,
        name: newData.companyName || acc.name,
      };
    });
  };

  const toggleActiveStep = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const next = acc.activeSteps.includes(stepId)
        ? acc.activeSteps.filter((s) => s !== stepId)
        : [...acc.activeSteps, stepId];
      return { ...acc, activeSteps: next };
    });
  };

  const handleStepComplete = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const completedSteps = acc.completedSteps.includes(stepId)
        ? acc.completedSteps
        : [...acc.completedSteps, stepId];
      const nextId = stepId + 1;
      const withoutCurrent = acc.activeSteps.filter((s) => s !== stepId);
      const activeSteps =
        nextId <= steps.length && !withoutCurrent.includes(nextId)
          ? [...withoutCurrent, nextId]
          : withoutCurrent;
      return { ...acc, completedSteps, activeSteps };
    });
    if (stepId + 1 <= steps.length) {
      scrollAnchorIntoView(`step-${stepId + 1}`);
    }
  };

  const toggleSoftwareEngineStep = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.softwareEngine;
      const next = engine.activeSteps.includes(stepId)
        ? engine.activeSteps.filter((s) => s !== stepId)
        : [...engine.activeSteps, stepId];
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          softwareEngine: { ...engine, activeSteps: next },
        },
      };
    });
  };

  const handleSoftwareEngineStepComplete = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.softwareEngine;
      const completedSteps = engine.completedSteps.includes(stepId)
        ? engine.completedSteps
        : [...engine.completedSteps, stepId];
      const nextId = stepId + 1;
      const withoutCurrent = engine.activeSteps.filter((s) => s !== stepId);
      const activeSteps =
        nextId <= softwareEngineSteps.length &&
        !withoutCurrent.includes(nextId)
          ? [...withoutCurrent, nextId]
          : withoutCurrent;
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          softwareEngine: { ...engine, completedSteps, activeSteps },
        },
      };
    });
    if (stepId + 1 <= softwareEngineSteps.length) {
      scrollAnchorIntoView(`engine-step-${stepId + 1}`);
    }
  };

  const toggleProcurementEngineStep = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.procurementEngine;
      const next = engine.activeSteps.includes(stepId)
        ? engine.activeSteps.filter((s) => s !== stepId)
        : [...engine.activeSteps, stepId];
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          procurementEngine: { ...engine, activeSteps: next },
        },
      };
    });
  };

  const handleProcurementEngineStepComplete = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.procurementEngine;
      const completedSteps = engine.completedSteps.includes(stepId)
        ? engine.completedSteps
        : [...engine.completedSteps, stepId];
      const nextId = stepId + 1;
      const withoutCurrent = engine.activeSteps.filter((s) => s !== stepId);
      const activeSteps =
        nextId <= procurementEngineSteps.length &&
        !withoutCurrent.includes(nextId)
          ? [...withoutCurrent, nextId]
          : withoutCurrent;
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          procurementEngine: { ...engine, completedSteps, activeSteps },
        },
      };
    });
    if (stepId + 1 <= procurementEngineSteps.length) {
      scrollAnchorIntoView(`procurement-step-${stepId + 1}`);
    }
  };

  const toggleProductEngineStep = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.productEngine;
      const next = engine.activeSteps.includes(stepId)
        ? engine.activeSteps.filter((s) => s !== stepId)
        : [...engine.activeSteps, stepId];
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          productEngine: { ...engine, activeSteps: next },
        },
      };
    });
  };

  const handleProductEngineStepComplete = (stepId: number) => {
    updateAccount(currentAccount.id, (acc) => {
      const engine = acc.accountData.productEngine;
      const completedSteps = engine.completedSteps.includes(stepId)
        ? engine.completedSteps
        : [...engine.completedSteps, stepId];
      const nextId = stepId + 1;
      const withoutCurrent = engine.activeSteps.filter((s) => s !== stepId);
      const activeSteps =
        nextId <= productEngineSteps.length && !withoutCurrent.includes(nextId)
          ? [...withoutCurrent, nextId]
          : withoutCurrent;
      return {
        ...acc,
        accountData: {
          ...acc.accountData,
          productEngine: { ...engine, completedSteps, activeSteps },
        },
      };
    });
    if (stepId + 1 <= productEngineSteps.length) {
      scrollAnchorIntoView(`product-step-${stepId + 1}`);
    }
  };

  const handleToolToggle = (toolId: ToolId) => {
    updateAccount(currentAccount.id, (acc) => ({
      ...acc,
      activeTool: acc.activeTool === toolId ? null : toolId,
    }));
  };

  const setActiveActionTool = (toolId: ToolId) => {
    updateAccount(currentAccount.id, (acc) => ({ ...acc, activeTool: toolId }));
  };

  const handleAddAccount = () => {
    const newAcc = createAccount();
    setState((prev) =>
      prev
        ? {
            ...prev,
            accounts: [newAcc, ...prev.accounts],
            currentAccountId: newAcc.id,
          }
        : prev,
    );
  };

  const handleSelectAccount = (id: string) => {
    setState((prev) => (prev ? { ...prev, currentAccountId: id } : prev));
  };

  const handleDeleteAccount = (id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const filtered = prev.accounts.filter((a) => a.id !== id);
      if (filtered.length === 0) {
        const fresh = createAccount();
        return {
          ...prev,
          accounts: [fresh],
          currentAccountId: fresh.id,
        };
      }
      const currentAccountId =
        prev.currentAccountId === id ? filtered[0].id : prev.currentAccountId;
      return { ...prev, accounts: filtered, currentAccountId };
    });
  };

  const handleArchiveAccount = (id: string) => {
    updateAccount(id, (acc) => ({ ...acc, isArchived: !acc.isArchived }));
  };

  const handleRenameAccount = (id: string, name: string) => {
    updateAccount(id, (acc) => ({ ...acc, name }));
  };

  const handleToggleSidebar = (open: boolean) => {
    setState((prev) => (prev ? { ...prev, isSidebarOpen: open } : prev));
  };

  const handleToggleArchivedSection = () => {
    setState((prev) =>
      prev
        ? { ...prev, isArchivedSectionOpen: !prev.isArchivedSectionOpen }
        : prev,
    );
  };

  const toggleEngineCollapsed = (
    key: "software" | "procurement" | "product",
  ) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            engineCollapsed: {
              ...prev.engineCollapsed,
              [key]: !prev.engineCollapsed[key],
            },
          }
        : prev,
    );
  };

  const handleExportPDF = () => {
    if (!currentAccount.accountData.companyName) {
      alert("Please specify a company name and run some research before exporting.");
      return;
    }
    exportAccountToPdf(currentAccount.accountData);
  };

  const handleExportState = () => {
    if (!state) return;
    const json = exportAppStateJson(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `toptal-sdr-engine-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportState = async (file: File) => {
    const confirmed = window.confirm(
      "Importing will replace your current accounts and state. Export your current state first if you want to keep it. Continue?",
    );
    if (!confirmed) return;
    try {
      const text = await file.text();
      const imported = parseImportedAppState(text);
      setState(imported);
    } catch (err) {
      console.error("Import error:", err);
      alert(
        `Could not import file: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const phase1Steps = steps.slice(0, 5);
  const phase2Steps = steps.slice(5);

  return (
    <div className="flex h-screen bg-[#F9FAFB] font-sans text-slate-900 overflow-hidden">
      <Sidebar
        accounts={state.accounts}
        currentAccountId={state.currentAccountId}
        isSidebarOpen={state.isSidebarOpen}
        isArchivedSectionOpen={state.isArchivedSectionOpen}
        onClose={() => handleToggleSidebar(false)}
        onAddAccount={handleAddAccount}
        onSelectAccount={handleSelectAccount}
        onRenameAccount={handleRenameAccount}
        onArchiveAccount={handleArchiveAccount}
        onDeleteAccount={handleDeleteAccount}
        onToggleArchivedSection={handleToggleArchivedSection}
        onExportState={handleExportState}
        onImportState={handleImportState}
      />

      <div className="flex-1 flex flex-col h-full overflow-y-auto relative bg-[#F9FAFB]">
        <Header
          isSidebarOpen={state.isSidebarOpen}
          onOpenSidebar={() => handleToggleSidebar(true)}
          companyName={currentAccount.accountData.companyName}
        />

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
          <div className="space-y-16">
            <section>
              <div className="flex items-center justify-between mb-8 pl-1">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-700">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                      Phase 1
                    </p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Account R&amp;D
                    </h2>
                  </div>
                </div>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export as PDF
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-[23px] top-4 bottom-8 w-[2px] bg-gray-200 rounded-full" />
                <div className="space-y-6">
                  {phase1Steps.map((step) => {
                    const isCompleted = currentAccount.completedSteps.includes(step.id);
                    const isActive = currentAccount.activeSteps.includes(step.id);
                    return (
                      <StepCard
                        key={step.id}
                        anchorId={`step-${step.id}`}
                        stepNumber={step.id}
                        title={step.title}
                        Icon={step.icon}
                        isCompleted={isCompleted}
                        isActive={isActive}
                        isLocked={false}
                        onToggle={() => toggleActiveStep(step.id)}
                      >
                        <step.Component
                          accountData={currentAccount.accountData}
                          setAccountData={setAccountData}
                          onComplete={() => handleStepComplete(step.id)}
                        />
                      </StepCard>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-8 pl-1">
                <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-700">
                  <Rocket className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                    Phase 2
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Account Launch
                  </h2>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-[23px] top-4 bottom-8 w-[2px] bg-gray-200 rounded-full" />
                <div className="space-y-6">
                  {phase2Steps.map((step) => {
                    const isCompleted = currentAccount.completedSteps.includes(step.id);
                    const isActive = currentAccount.activeSteps.includes(step.id);
                    return (
                      <StepCard
                        key={step.id}
                        anchorId={`step-${step.id}`}
                        stepNumber={step.id}
                        title={step.title}
                        Icon={step.icon}
                        isCompleted={isCompleted}
                        isActive={isActive}
                        isLocked={false}
                        onToggle={() => toggleActiveStep(step.id)}
                      >
                        <step.Component
                          accountData={currentAccount.accountData}
                          setAccountData={setAccountData}
                          onComplete={() => handleStepComplete(step.id)}
                        />
                      </StepCard>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-8 pl-1">
                <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-700">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                    Outreach Engines
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Outreach Engines
                  </h2>
                </div>
              </div>

              {(() => {
                const softwareCollapsed = state.engineCollapsed.software;
                const softwareEngine = currentAccount.accountData.softwareEngine;
                const softwareDoneCount = softwareEngine.completedSteps.filter(
                  (id) => id >= 1 && id <= softwareEngineSteps.length,
                ).length;
                return (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleEngineCollapsed("software")}
                      className={`w-full flex items-center gap-3 p-6 text-left hover:bg-slate-50/50 transition-colors ${softwareCollapsed ? "" : "border-b border-gray-100"}`}
                    >
                      <div className="bg-blue-600 text-white p-2 rounded-lg">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                          Engine
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Software Engine
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 font-medium mr-2 hidden sm:inline">
                        {softwareDoneCount} / {softwareEngineSteps.length}
                      </span>
                      {softwareCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {!softwareCollapsed && (
                      <div className="p-6 space-y-6">
                        <div className="relative">
                          <div className="absolute left-[23px] top-4 bottom-8 w-[2px] bg-gray-200 rounded-full" />
                          <div className="space-y-6">
                            {softwareEngineSteps.map((step) => {
                              const isCompleted = softwareEngine.completedSteps.includes(step.id);
                              const isActive = softwareEngine.activeSteps.includes(step.id);
                              return (
                                <StepCard
                                  key={step.id}
                                  anchorId={`engine-step-${step.id}`}
                                  stepNumber={step.id}
                                  title={step.title}
                                  Icon={step.icon}
                                  isCompleted={isCompleted}
                                  isActive={isActive}
                                  isLocked={false}
                                  onToggle={() => toggleSoftwareEngineStep(step.id)}
                                >
                                  <step.Component
                                    accountData={currentAccount.accountData}
                                    setAccountData={setAccountData}
                                    onComplete={() =>
                                      handleSoftwareEngineStepComplete(step.id)
                                    }
                                  />
                                </StepCard>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const procurementCollapsed = state.engineCollapsed.procurement;
                const procurementEngine = currentAccount.accountData.procurementEngine;
                const procurementDoneCount = procurementEngine.completedSteps.filter(
                  (id) => id >= 1 && id <= procurementEngineSteps.length,
                ).length;
                return (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
                    <button
                      onClick={() => toggleEngineCollapsed("procurement")}
                      className={`w-full flex items-center gap-3 p-6 text-left hover:bg-slate-50/50 transition-colors ${procurementCollapsed ? "" : "border-b border-gray-100"}`}
                    >
                      <div className="bg-emerald-600 text-white p-2 rounded-lg">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                          Engine
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Procurement Engine
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 font-medium mr-2 hidden sm:inline">
                        {procurementDoneCount} / {procurementEngineSteps.length}
                      </span>
                      {procurementCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {!procurementCollapsed && (
                      <div className="p-6 space-y-6">
                        <div className="relative">
                          <div className="absolute left-[23px] top-4 bottom-8 w-[2px] bg-gray-200 rounded-full" />
                          <div className="space-y-6">
                            {procurementEngineSteps.map((step) => {
                              const isCompleted = procurementEngine.completedSteps.includes(step.id);
                              const isActive = procurementEngine.activeSteps.includes(step.id);
                              return (
                                <StepCard
                                  key={step.id}
                                  anchorId={`procurement-step-${step.id}`}
                                  stepNumber={step.id}
                                  title={step.title}
                                  Icon={step.icon}
                                  isCompleted={isCompleted}
                                  isActive={isActive}
                                  isLocked={false}
                                  onToggle={() => toggleProcurementEngineStep(step.id)}
                                >
                                  <step.Component
                                    accountData={currentAccount.accountData}
                                    setAccountData={setAccountData}
                                    onComplete={() =>
                                      handleProcurementEngineStepComplete(step.id)
                                    }
                                  />
                                </StepCard>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const productCollapsed = state.engineCollapsed.product;
                const productEngine = currentAccount.accountData.productEngine;
                const productDoneCount = productEngine.completedSteps.filter(
                  (id) => id >= 1 && id <= productEngineSteps.length,
                ).length;
                return (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
                    <button
                      onClick={() => toggleEngineCollapsed("product")}
                      className={`w-full flex items-center gap-3 p-6 text-left hover:bg-slate-50/50 transition-colors ${productCollapsed ? "" : "border-b border-gray-100"}`}
                    >
                      <div className="bg-purple-600 text-white p-2 rounded-lg">
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">
                          Engine
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Product Engine
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 font-medium mr-2 hidden sm:inline">
                        {productDoneCount} / {productEngineSteps.length}
                      </span>
                      {productCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {!productCollapsed && (
                      <div className="p-6 space-y-6">
                        {productEngineSteps.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-sm italic">
                            No steps configured yet — coming soon.
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute left-[23px] top-4 bottom-8 w-[2px] bg-gray-200 rounded-full" />
                            <div className="space-y-6">
                              {productEngineSteps.map((step) => {
                                const isCompleted = productEngine.completedSteps.includes(step.id);
                                const isActive = productEngine.activeSteps.includes(step.id);
                                return (
                                  <StepCard
                                    key={step.id}
                                    anchorId={`product-step-${step.id}`}
                                    stepNumber={step.id}
                                    title={step.title}
                                    Icon={step.icon}
                                    isCompleted={isCompleted}
                                    isActive={isActive}
                                    isLocked={false}
                                    onToggle={() => toggleProductEngineStep(step.id)}
                                  >
                                    <step.Component
                                      accountData={currentAccount.accountData}
                                      setAccountData={setAccountData}
                                      onComplete={() =>
                                        handleProductEngineStepComplete(step.id)
                                      }
                                    />
                                  </StepCard>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            <section>
              <div className="flex items-center gap-4 mb-8 pl-1">
                <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-700">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                    Phase 3
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Daily Actions
                  </h2>
                </div>
              </div>

              <div className="space-y-6">
                {actionTools.map((tool) => {
                  const isActive = currentAccount.activeTool === tool.id;
                  return (
                    <ToolCard
                      key={tool.id}
                      title={tool.title}
                      Icon={tool.icon}
                      isActive={isActive}
                      onToggle={() => handleToolToggle(tool.id)}
                    >
                      <tool.Component
                        accountData={currentAccount.accountData}
                        setAccountData={setAccountData}
                        setActiveActionTool={setActiveActionTool}
                      />
                    </ToolCard>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
