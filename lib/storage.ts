"use client";

import type {
  Account,
  AccountData,
  AppState,
  AppView,
  GoalLogEntry,
  HotlistChannel,
  HotlistMessage,
  HotlistPriority,
  HotlistProspect,
  Meeting,
  MeetingStatus,
  QuarterlyGoals,
  UserGoalsState,
} from "./types";
import type {
  ProcurementEngineState,
  ProductEngineState,
  SoftwareEngineState,
} from "./types";
import { emptyGoalsState } from "./goals";
import { genId } from "./ids";
import {
  inlineFromIdb,
  isIdbRef,
  isInlineDataUrl,
  migrateInlineToIdb,
  putImage,
} from "./imageStore";

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
    isAccountsSectionOpen: true,
    isArchivedSectionOpen: false,
    isMeetingsHeldSectionOpen: true,
    engineCollapsed: { software: false, procurement: false, product: false },
    currentView: "account",
    goals: emptyGoalsState(),
    meetings: [],
    meetingsView: "list",
  };
}

function cleanMeetings(raw: unknown): Meeting[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is Meeting =>
        !!m &&
        typeof m === "object" &&
        typeof (m as Meeting).id === "number" &&
        Number.isFinite((m as Meeting).id) &&
        typeof (m as Meeting).createdAt === "number",
    )
    .map((m): Meeting => {
      const status: MeetingStatus =
        m.status === "held" ? "held" : "booked";
      const clean: Meeting = {
        id: m.id,
        firstName: typeof m.firstName === "string" ? m.firstName : "",
        lastName: typeof m.lastName === "string" ? m.lastName : "",
        title: typeof m.title === "string" ? m.title : "",
        linkedinUrl: typeof m.linkedinUrl === "string" ? m.linkedinUrl : "",
        scheduledFor:
          typeof m.scheduledFor === "string" ? m.scheduledFor : "",
        notes: typeof m.notes === "string" ? m.notes : "",
        status,
        createdAt: m.createdAt,
      };
      if (typeof m.accountId === "string" && m.accountId)
        clean.accountId = m.accountId;
      if (
        status === "held" &&
        typeof m.heldAt === "number" &&
        Number.isFinite(m.heldAt)
      )
        clean.heldAt = m.heldAt;
      if (typeof m.image === "string" && m.image) clean.image = m.image;
      if (
        m.prospectResponse === "accepted" ||
        m.prospectResponse === "declined" ||
        m.prospectResponse === "no-response" ||
        m.prospectResponse === "no-show"
      ) {
        clean.prospectResponse = m.prospectResponse;
      }
      if (typeof m.ese === "string" && m.ese.trim()) clean.ese = m.ese.trim();
      if (
        m.heldOutcome === "opportunity-identified" ||
        m.heldOutcome === "future-follow-up" ||
        m.heldOutcome === "dead-end"
      ) {
        clean.heldOutcome = m.heldOutcome;
      }
      return clean;
    });
}

