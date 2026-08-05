import { MeetingRadar } from "@/components/MeetingRadar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/profile";

// The Radar surfaces upcoming booked meetings, their invite status, and
// an AI-drafted email per prospect. We resolve the signed-in SDR's
// display name here (server-side) so generated emails can sign off with
// a real name instead of a placeholder.
export default async function MeetingRadarPage() {
  const supabase = createClient();
  const profile = await getMyProfile(supabase);
  return <MeetingRadar senderName={profile?.displayName ?? null} />;
}
