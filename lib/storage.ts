"use client";

import type {
  Account,
  AccountData,
  AppState,
  HotlistChannel,
  HotlistMessage,
  HotlistPriority,
  HotlistProspect,
} from "./types";
import type {
  ProcurementEngineState,
  ProductEngineState,
  SoftwareEngineState,
} from "./types";
import { genId } from "./ids";

const ROOT_KEY = "toptal-sdr-engine::app";
const BACKUP_KEY_PREFIX = "toptal-sdr-engine::backup::";
const BACKUP_SLOTS = 3;
const EXPORT_FORMAT_VERSION = 1;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Coerces a stored prospect into the current shape. Older entries may carry
// "email" / "phone" — those are intentionally dropped here so the next save
// removes them from localStorage.
function cleanChannel(raw: unknown): HotlistChannel {
  if (
    raw === "Email" ||
    raw === "LinkedIn" ||
    raw === "Phone" ||
    raw === "Meeting" ||
    raw === "Other"
  ) {
    return raw;
  }
  return "Email";
}

function cleanPendingDraft(
  raw: unknown,
): HotlistProspect["pendingDraft"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const body = typeof d.body === "string" ? d.body : "";
  const subject = typeof d.subject === "string" ? d.subject : "";
  const response = typeof d.response === "string" ? d.response : "";
  // Only persist drafts with at least some content — strips empty-shell
  // drafts that would otherwise clutter storage forever.
  if (!body.trim() && !subject.trim() && !response.trim()) return undefined;
  return {
    channel: cleanChannel(d.channel),
    subject,
    body,
    response,
  };
}

function cleanProspect(raw: unknown): HotlistProspect | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id =
    typeof p.id === "number" && Number.isFinite(p.id) ? p.id : genId();
  const pendingDraft = cleanPendingDraft(p.pendingDraft);
  return {
    id,
    firstName: typeof p.firstName === "string" ? p.firstName : "",
    lastName: typeof p.lastName === "string" ? p.lastName : "",
    title: typeof p.title === "string" ? p.title : "",
    company: typeof p.company === "string" ? p.company : "",
    linkedinUrl: typeof p.linkedinUrl === "string" ? p.linkedinUrl : "",
    priority:
      p.priority === "high" || p.priority === "medium" || p.priority === "low"
        ? (p.priority as HotlistPriority)
        : "medium",
    notes: typeof p.notes === "string" ? p.notes : "",
    dateAdded: typeof p.dateAdded === "string" ? p.dateAdded : "",
    messages: Array.isArray(p.messages)
      ? (p.messages.filter(
          (m) => m && typeof m === "object",
        ) as HotlistMessage[])
      : [],
    image: typeof p.image === "string" ? p.image : null,
    ...(pendingDraft ? { pendingDraft } : {}),
  };
}

function cleanHotlist(raw: unknown): HotlistProspect[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map(cleanProspect)
    .filter((p): p is HotlistProspect => p !== null);
  const seen = new Set<number>();
  return cleaned.map((p) => {
    if (seen.has(p.id)) {
      // genId() is monotonic across the session, so it's guaranteed to not
      // collide with anything we've seen so far.
      p = { ...p, id: genId() };
    }
    seen.add(p.id);
    return p;
  });
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
    leaderImage: null,
    leaderProfile: null,
    priorities: [],
    selectedPriorityIndex: null,
    craftedMessage: "",
  };
}

