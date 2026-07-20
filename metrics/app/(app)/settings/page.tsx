import { redirect } from "next/navigation";
import { Settings } from "@/components/Settings";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/profile";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getMyProfile(supabase);
  if (!profile) redirect("/login");
  return <Settings profile={profile} email={user.email ?? ""} />;
}
