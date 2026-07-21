import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Opportunity,
  OpportunityNextStepOwner,
  OpportunitySolutionArea,
  OpportunityStatus,
  OpportunityTimeline,
  OpportunityUpdate,
} from "@/lib/types";

// ---- Opportunities ----

interface OpportunityRow {
  id: string;
  meeting_id: string;
  title: string;
  pain: string;
  solution_area: string | null;
  timeline: string | null;
  next_step_text: string;
  next_step_owner: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const OPP_COLS =
  "id, meeting_id, title, pain, solution_area, timeline, next_step_text, next_step_owner, status, created_at, updated_at";

function toOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    title: row.title,
    pain: row.pain,
    solutionArea: (row.solution_area as OpportunitySolutionArea | null) ?? null,
    timeline: (row.timeline as OpportunityTimeline | null) ?? null,
    nextStepText: row.next_step_text,
    nextStepOwner: (row.next_step_owner as OpportunityNextStepOwner | null) ?? null,
    status: row.status as OpportunityStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listOpportunities(
  supabase: SupabaseClient
): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(OPP_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as OpportunityRow[]).map(toOpportunity);
}

export type OpportunityDraft = Omit<
  Opportunity,
  "id" | "createdAt" | "updatedAt"
>;

export async function createOpportunity(
  supabase: SupabaseClient,
  draft: OpportunityDraft
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      meeting_id: draft.meetingId,
      title: draft.title,
      pain: draft.pain,
      solution_area: draft.solutionArea,
      timeline: draft.timeline,
      next_step_text: draft.nextStepText,
      next_step_owner: draft.nextStepOwner,
      status: draft.status,
    })
    .select(OPP_COLS)
    .single();
  if (error) throw error;
  return toOpportunity(data as OpportunityRow);
}

export async function updateOpportunity(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<OpportunityDraft, "meetingId">>
): Promise<Opportunity> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.pain !== undefined) dbPatch.pain = patch.pain;
  if (patch.solutionArea !== undefined) dbPatch.solution_area = patch.solutionArea;
  if (patch.timeline !== undefined) dbPatch.timeline = patch.timeline;
  if (patch.nextStepText !== undefined) dbPatch.next_step_text = patch.nextStepText;
  if (patch.nextStepOwner !== undefined) dbPatch.next_step_owner = patch.nextStepOwner;
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const { data, error } = await supabase
    .from("opportunities")
    .update(dbPatch)
    .eq("id", id)
    .select(OPP_COLS)
    .single();
  if (error) throw error;
  return toOpportunity(data as OpportunityRow);
}

export async function deleteOpportunity(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("opportunities").delete().eq("id", id);
  if (error) throw error;
}

// ---- Opportunity updates ----

interface OpportunityUpdateRow {
  id: string;
  opportunity_id: string;
  logged_at: string;
  text: string;
  is_system: boolean;
}

function toOpportunityUpdate(row: OpportunityUpdateRow): OpportunityUpdate {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    loggedAt: row.logged_at,
    text: row.text,
    isSystem: row.is_system,
  };
}

// Single-shot loader like listAllMeetingUpdates — grouped in the
// client by opportunity_id.
export async function listAllOpportunityUpdates(
  supabase: SupabaseClient
): Promise<OpportunityUpdate[]> {
  const { data, error } = await supabase
    .from("opportunity_updates")
    .select("id, opportunity_id, logged_at, text, is_system")
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return (data as OpportunityUpdateRow[]).map(toOpportunityUpdate);
}

export async function addOpportunityUpdate(
  supabase: SupabaseClient,
  opportunityId: string,
  text: string,
  opts: { system?: boolean } = {}
): Promise<OpportunityUpdate> {
  const { data, error } = await supabase
    .from("opportunity_updates")
    .insert({
      opportunity_id: opportunityId,
      text,
      is_system: opts.system ?? false,
    })
    .select("id, opportunity_id, logged_at, text, is_system")
    .single();
  if (error) throw error;
  return toOpportunityUpdate(data as OpportunityUpdateRow);
}

export async function deleteOpportunityUpdate(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("opportunity_updates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