export function emptyProductEngine(): ProductEngineState {
  return {
    activeSteps: [],
    completedSteps: [],
    selectedProduct: "",
    analysis: "",
    expertProfile: "",
    contact: {
      firstName: "",
      lastName: "",
      title: "",
      company: "",
      linkedinUrl: "",
      image: null,
    },
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
    messagingFocus: [],
    generatedMessaging: "",
    messagingLogs: [],
    previousContacts: [],
    teamLinks: [],
    missions: [],
    eseMeetings: [],
    activityLogs: [],
    hotlist: [],
    recentNewsResult: null,
    icpIntelResult: null,
    aiResearch: null,
    initiativeResearch: null,
    productMap: null,
    softwareEngine: emptySoftwareEngine(),
    procurementEngine: emptyProcurementEngine(),
    productEngine: emptyProductEngine(),
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
    engineCollapsed: { software: false, procurement: false, product: false },
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
        const hotlist = cleanHotlist(legacyAccountData.hotlist);
        const messagingFocus = Array.isArray(legacyAccountData.messagingFocus)
          ? legacyAccountData.messagingFocus.filter(
              (s): s is string => typeof s === "string",
            )
          : [];
        const baseProcurement = emptyProcurementEngine();
        const loadedProcurement = (legacyAccountData.procurementEngine ??
          {}) as Partial<ProcurementEngineState>;
        const baseProduct = emptyProductEngine();
        const loadedProduct = (legacyAccountData.productEngine ??
          {}) as Partial<ProductEngineState>;
        const accountData = {
          ...emptyAccountData(),
          ...legacyAccountData,
          missions,
          hotlist,
          messagingFocus,
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
          productEngine: {
            ...baseProduct,
            ...loadedProduct,
            activeSteps: Array.isArray(loadedProduct.activeSteps)
              ? loadedProduct.activeSteps
              : [],
            completedSteps: Array.isArray(loadedProduct.completedSteps)
              ? loadedProduct.completedSteps
              : [],
            contact: {
              ...baseProduct.contact,
              ...(loadedProduct.contact ?? {}),
            },
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
      engineCollapsed: {
        software: parsed.engineCollapsed?.software ?? false,
        procurement: parsed.engineCollapsed?.procurement ?? false,
        product: parsed.engineCollapsed?.product ?? false,
      },
    };
  } catch {
    return emptyApp();
  }
}

function rotateBackups(prevSerialized: string | null) {
  if (typeof window === "undefined" || prevSerialized === null) return;
  try {
    // Shift backup slot N-2 -> N-1, ..., 0 -> 1, then write the previous
    // serialized state into slot 0. Old slot 2 falls off.
    for (let i = BACKUP_SLOTS - 1; i > 0; i--) {
      const older = window.localStorage.getItem(
        `${BACKUP_KEY_PREFIX}${i - 1}`,
      );
      if (older !== null) {
        window.localStorage.setItem(`${BACKUP_KEY_PREFIX}${i}`, older);
      } else {
        window.localStorage.removeItem(`${BACKUP_KEY_PREFIX}${i}`);
      }
    }
    window.localStorage.setItem(`${BACKUP_KEY_PREFIX}0`, prevSerialized);
  } catch (err) {
    // Backup failure is non-fatal; the primary save still happens.
    console.warn("Backup rotation failed (non-fatal):", err);
  }
}

function notifySaveFailure(err: unknown) {
  console.error("Failed to save app state:", err);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("toptal-sdr-engine:save-failed", {
          detail: { message: err instanceof Error ? err.message : String(err) },
        }),
      );
    } catch {
      // ignore: CustomEvent isn't available in some environments
    }
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") return;
  let serialized: string;
  try {
    serialized = JSON.stringify(state);
  } catch (err) {
    notifySaveFailure(err);
    return;
  }
  const prev = (() => {
    try {
      return window.localStorage.getItem(ROOT_KEY);
    } catch {
      return null;
    }
  })();
  try {
    window.localStorage.setItem(ROOT_KEY, serialized);
  } catch (err) {
    // Primary write failed (quota exceeded, private mode, etc). Surface it
    // — the previous state still sits on disk and in backup slots, but the
    // user's last edit is unsaved and they need to know.
    notifySaveFailure(err);
    return;
  }
  rotateBackups(prev);
}

export interface BackupSlot {
  index: number;
  state: AppState;
}

