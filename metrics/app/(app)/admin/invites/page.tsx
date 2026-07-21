import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/profile";
import { AdminInvites } from "@/components/AdminInvites";

export default async function AdminInvitesPage() {
  const supabase = createClient();
  const profile = await getMyProfile(supabase);
  if (!profile?.isAdmin) {
    redirect("/goals");
  }
  return <AdminInvites />;
}
