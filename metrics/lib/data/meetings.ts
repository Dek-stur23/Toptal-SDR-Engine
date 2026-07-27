import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookedCategory,
  HeldOutcome,
  Meeting,
  MeetingStatus,
  MeetingUpdate,
  ProspectResponse,
} from "@/lib/types";

interface MeetingRow {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  linkedin_url: string;
  salesloft_url: string;
  account_id: string | null;
  scheduled_for: string | null;
  notes: string;
  status: string;
  created_at: string;
  held_at: string | null;
  dead_ended_at: string | null;
  image_key: string | null;
  prospect_response: string | null;
  ese: string | null;
  held_outcome: string | null;
  booked_category: string | null;
}

interface MeetingUpdateRow {
  id: string;
  meeting_id: string;
  logged_at: string;
  text: string;
  is_system: boolean;
}

const MEETING_COLS =
  "id, first_name, last_name, title, linkedin_url, salesloft_url, account_id, scheduled_for, notes, status, created_at, held_at, dead_ended_at, image_key, prospect_response, ese, held_outcome, booked_category";

function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    title: row.title,
    linkedinUrl: row.linkedin_url,
    salesloftUrl: row.salesloft_url ?? "",
    accountId: row.account_id,
    scheduledFor: row.scheduled_for,
    notes: row.notes,
    status: row.status as MeetingStatus,
    createdAt: row.created_at,
    heldAt: row.held_at,
    deadEndedAt: row.dead_ended_at,
    imageKey: row.image_key,
    prospectResponse: (row.prospect_response as ProspectResponse | null) ?? null,
    ese: row.ese,
    heldOutcome: (row.held_outcome as HeldOutcome | null) ?? null,
    bookedCategory: (row.booked_category as BookedCategory | null) ?? null,
  };
}

function toMeetingUpdate(row: MeetingUpdateRow): MeetingUpdate {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    loggedAt: row.logged_at,
    text: row.text,
    isSystem: row.is_system,
  };
}

// ---------- Meetings ----------

export async function listMeetings(supabase: SupabaseClient): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as MeetingRow[]).map(toMeeting);
}

export type MeetingDraft = Omit<
  Meeting,
  "id" | "createdAt" | "heldAt" | "deadEndedAt" | "updates"
>;

export async function createMeeting(
  supabase: SupabaseClient,
  draft: MeetingDraft
): Promise<Meeting> {
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      first_name: draft.firstName,
      last_name: draft.lastName,
      title: draft.title,
      linkedin_url: draft.linkedinUrl,
      salesloft_url: draft.salesloftUrl,
      account_id: draft.accountId,
      scheduled_for: draft.scheduledFor,
      notes: draft.notes,
      status: draft.status,
      image_key: draft.imageKey,
      prospect_response: draft.prospectResponse,
      ese: draft.ese,
      held_outcome: draft.heldOutcome,
      booked_category: draft.bookedCategory,
    })
    .select(MEETING_COLS)
    .single();
  if (error) throw error;
  return toMeeting(data as MeetingRow);
}

// Partial update. Only the fields present in `patch` are written; the
// mapper walks a small dispatch table so a partial with { notes: "x" }
// doesn't blank out every other column.
export async function updateMeeting(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<MeetingDraft & { heldAt: string | null; deadEndedAt: string | null }>
): Promise<Meeting> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.firstName !== undefined) dbPatch.first_name = patch.firstName;
  if (patch.lastName !== undefined) dbPatch.last_name = patch.lastName;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.linkedinUrl !== undefined) dbPatch.linkedin_url = patch.linkedinUrl;
  if (patch.salesloftUrl !== undefined) dbPatch.salesloft_url = patch.salesloftUrl;
  if (patch.accountId !== undefined) dbPatch.account_id = patch.accountId;
  if (patch.scheduledFor !== undefined) dbPatch.scheduled_for = patch.scheduledFor;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.imageKey !== undefined) dbPatch.image_key = patch.imageKey;
  if (patch.prospectResponse !== undefined) dbPatch.prospect_response = patch.prospectResponse;
  if (patch.ese !== undefined) dbPatch.ese = patch.ese;
  if (patch.heldOutcome !== undefined) dbPatch.held_outcome = patch.heldOutcome;
  if (patch.bookedCategory !== undefined) dbPatch.booked_category = patch.bookedCategory;
  if (patch.heldAt !== undefined) dbPatch.held_at = patch.heldAt;
  if (patch.deadEndedAt !== undefined) dbPatch.dead_ended_at = patch.deadEndedAt;

  const { data, error } = await supabase
    .from("meetings")
    .update(dbPatch)
    .eq("id", id)
    .select(MEETING_COLS)
    .single();
  if (error) throw error;
  return toMeeting(data as MeetingRow);
}

export async function deleteMeeting(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}

// Quick-log a meeting from the Goals & Metrics page without the full
// prospect-details workflow. Writes a minimal row keyed to the
// caller-supplied timestamp so the goal-metrics counts land in the
// right period even for backlogged entries.
//
// - Booked: sets scheduled_for + created_at to `when`, held_at null.
//   Booked count buckets by created_at.
// - Held:   sets scheduled_for + created_at + held_at all to `when`.
//   Held count buckets by held_at.
export async function quickLogMeeting(
  supabase: SupabaseClient,
  opts: { status: "booked" | "held"; accountId: string | null; when: string }
): Promise<Meeting> {
  const { status, accountId, when } = opts;
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      first_name: "",
      last_name: "",
      title: "",
      linkedin_url: "",
      salesloft_url: "",
      account_id: accountId,
      scheduled_for: when,
      notes: "",
      status,
      created_at: when,
      held_at: status === "held" ? when : null,
      dead_ended_at: null,
      image_key: null,
      prospect_response: null,
      ese: null,
      held_outcome: null,
      booked_category: null,
    })
    .select(MEETING_COLS)
    .single();
  if (error) throw error;
  return toMeeting(data as MeetingRow);
}

// ---------- Meeting updates ----------

export async function listMeetingUpdates(
  supabase: SupabaseClient,
  meetingId: string
): Promise<MeetingUpdate[]> {
  const { data, error } = await supabase
    .from("meeting_updates")
    .select("id, meeting_id, logged_at, text, is_system")
    .eq("meeting_id", meetingId)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return (data as MeetingUpdateRow[]).map(toMeetingUpdate);
}

export async function addMeetingUpdate(
  supabase: SupabaseClient,
  meetingId: string,
  text: string,
  opts: { system?: boolean } = {}
): Promise<MeetingUpdate> {
  const { data, error } = await supabase
    .from("meeting_updates")
    .insert({
      meeting_id: meetingId,
      text,
      is_system: opts.system ?? false,
    })
    .select("id, meeting_id, logged_at, text, is_system")
    .single();
  if (error) throw error;
  return toMeetingUpdate(data as MeetingUpdateRow);
}

export async function deleteMeetingUpdate(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("meeting_updates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// One-shot loader for every update row the caller can see. RLS
// filters to updates whose parent meeting is owned by the caller, so
// this stays scoped without any client-side check. Callers group by
// meetingId to render inline with each meeting card.
export async function listAllMeetingUpdates(
  supabase: SupabaseClient
): Promise<MeetingUpdate[]> {
  const { data, error } = await supabase
    .from("meeting_updates")
    .select("id, meeting_id, logged_at, text, is_system")
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return (data as MeetingUpdateRow[]).map(toMeetingUpdate);
}
