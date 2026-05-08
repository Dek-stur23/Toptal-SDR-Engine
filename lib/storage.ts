"use client";

import type { Account, AccountData, AppState } from "./types";
import type { ProcurementEngineState, SoftwareEngineState } from "./types";

const ROOT_KEY = "toptal-sdr-engine::app";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySoftwareEngine(): SoftwareEngineState {
  return {
    activeSteps: [],
    completedSteps: [],
    stack: {
      backend: "",
      frontend: "",
      data: "",
      devops: "",
      ai: "",
    },
    productInput: "",
    featureMap: "",
    contact: {
      firstName: "",
      lastName: "",
      title: "",
      company: "",
      liText: "",
      liImage: null,
    },
    technicalAuditor: "",
  };
}

export function emptyProcurementEngine(): ProcurementEngineState {
  return {
    activeSteps: [],
    completedSteps: [],
    contactMap: [],
    selectedContactId: null,
    leaderProfile: null,
    priorities: [],
    craftedMessage: "",
  };
}

export function emptyAccountData(): AccountData {
  return {
    accountStatus: "",
    companyName: "",
    accountContextNotes: "",
    procurementContacts: "",
    procurementStrategy: null,
    procurementCadence: null,
    messagingLiText: "",
    messagingLiImage: null,
    messagingContext: "",
    messagingContactName: "",
    generatedMessaging: "",
    messagingLogs: [],
    previousContacts: [],
    teamLinks: [],
    missions: [],
    eseMeetings: [],
    activityLogs: [],
    recentNewsResult: null,
    icpIntelResult: null,
    aiResearch: null,
    initiativeResearch: null,
    productMap: null,
    softwareEngine: emptySoftwareEngine(),
    procurementEngine: emptyProcurementEngine(),
  };
}

export function createAccount(): Account {
  return {
    id: newId(),
    createdAt: Date.now(),
    name: "New Account",
    isArchived: false,
    activeSteps: [1],
    activeTool: null,
    completedSteps: [],
    accountData: emptyAccountData(),
  };
}

function emptyApp(): AppState {
  return {
    accounts: [],
    currentAccountId: null,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
  };
}

export function loadAppState(): AppState {
  if (typeof window === "undefined") return emptyApp();
  try {
    const raw = window.localStorage.getItem(ROOT_KEY);
    if (!raw) return emptyApp();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      accounts: (parsed.accounts ?? []).map((a) => {
        const skeleton = createAccount();
        const baseEngine = emptySoftwareEngine();
        const loadedEngine = (a?.accountData?.softwareEngine ?? {}) as Partial<
          SoftwareEngineState & { activeStep?: number | null }
        >;
        const engineActiveSteps = Array.isArray(loadedEngine.activeSteps)
          ? loadedEngine.activeSteps
          : typeof loadedEngine.activeStep === "number"
            ? [loadedEngine.activeStep]
            : [];
        const legacyAccountData = (a?.accountData ?? {}) as Partial<
          AccountData & { cadences?: AccountData["missions"] }
        >;
        const missions = Array.isArray(legacyAccountData.missions)
          ? legacyAccountData.missions
          : Array.isArray(legacyAccountData.cadences)
            ? legacyAccountData.cadences
            : [];
        const baseProcurement = emptyProcurementEngine();
        const loadedProcurement = (legacyAccountData.procurementEngine ??
          {}) as Partial<ProcurementEngineState>;
        const accountData = {
          ...emptyAccountData(),
          ...legacyAccountData,
          missions,
          softwareEngine: {
            ...baseEngine,
            ...loadedEngine,
            activeSteps: engineActiveSteps,
            stack: {
              ...baseEngine.stack,
              ...(loadedEngine.stack ?? {}),
            },
          },
          procurementEngine: {
            ...baseProcurement,
            ...loadedProcurement,
            activeSteps: Array.isArray(loadedProcurement.activeSteps)
              ? loadedProcurement.activeSteps
              : [],
            completedSteps: Array.isArray(loadedProcurement.completedSteps)
              ? loadedProcurement.completedSteps
              : [],
            contactMap: Array.isArray(loadedProcurement.contactMap)
              ? loadedProcurement.contactMap
              : [],
            priorities: Array.isArray(loadedProcurement.priorities)
              ? loadedProcurement.priorities
              : [],
          },
        };
        const legacy = a as Partial<Account & { activeStep?: number | null }>;
        const activeSteps = Array.isArray(legacy?.activeSteps)
          ? legacy.activeSteps
          : typeof legacy?.activeStep === "number"
            ? [legacy.activeStep]
            : [1];
        return {
          ...skeleton,
          ...(a ?? {}),
          activeSteps,
          completedSteps: Array.isArray(a?.completedSteps)
            ? a.completedSteps
            : [],
          accountData,
        };
      }),
      currentAccountId: parsed.currentAccountId ?? null,
      isSidebarOpen: parsed.isSidebarOpen ?? true,
      isArchivedSectionOpen: parsed.isArchivedSectionOpen ?? false,
    };
  } catch {
    return emptyApp();
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOT_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save app state:", err);
  }
}
