"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Briefcase,
  Download,
  FileText,
  History,
  Layers,
  Loader2,
  Network,
  Newspaper,
  Rocket,
  Search,
  Send,
  Target,
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
import { InitiativeArchitect } from "@/components/steps/InitiativeArchitect";
import { ProcurementBureaucracy } from "@/components/steps/ProcurementBureaucracy";
import { AccountContext } from "@/components/steps/AccountContext";
import { PreviousContacts } from "@/components/steps/PreviousContacts";
import { TeamLinkSearch } from "@/components/steps/TeamLinkSearch";
import { CadenceBuilder } from "@/components/steps/CadenceBuilder";
import { RecentNews } from "@/components/tools/RecentNews";
import { IcpIntel } from "@/components/tools/IcpIntel";
import { PersonalizedMessaging } from "@/components/tools/PersonalizedMessaging";
import { LogConversation } from "@/components/tools/LogConversation";
import { EseMeeting } from "@/components/tools/EseMeeting";
import { exportAccountToPdf } from "@/lib/pdf";
import { createAccount, loadAppState, saveAppState } from "@/lib/storage";
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
  { id: 4, title: "Initiative / Challenge Architect", icon: Layers, Component: InitiativeArchitect },
  { id: 5, title: "Procurement Insights", icon: FileText, Component: ProcurementBureaucracy },
  { id: 6, title: "Account Context", icon: BookOpen, Component: AccountContext },
  { id: 7, title: "Previous Contacts", icon: History, Component: PreviousContacts },
  { id: 8, title: "Team Link Search", icon: Network, Component: TeamLinkSearch },
  { id: 9, title: "Cadence Builder", icon: Send, Component: CadenceBuilder },
];

const actionTools: ToolDef[] = [
  { id: "news", title: "Recent News", icon: Newspaper, Component: RecentNews },
  { id: "icpIntel", title: "ICP Intel", icon: User, Component: IcpIntel },
  { id: "messaging", title: "Personalized Messaging", icon: Wand2, Component: PersonalizedMessaging },
  { id: "log", title: "Log Conversation", icon: Activity, Component: LogConversation },
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

  const setActiveStep = (step: number | null) => {
    updateAccount(currentAccount.id, (acc) => ({ ...acc, activeStep: step }));
  };

  const setCompletedSteps = (
    updater: number[] | ((prev: number[]) => number[]),
  ) => {
    updateAccount(currentAccount.id, (acc) => {
      const newSteps =
        typeof updater === "function" ? updater(acc.completedSteps) : updater;
      return { ...acc, completedSteps: newSteps };
    });
  };

  const handleStepComplete = (stepId: number) => {
    if (!currentAccount.completedSteps.includes(stepId)) {
      setCompletedSteps([...currentAccount.completedSteps, stepId]);
    }
    if (currentAccount.activeStep === stepId && stepId < steps.length) {
      setActiveStep(stepId + 1);
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

  const handleExportPDF = () => {
    if (!currentAccount.accountData.companyName) {
      alert("Please specify a company name and run some research before exporting.");
      return;
    }
    exportAccountToPdf(currentAccount.accountData);
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
                    const isActive = currentAccount.activeStep === step.id;
                    return (
                      <StepCard
                        key={step.id}
                        stepNumber={step.id}
                        title={step.title}
                        Icon={step.icon}
                        isCompleted={isCompleted}
                        isActive={isActive}
                        isLocked={false}
                        onToggle={() => setActiveStep(isActive ? null : step.id)}
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
                    const isActive = currentAccount.activeStep === step.id;
                    return (
                      <StepCard
                        key={step.id}
                        stepNumber={step.id}
                        title={step.title}
                        Icon={step.icon}
                        isCompleted={isCompleted}
                        isActive={isActive}
                        isLocked={false}
                        onToggle={() => setActiveStep(isActive ? null : step.id)}
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