// Returns available backup slots, newest first. Slot 0 is the snapshot taken
// just before the most recent save; slot 1 is the one before that; etc.
export function listBackups(): BackupSlot[] {
  if (typeof window === "undefined") return [];
  const slots: BackupSlot[] = [];
  for (let i = 0; i < BACKUP_SLOTS; i++) {
    try {
      const raw = window.localStorage.getItem(`${BACKUP_KEY_PREFIX}${i}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as AppState;
      slots.push({ index: i, state: parsed });
    } catch {
      // Skip corrupt slots silently — they'll be overwritten on next rotate.
    }
  }
  return slots;
}

export function restoreBackup(index: number): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${BACKUP_KEY_PREFIX}${index}`);
    if (!raw) return null;
    // Run through parseImportedAppState so cleanHotlist + per-account
    // migration defenses kick in on the recovered snapshot.
    return parseImportedAppState(
      JSON.stringify({
        app: "toptal-sdr-engine",
        version: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        state: JSON.parse(raw),
      }),
    );
  } catch (err) {
    console.error("Failed to restore backup:", err);
    return null;
  }
}

interface ExportEnvelope {
  app: "toptal-sdr-engine";
  version: number;
  exportedAt: string;
  state: AppState;
}

export function exportAppStateJson(state: AppState): string {
  const envelope: ExportEnvelope = {
    app: "toptal-sdr-engine",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseImportedAppState(json: string): AppState {
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("File is not a valid JSON object.");
  }
  // Accept either the envelope shape or a bare AppState (for forward
  // compatibility with manual hand-edits / external tools).
  const candidate = (() => {
    const obj = raw as Record<string, unknown>;
    if (
      obj.app === "toptal-sdr-engine" &&
      typeof obj.version === "number" &&
      obj.state &&
      typeof obj.state === "object"
    ) {
      return obj.state as Partial<AppState>;
    }
    if (Array.isArray((obj as Partial<AppState>).accounts)) {
      return obj as Partial<AppState>;
    }
    throw new Error(
      "File does not look like a Toptal SDR Engine export. Expected an envelope with { app, version, state } or a bare state with an accounts array.",
    );
  })();
  const accountsRaw = Array.isArray(candidate.accounts)
    ? candidate.accounts
    : [];
  // Run the imported state through the same migration logic used at load time
  // by stuffing it into a temporary localStorage round-trip... actually no:
  // do it inline so we don't clobber what the user already has on disk.
  // Inline mirror of loadAppState's per-account merge:
  const accounts: Account[] = accountsRaw.map((a) => {
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
    const hotlist = cleanHotlist(legacyAccountData.hotlist);
    const messagingFocus = Array.isArray(legacyAccountData.messagingFocus)
      ? legacyAccountData.messagingFocus.filter(
          (s): s is string => typeof s === "string",
        )
      : [];
    const baseProcurement = emptyProcurementEngine();
    const loadedProcurement = (legacyAccountData.procurementEngine ??
      {}) as Partial<ProcurementEngineState>;
    const baseProduct = emptyProductEngine();
    const loadedProduct = (legacyAccountData.productEngine ??
      {}) as Partial<ProductEngineState>;
    const accountData: AccountData = {
      ...emptyAccountData(),
      ...legacyAccountData,
      missions,
      hotlist,
      messagingFocus,
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
      productEngine: {
        ...baseProduct,
        ...loadedProduct,
        activeSteps: Array.isArray(loadedProduct.activeSteps)
          ? loadedProduct.activeSteps
          : [],
        completedSteps: Array.isArray(loadedProduct.completedSteps)
          ? loadedProduct.completedSteps
          : [],
        contact: {
          ...baseProduct.contact,
          ...(loadedProduct.contact ?? {}),
        },
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
      completedSteps: Array.isArray(a?.completedSteps) ? a.completedSteps : [],
      accountData,
    };
  });
  return {
    accounts,
    currentAccountId:
      typeof candidate.currentAccountId === "string"
        ? candidate.currentAccountId
        : accounts[0]?.id ?? null,
    isSidebarOpen:
      typeof candidate.isSidebarOpen === "boolean"
        ? candidate.isSidebarOpen
        : true,
    isArchivedSectionOpen:
      typeof candidate.isArchivedSectionOpen === "boolean"
        ? candidate.isArchivedSectionOpen
        : false,
    engineCollapsed: {
      software: candidate.engineCollapsed?.software ?? false,
      procurement: candidate.engineCollapsed?.procurement ?? false,
      product: candidate.engineCollapsed?.product ?? false,
    },
  };
}