function cleanGoalsState(raw: unknown): UserGoalsState {
  if (!raw || typeof raw !== "object") return emptyGoalsState();
  const g = raw as Partial<UserGoalsState>;
  const asNum = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
  const quarterly = Array.isArray(g.quarterly)
    ? g.quarterly
        .filter(
          (q): q is QuarterlyGoals =>
            !!q &&
            typeof q === "object" &&
            typeof (q as QuarterlyGoals).year === "number" &&
            typeof (q as QuarterlyGoals).quarter === "number",
        )
        .map((q): QuarterlyGoals => ({
          year: q.year,
          quarter: q.quarter,
          dailyDialsGoal: asNum(q.dailyDialsGoal),
          dailyDialsBenchmark: asNum(q.dailyDialsBenchmark),
          weeklyDialsGoal: asNum(q.weeklyDialsGoal),
          weeklyDialsBenchmark: asNum(q.weeklyDialsBenchmark),
          weeklyProspectsGoal: asNum(q.weeklyProspectsGoal),
          weeklyProspectsBenchmark: asNum(q.weeklyProspectsBenchmark),
          weeklyMeetingsBookedGoal: asNum(q.weeklyMeetingsBookedGoal),
          weeklyMeetingsBookedBenchmark: asNum(
            q.weeklyMeetingsBookedBenchmark,
          ),
          weeklyMeetingsHeldGoal: asNum(q.weeklyMeetingsHeldGoal),
          weeklyMeetingsHeldBenchmark: asNum(q.weeklyMeetingsHeldBenchmark),
        }))
    : [];
  const logs = Array.isArray(g.logs)
    ? g.logs
        .filter(
          (l): l is GoalLogEntry =>
            !!l &&
            typeof l === "object" &&
            typeof (l as GoalLogEntry).id === "number" &&
            typeof (l as GoalLogEntry).timestamp === "number" &&
            ((l as GoalLogEntry).kind === "dial" ||
              (l as GoalLogEntry).kind === "prospect-added"),
        )
        .map((l): GoalLogEntry => {
          const clean: GoalLogEntry = {
            id: l.id,
            kind: l.kind,
            timestamp: l.timestamp,
            count: typeof l.count === "number" && l.count > 0 ? l.count : 1,
          };
          if (typeof l.note === "string" && l.note.trim()) clean.note = l.note;
          if (typeof l.accountId === "string" && l.accountId)
            clean.accountId = l.accountId;
          return clean;
        })
    : [];
  const unlockedWeekStarts = Array.isArray(g.unlockedWeekStarts)
    ? g.unlockedWeekStarts.filter((s): s is string => typeof s === "string")
    : [];
  const manuallySavedWeekStarts = Array.isArray(g.manuallySavedWeekStarts)
    ? g.manuallySavedWeekStarts.filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  return { quarterly, logs, unlockedWeekStarts, manuallySavedWeekStarts };
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
      isAccountsSectionOpen:
        typeof parsed.isAccountsSectionOpen === "boolean"
          ? parsed.isAccountsSectionOpen
          : true,
      isArchivedSectionOpen: parsed.isArchivedSectionOpen ?? false,
      isMeetingsHeldSectionOpen:
        typeof parsed.isMeetingsHeldSectionOpen === "boolean"
          ? parsed.isMeetingsHeldSectionOpen
          : true,
      engineCollapsed: {
        software: parsed.engineCollapsed?.software ?? false,
        procurement: parsed.engineCollapsed?.procurement ?? false,
        product: parsed.engineCollapsed?.product ?? false,
      },
      currentView:
        parsed.currentView === "goals"
          ? "goals"
          : parsed.currentView === "meetings"
            ? "meetings"
            : "account",
      goals: cleanGoalsState(parsed.goals),
      meetings: cleanMeetings(parsed.meetings),
      meetingsView: parsed.meetingsView === "calendar" ? "calendar" : "list",
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

function notifySaveRecovered(detail: { droppedBackups: number }) {
  console.warn(
    `Save recovered by dropping ${detail.droppedBackups} backup slot(s) to free space.`,
  );
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("toptal-sdr-engine:save-recovered", { detail }),
      );
    } catch {
      // ignore
    }
  }
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  if (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED"
  ) {
    return true;
  }
  const msg = (err as { message?: string }).message ?? "";
  return /quota/i.test(msg) || /exceeded/i.test(msg);
}

// Clears the OLDEST backup slot (the highest occupied index). Returns true
// if a slot was actually cleared, false if no backups exist.
function dropOldestBackup(): boolean {
  if (typeof window === "undefined") return false;
  for (let i = BACKUP_SLOTS - 1; i >= 0; i--) {
    const key = `${BACKUP_KEY_PREFIX}${i}`;
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        return true;
      }
    } catch {
      // Try the next one if this slot read failed
    }
  }
  return false;
}

export function clearAllBackups(): number {
  if (typeof window === "undefined") return 0;
  let cleared = 0;
  for (let i = 0; i < BACKUP_SLOTS; i++) {
    const key = `${BACKUP_KEY_PREFIX}${i}`;
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        cleared++;
      }
    } catch {
      // skip
    }
  }
  return cleared;
}

