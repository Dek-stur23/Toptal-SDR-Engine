// Domain types for the metrics app.
//
// Two intentional differences from lib/types.ts in the parent SDR
// Launchpad:
//   1. IDs are `string` (Postgres uuids), not `number`. localStorage
//      generated its own numeric IDs; here the database does.
//   2. Only the entities used by Goals & Metrics + Meetings Tracker
//      exist — no accounts-data blobs, no engines, no hotlist.

// ---------- Accounts ----------

export interface Account {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string; // ISO string
}

// ---------- Meetings ----------

export type MeetingStatus = "booked" | "held" | "dead-end";

export type BookedCategory = "confirmed" | "soft";

export type ProspectResponse =
  | "no-response"
  | "accepted"
  | "declined"
  | "no-show"
  | "rescheduled"
  | "still-scheduling";

export type HeldOutcome =
  | "opportunity-identified"
  | "future-follow-up"
  | "dead-end";

export interface Meeting {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string;
  salesloftUrl: string;
  accountId: string | null;
  // ISO timestamp string. null means "no time set yet".
  scheduledFor: string | null;
  notes: string;
  status: MeetingStatus;
  createdAt: string;
  heldAt: string | null;
  deadEndedAt: string | null;
  // Storage object key: {user_id}/meetings/{meeting_id}.{ext}
  imageKey: string | null;
  prospectResponse: ProspectResponse | null;
  ese: string | null;
  heldOutcome: HeldOutcome | null;
  bookedCategory: BookedCategory | null;
  // Loaded lazily by the meeting-detail view — not on the list query.
  updates?: MeetingUpdate[];
}

export interface MeetingUpdate {
  id: string;
  meetingId: string;
  loggedAt: string; // ISO
  text: string;
  isSystem: boolean;
}

// ---------- Goals ----------

export interface QuarterlyGoals {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  dailyDialsGoal: number;
  dailyDialsBenchmark: number;
  weeklyDialsGoal: number;
  weeklyDialsBenchmark: number;
  weeklyProspectsGoal: number;
  weeklyProspectsBenchmark: number;
  weeklyMeetingsBookedGoal: number;
  weeklyMeetingsBookedBenchmark: number;
  weeklyMeetingsHeldGoal: number;
  weeklyMeetingsHeldBenchmark: number;
}

export type GoalMetricKind = "dial" | "prospect-added";

export interface GoalLogEntry {
  id: string;
  kind: GoalMetricKind;
  loggedAt: string; // ISO — when the activity happened
  count: number;
  note: string | null;
  accountId: string | null;
}

export type SavedWeekKind = "unlocked" | "manually-saved";

export interface SavedWeek {
  id: string;
  weekStart: string; // YYYY-MM-DD
  kind: SavedWeekKind;
}

// ---------- Opportunities ----------

export type OpportunitySolutionArea =
  | "staff-augmentation"
  | "professional-services";

export type OpportunityTimeline = "now" | "next-month" | "next-quarter";

export type OpportunityNextStepOwner = "SDR" | "ESE";

export type OpportunityStatus = "open" | "won-sta" | "won-job" | "lost";

export interface Opportunity {
  id: string;
  meetingId: string;
  title: string;
  pain: string;
  solutionArea: OpportunitySolutionArea | null;
  timeline: OpportunityTimeline | null;
  nextStepText: string;
  nextStepOwner: OpportunityNextStepOwner | null;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityUpdate {
  id: string;
  opportunityId: string;
  loggedAt: string;
  text: string;
  isSystem: boolean;
}

// ---------- Profile ----------

export interface Profile {
  id: string;
  displayName: string | null;
  isAdmin: boolean;
  onboardedAt: string | null;
  createdAt: string;
}

// ---------- AI usage ----------

export type AiEndpoint = "autofill" | "opportunity-next-step";

export interface AiUsageEntry {
  id: string;
  endpoint: AiEndpoint;
  tokensIn: number;
  tokensOut: number;
  estimatedCostCents: number;
  createdAt: string;
}
