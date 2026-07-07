export type AccountStatus =
  | "Signed Account - Active"
  | "Signed Account - Dormant"
  | "Unsigned Account"
  | "";

export interface KeyBuyer {
  department: string;
  roles: string[];
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface AiResearch {
  corporateStructure: string;
  recentNews: string;
  keyBuyers: KeyBuyer[];
  prioritiesAndChallenges: string;
  roadmap: string;
  pursuitStrategies: string;
  swotAnalysis: SwotAnalysis;
  otherInfo: string;
}

export interface InitiativeOrChallenge {
  name: string;
  primarySource: string;
  supportingEvidence: string;
  analysis: string;
  toptalHook: string;
}

export interface InitiativeResearch {
  metadata: string;
  initiatives: InitiativeOrChallenge[];
  challenges: InitiativeOrChallenge[];
}

export type ProductCategory =
  | "customer-facing"
  | "platform"
  | "recent-launch"
  | "in-development";

export type ProductStatus =
  | "live"
  | "announced"
  | "in-development"
  | "deprecated"
  | "unknown";

export interface ProductMapEntry {
  name: string;
  category: ProductCategory;
  description: string;
  status: ProductStatus;
  primarySource: string;
  evidenceSummary: string;
}

export interface ProductMap {
  metadata: string;
  entries: ProductMapEntry[];
}

export interface ProcurementTarget {
  name: string;
  title: string;
  personaBucket: string;
  reason: string;
}

export interface FLetter {
  trigger: string;
  connection: string;
  cta: string;
}

export interface ProcurementStrategy {
  orgStructureInsights: string;
  techStackPrediction: string;
  entryStrategy: string;
  topTargets: ProcurementTarget[];
  theHook: string;
  draftFLetter: FLetter;
}

export interface CadenceEmail {
  subject: string;
  body: string;
}

export interface ProcurementCadence {
  email1: CadenceEmail;
  email2: CadenceEmail;
  email3: CadenceEmail;
}

export interface PreviousContact {
  id: number;
  name: string;
  title: string;
  salesforceLink: string;
  notes: string;
  dateAdded: string;
  contacted: boolean;
}

export interface TeamLink {
  id: number;
  name: string;
  personType: string;
  connection: string;
  notes: string;
  date: string;
  contacted: boolean;
}

export interface MissionTask {
  id: string;
  label: string;
  completed: boolean;
}

export interface Mission {
  id: number;
  name: string;
  type: string;
  details: string;
  links: string;
  dateLaunched: string;
  completed: boolean;
  resultsBriefing: string;
  tasks: MissionTask[];
}

export interface ActivityLog {
  id: number;
  type: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
  notes: string;
  date: string;
  message?: string;
}

export interface MessagingLog {
  id: number;
  contactName: string;
  date: string;
  linkedin: boolean;
  email: boolean;
  preview: string;
}

export interface EseMeeting {
  id: number;
  date: string;
  account: string;
  notes: string;
  loggedAt: string;
}

export interface KeyEvent {
  headline: string;
  details: string;
  source: string;
}

export interface RecentNewsData {
  executiveSummary: string;
  keyEvents: KeyEvent[];
  toptalOpportunity: string;
}

export interface RecentNewsResult {
  company: string;
  date: string;
  data: RecentNewsData;
}

export interface IcpEvidence {
  confirmedProject: string;
  verifiedSource: string;
}

export interface IcpInference {
  inferredPriority: string;
  reasoning: string;
}

export interface IcpIntelData {
  executiveSummary: { primaryFocus: string; likelyKPIs: string };
  evidenceBackedInvolvement: IcpEvidence[];
  logicalInferences: IcpInference[];
  strategicPriorities: string[];
  recommendedTalkingPoints: string[];
}

export interface IcpIntelResult {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  liText: string;
  result: IcpIntelData;
  date: string;
}

export type ToolId =
  | "news"
  | "icpIntel"
  | "messaging"
  | "log"
  | "eseMeeting"
  | "hotlist";

export type HotlistPriority = "high" | "medium" | "low";

export type HotlistChannel =
  | "Email"
  | "LinkedIn"
  | "Phone"
  | "Meeting"
  | "Other";

export interface HotlistMessage {
  id: number;
  channel: HotlistChannel;
  subject: string;
  body: string;
  date: string;
  response: string;
}

// Persisted compose draft. The Hotlist compose form autosaves into this
// so an in-progress message survives account switch, browser refresh,
// or any unmount before the user clicks "Save Message".
export interface HotlistMessageDraft {
  channel: HotlistChannel;
  subject: string;
  body: string;
  response: string;
}

export interface HotlistProspect {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
  priority: HotlistPriority;
  notes: string;
  dateAdded: string;
  messages: HotlistMessage[];
  image: string | null;
  // Optional autosaved compose draft. Cleared on successful Save Message.
  pendingDraft?: HotlistMessageDraft;
}

export interface SoftwareEngineContact {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  liText: string;
  liImage: string | null;
}

export interface StackBuckets {
  backend: string;
  frontend: string;
  data: string;
  devops: string;
  ai: string;
}

export interface SoftwareEngineState {
  activeSteps: number[];
  completedSteps: number[];
  stack: StackBuckets;
  productInput: string;
  featureMap: string;
  contact: SoftwareEngineContact;
  technicalAuditor: string;
}

export type ProcurementFunction =
  | "sourcing"
  | "category"
  | "vendor-mgmt"
  | "ta-ops"
  | "indirect"
  | "it-procurement"
  | "other";

export type ProcurementSeniority =
  | "executive"
  | "director"
  | "manager"
  | "ic"
  | "unknown";

export interface ProcurementContact {
  id: string;
  name: string;
  title: string;
  function: ProcurementFunction;
  seniority: ProcurementSeniority;
  ownsHint: string;
}

export interface LeaderActivity {
  headline: string;
  source: string;
}

export interface LeaderProfile {
  team: string;
  scope: string;
  reportingChain: string;
  recentActivity: LeaderActivity[];
}

export interface PriorityItem {
  priority: string;
  reasoning: string;
  evidenceSource: string;
}

export interface ProcurementEngineState {
  activeSteps: number[];
  completedSteps: number[];
  contactMap: ProcurementContact[];
  selectedContactId: string | null;
  leaderImage: string | null;
  leaderProfile: LeaderProfile | null;
  priorities: PriorityItem[];
  selectedPriorityIndex: number | null;
  craftedMessage: string;
}

export interface ProductEngineContact {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
  image: string | null;
}

export interface ProductEngineState {
  activeSteps: number[];
  completedSteps: number[];
  selectedProduct: string;
  analysis: string;
  expertProfile: string;
  contact: ProductEngineContact;
  craftedMessage: string;
}

export interface AccountData {
  accountStatus: AccountStatus;
  companyName: string;
  accountContextNotes: string;
  procurementContacts: string;
  procurementStrategy: ProcurementStrategy | null;
  procurementCadence: ProcurementCadence | null;
  messagingLiText: string;
  messagingLiImage: string | null;
  messagingContext: string;
  messagingContactName: string;
  messagingFocus: string[];
  generatedMessaging: string;
  messagingLogs: MessagingLog[];
  previousContacts: PreviousContact[];
  teamLinks: TeamLink[];
  missions: Mission[];
  eseMeetings: EseMeeting[];
  activityLogs: ActivityLog[];
  hotlist: HotlistProspect[];
  recentNewsResult: RecentNewsResult | null;
  icpIntelResult: IcpIntelResult | null;
  aiResearch: AiResearch | null;
  initiativeResearch: InitiativeResearch | null;
  productMap: ProductMap | null;
  softwareEngine: SoftwareEngineState;
  procurementEngine: ProcurementEngineState;
  productEngine: ProductEngineState;
}

export interface Account {
  id: string;
  createdAt: number;
  name: string;
  isArchived: boolean;
  activeSteps: number[];
  activeTool: ToolId | null;
  completedSteps: number[];
  accountData: AccountData;
}

export interface AppState {
  accounts: Account[];
  currentAccountId: string | null;
  isSidebarOpen: boolean;
  isAccountsSectionOpen: boolean;
  isArchivedSectionOpen: boolean;
  isMeetingsHeldSectionOpen: boolean;
  engineCollapsed: {
    software: boolean;
    procurement: boolean;
    product: boolean;
  };
  currentView: AppView;
  goals: UserGoalsState;
  meetings: Meeting[];
}

export type AppView = "account" | "goals" | "meetings";

// ============================================================
// Meetings Tracker — booked/held meetings, account-agnostic.
// ============================================================

export type MeetingStatus = "booked" | "held";

// Whether the prospect has replied to the booked meeting invite. Only
// meaningful while status === "booked"; the field is preserved on held
// meetings for history.
export type ProspectResponse = "no-response" | "accepted" | "declined";

export interface Meeting {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string;
  // Optional Account.id link. If empty/missing the meeting is "unlinked"
  // and the account column just renders "-".
  accountId?: string;
  // ISO datetime-local string, e.g. "2026-11-14T14:30". Empty string
  // means "no time set yet".
  scheduledFor: string;
  notes: string;
  status: MeetingStatus;
  createdAt: number;    // ms epoch
  heldAt?: number;      // ms epoch, populated on convert-to-held
  // Opaque image ref (idb:<uuid> or legacy inline data: URL). Used for
  // the LinkedIn screenshot uploaded in the modal.
  image?: string | null;
  // Prospect's response to the booked invite. Defaults to "no-response".
  prospectResponse?: ProspectResponse;
}

// ============================================================
// Goals & Benchmarks — account-agnostic tracking of dials and
// new-prospects-added, with per-quarter goal targets and per-week
// cumulative archives.
// ============================================================

export interface QuarterlyGoals {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  dailyDialsGoal: number;
  dailyDialsBenchmark: number;
  weeklyDialsGoal: number;
  weeklyDialsBenchmark: number;
  weeklyProspectsGoal: number;
  weeklyProspectsBenchmark: number;
}

export type GoalMetricKind = "dial" | "prospect-added";

export interface GoalLogEntry {
  id: number;
  kind: GoalMetricKind;
  timestamp: number; // ms epoch — sole ordering key
  count: number;     // batch-friendly (1, or 5, etc.)
  note?: string;
  // Optional Account.id link. Used mainly on "prospect-added" logs so the
  // weekly archive can attribute new prospects to the account they came
  // from. Never affects rollups or chart bucketing.
  accountId?: string;
}

export interface UserGoalsState {
  quarterly: QuarterlyGoals[];
  logs: GoalLogEntry[];
  // Week-start (YYYY-MM-DD, ISO Monday) dates the user has explicitly
  // unlocked for editing. Past weeks are locked by default; entries in
  // this list are the exceptions.
  unlockedWeekStarts: string[];
  // Week-start dates the user clicked "Save week" on before the week
  // ended naturally. Locks the week just like a past week, and the
  // Unlock control still works to reopen it.
  manuallySavedWeekStarts: string[];
}