// Best-effort estimate of total localStorage bytes used by this app.
// Returns undefined if storage is unavailable.
export function estimateAppStorageBytes(): number | undefined {
  if (typeof window === "undefined") return undefined;
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === ROOT_KEY || k.startsWith(BACKUP_KEY_PREFIX)) {
        const v = window.localStorage.getItem(k) ?? "";
        // Approx: each char in a JS string is 2 bytes (UTF-16) in memory.
        // localStorage quotas are also typically measured in UTF-16 code units.
        total += (k.length + v.length) * 2;
      }
    }
  } catch {
    return undefined;
  }
  return total;
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
  // Try the primary write. If we hit a quota error, free space one backup
  // slot at a time (oldest first) and retry. Backups exist precisely so we
  // have something to sacrifice when storage gets tight — losing them is
  // strictly preferable to losing the user's actual work.
  let droppedBackups = 0;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < BACKUP_SLOTS + 1; attempt++) {
    try {
      window.localStorage.setItem(ROOT_KEY, serialized);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) break;
      // Quota: drop one backup and try again.
      if (!dropOldestBackup()) break;
      droppedBackups++;
    }
  }
  if (lastErr !== null) {
    notifySaveFailure(lastErr);
    return;
  }
  if (droppedBackups > 0) {
    notifySaveRecovered({ droppedBackups });
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
    isAccountsSectionOpen:
      typeof candidate.isAccountsSectionOpen === "boolean"
        ? candidate.isAccountsSectionOpen
        : true,
    isArchivedSectionOpen:
      typeof candidate.isArchivedSectionOpen === "boolean"
        ? candidate.isArchivedSectionOpen
        : false,
    isMeetingsHeldSectionOpen:
      typeof candidate.isMeetingsHeldSectionOpen === "boolean"
        ? candidate.isMeetingsHeldSectionOpen
        : true,
    engineCollapsed: {
      software: candidate.engineCollapsed?.software ?? false,
      procurement: candidate.engineCollapsed?.procurement ?? false,
      product: candidate.engineCollapsed?.product ?? false,
    },
    currentView:
      candidate.currentView === "goals"
        ? "goals"
        : candidate.currentView === "meetings"
          ? "meetings"
          : "account",
    goals: cleanGoalsState(candidate.goals),
    meetings: cleanMeetings(candidate.meetings),
    meetingsView: candidate.meetingsView === "calendar" ? "calendar" : "list",
  };
}

// ============================================================
// Image migration: inline base64 <-> IDB refs
// ============================================================
//
// On boot we walk every image field in app state and move any inline
// base64 data URLs into IndexedDB, replacing them with `idb:<id>` refs.
// This frees up localStorage for the small text-only state, while images
// live in IDB's much larger quota.
//
// On export we do the inverse: walk every ref and inline the bytes, so
// the exported JSON file is self-contained and portable.
//
// On import we walk inline data URLs and put them into IDB, returning a
// state full of refs ready for localStorage.

async function migrateImageField(
  current: string | null | undefined,
): Promise<{ next: string | null; changed: boolean }> {
  if (!current) return { next: null, changed: false };
  if (isIdbRef(current)) return { next: current, changed: false };
  if (!isInlineDataUrl(current)) return { next: current, changed: false };
  const next = await migrateInlineToIdb(current);
  return { next, changed: next !== current };
}

// Walks `state` and migrates every inline base64 image to IDB. Returns
// true if any field was changed so the caller can re-save.
export async function migrateInlineImagesInState(
  state: AppState,
): Promise<boolean> {
  let any = false;
  for (const account of state.accounts) {
    const ad = account.accountData;
    if (!ad) continue;
    if (Array.isArray(ad.hotlist)) {
      for (const p of ad.hotlist) {
        const r = await migrateImageField(p.image);
        if (r.changed) {
          p.image = r.next;
          any = true;
        }
      }
    }
    if (ad.softwareEngine?.contact) {
      const r = await migrateImageField(ad.softwareEngine.contact.liImage);
      if (r.changed) {
        ad.softwareEngine.contact.liImage = r.next;
        any = true;
      }
    }
    if (ad.procurementEngine) {
      const r = await migrateImageField(ad.procurementEngine.leaderImage);
      if (r.changed) {
        ad.procurementEngine.leaderImage = r.next;
        any = true;
      }
    }
    if (ad.productEngine?.contact) {
      const r = await migrateImageField(ad.productEngine.contact.image);
      if (r.changed) {
        ad.productEngine.contact.image = r.next;
        any = true;
      }
    }
    const r = await migrateImageField(ad.messagingLiImage);
    if (r.changed) {
      ad.messagingLiImage = r.next;
      any = true;
    }
  }
  if (Array.isArray(state.meetings)) {
    for (const m of state.meetings) {
      const r = await migrateImageField(m.image);
      if (r.changed) {
        m.image = r.next;
        any = true;
      }
    }
  }
  return any;
}

