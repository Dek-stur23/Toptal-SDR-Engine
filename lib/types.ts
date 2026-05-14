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
  isArchivedSectionOpen: boolean;
  engineCollapsed: { software: boolean; procurement: boolean };
}
