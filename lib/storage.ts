"use client";

import type { Account, AccountData, AppState } from "./types";
import {
  DEFAULT_ACCOUNT_INTELLIGENCE_GEM,
  DEFAULT_ARCHITECT_GEM,
  DEFAULT_INITIATIVE_GEM,
  DEFAULT_PROCUREMENT_CADENCE_GEM,
  DEFAULT_PROCUREMENT_STRATEGY_GEM,
  DEFAULT_RECENT_NEWS_GEM,
} from "./gems";

const ROOT_KEY = "toptal-sdr-engine::app";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    recentNewsInstructions: DEFAULT_RECENT_NEWS_GEM,
    icpIntelResult: null,
    gemInstructions: DEFAULT_ACCOUNT_INTELLIGENCE_GEM,
    aiResearch: null,
    step2GemInstructions: DEFAULT_INITIATIVE_GEM,
    initiativeResearch: null,
    step3GemInstructions: DEFAULT_ARCHITECT_GEM,
    step5GemInstructions: DEFAULT_PROCUREMENT_STRATEGY_GEM,
    step5CadenceInstructions: DEFAULT_PROCUREMENT_CADENCE_GEM,
    architectResults: {},
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
      accounts: (parsed.accounts ?? []).map((a) => ({
        ...a,
        accountData: { ...emptyAccountData(), ...(a.accountData ?? {}) },
      })),
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
