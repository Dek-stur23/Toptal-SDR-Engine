export type StepStatus = "not_started" | "in_progress" | "complete";

export type StepKind =
  | "account_research"
  | "stakeholder_mapping"
  | "pain_value_mapping"
  | "outreach_strategy"
  | "message_crafting"
  | "launch_track";

export interface StepDefinition {
  id: StepKind;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  estMinutes: number;
  storageKey: string;
}

export interface StepRecord {
  status: StepStatus;
  updatedAt: string | null;
  data: Record<string, unknown>;
}

export type AccountStatus = "active" | "archived";

export interface Account {
  id: string;
  name: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  steps: Record<StepKind, StepRecord>;
}

export interface AppState {
  accounts: Account[];
  activeAccountId: string | null;
  sidebarCollapsed: boolean;
}

export interface AccountResearchData {
  projectUrl: string;
  companyOverview: string;
  industryContext: string;
  recentSignals: string;
  techStack: string;
  toptalFitHypothesis: string;
  rawNotes: string;
}
