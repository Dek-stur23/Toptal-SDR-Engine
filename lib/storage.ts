"use client";

import type { Account, AccountData, AppState } from "./types";
import type { SoftwareEngineState } from "./types";

const ROOT_KEY = "toptal-sdr-engine::app";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySoftwareEngine(): SoftwareEngineState {
  return {
    activeStep: null,
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
    keywords: "",
    contact: {
      firstName: "",
      lastName: "",
      title: "",
      company: "",
      liText: "",
      liImage: null,
    },
    craftedMessage: "",
    technographicPitch: "",
    technicalAuditor: "",
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
    cadences: [],
    eseMeetings: [],
    activityLogs: [],
    recentNewsResult: null,
    icpIntelResult: null,
    aiResearch: null,
    initiativeResearch: null,
    architectResults: {},
    softwareEngine: emptySoftwareEngine(),
  };
}

export function createAccount(): Account {
  return {
    id: newId(),
    createdAt: Date.now(),
    name: "New Account",
    isArchived: false,
    activeStep: 1,
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
        const loadedEngine = a?.accountData?.softwareEngine ?? {};
        const accountData = {
          ...emptyAccountData(),
          ...(a?.accountData ?? {}),
          softwareEngine: {
            ...baseEngine,
            ...loadedEngine,
            stack: {
              ...baseEngine.stack,
              ...((loadedEngine as { stack?: Partial<typeof baseEngine.stack> })
                .stack ?? {}),
            },
          },
        };
        return {
          ...skeleton,
          ...(a ?? {}),
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
