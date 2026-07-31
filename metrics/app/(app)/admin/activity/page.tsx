import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMyProfile } from "@/lib/data/profile";
import { buildActivityReport } from "@/lib/data/activityReport";
import { AdminActivity } from "@/components/AdminActivity";
import { resolveRange, type RangeKey } from "@/lib/usage";

// Admin-only platform usage dashboard. Mirrors the invites page's gate:
// fetch the caller's profile via the session client, bounce non-admins,
// then aggregate across all users via the service-role client (which
// bypasses RLS). The range comes from the URL so the client switcher
// just navigates and the server re-aggregates.
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const profile = await getMyProfile(supabase);
  if (!profile?.isAdmin) redirect("/goals");

  const range = (searchParams.range as RangeKey) || "week";
  const { fromISO, toISO, label } = resolveRange(
    range,
    searchParams.from,
    searchParams.to
  );

  const service = createServiceClient();
  const report = await buildActivityReport(service, fromISO, toISO);

  return (
    <AdminActivity
      report={report}
      range={range}
      rangeLabel={label}
      from={searchParams.from ?? ""}
      to={searchParams.to ?? ""}
    />
  );
}