async function inlineImageField(
  ref: string | null | undefined,
): Promise<string | null> {
  return inlineFromIdb(ref);
}

// Returns a deep clone of `state` with every IDB ref expanded back into
// an inline data URL. Used by the export path so the resulting JSON
// file is portable.
async function inlineImagesInState(state: AppState): Promise<AppState> {
  const cloned = JSON.parse(JSON.stringify(state)) as AppState;
  for (const account of cloned.accounts) {
    const ad = account.accountData;
    if (!ad) continue;
    if (Array.isArray(ad.hotlist)) {
      for (const p of ad.hotlist) {
        p.image = await inlineImageField(p.image);
      }
    }
    if (ad.softwareEngine?.contact) {
      ad.softwareEngine.contact.liImage = await inlineImageField(
        ad.softwareEngine.contact.liImage,
      );
    }
    if (ad.procurementEngine) {
      ad.procurementEngine.leaderImage = await inlineImageField(
        ad.procurementEngine.leaderImage,
      );
    }
    if (ad.productEngine?.contact) {
      ad.productEngine.contact.image = await inlineImageField(
        ad.productEngine.contact.image,
      );
    }
    ad.messagingLiImage = await inlineImageField(ad.messagingLiImage);
  }
  if (Array.isArray(cloned.meetings)) {
    for (const m of cloned.meetings) {
      m.image = await inlineImageField(m.image);
    }
  }
  return cloned;
}

// Async export: inline all images first, then serialize.
export async function exportAppStateJsonAsync(
  state: AppState,
): Promise<string> {
  const inlined = await inlineImagesInState(state);
  return exportAppStateJson(inlined);
}

// Async import: parse, then walk every image field and put inline data
// URLs into IDB. The returned state holds refs and is safe to drop
// straight into localStorage.
export async function parseImportedAppStateAsync(
  json: string,
): Promise<AppState> {
  const state = parseImportedAppState(json);
  for (const account of state.accounts) {
    const ad = account.accountData;
    if (!ad) continue;
    if (Array.isArray(ad.hotlist)) {
      for (const p of ad.hotlist) {
        if (p.image && isInlineDataUrl(p.image)) {
          try {
            p.image = await putImage(p.image);
          } catch {
            // keep inline if put fails — better that than dropping the image
          }
        }
      }
    }
    if (ad.softwareEngine?.contact && isInlineDataUrl(ad.softwareEngine.contact.liImage)) {
      try {
        ad.softwareEngine.contact.liImage = await putImage(
          ad.softwareEngine.contact.liImage as string,
        );
      } catch {
        // keep inline
      }
    }
    if (ad.procurementEngine && isInlineDataUrl(ad.procurementEngine.leaderImage)) {
      try {
        ad.procurementEngine.leaderImage = await putImage(
          ad.procurementEngine.leaderImage as string,
        );
      } catch {
        // keep inline
      }
    }
    if (ad.productEngine?.contact && isInlineDataUrl(ad.productEngine.contact.image)) {
      try {
        ad.productEngine.contact.image = await putImage(
          ad.productEngine.contact.image as string,
        );
      } catch {
        // keep inline
      }
    }
    if (isInlineDataUrl(ad.messagingLiImage)) {
      try {
        ad.messagingLiImage = await putImage(ad.messagingLiImage as string);
      } catch {
        // keep inline
      }
    }
  }
  if (Array.isArray(state.meetings)) {
    for (const m of state.meetings) {
      if (m.image && isInlineDataUrl(m.image)) {
        try {
          m.image = await putImage(m.image);
        } catch {
          // keep inline
        }
      }
    }
  }
  return state;
}
