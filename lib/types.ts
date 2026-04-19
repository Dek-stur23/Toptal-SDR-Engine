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

export interface WorkflowState {
  accountName: string;
  steps: Record<StepKind, StepRecord>;
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
