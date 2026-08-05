import { MeetingsTracker } from "@/components/MeetingsTracker";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/profile";

// Resolve the signed-in SDR's display name server-side so the Radar
// view's generated emails can sign off with a real name.
export default async function MeetingsPage() {
  const supabase = createClient();
  const profile = await getMyProfile(supabase);
  return <MeetingsTracker senderName={profile?.displayName ?? null} />;
}
