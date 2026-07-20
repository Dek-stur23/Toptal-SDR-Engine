import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/profile";

// Wraps every authenticated page. Middleware already redirected
// signed-out users to /login, but we still fetch the user here so the
// shell can render their name and gate admin nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getMyProfile(supabase);

  return (
    <AppShell profile={profile} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
