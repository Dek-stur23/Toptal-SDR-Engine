"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivityEvent } from "@/lib/data/activityEvents";
import { toolLabelForPath } from "@/lib/usage";

// Platform-wide usage tracking. Logs one page-view event per navigation
// so we know which tabs each user actually opens — not just which tools
// happen to write to their own tables. Renders nothing; mounted once in
// the app shell so a single instance covers every authenticated route.
//
// Fire-and-forget: logActivityEvent swallows its own errors, so a failed
// ping never affects navigation.
export function UsageTracker() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  // Guards against double-firing for the same path (React strict-mode
  // double effects in dev, and re-renders that don't change the route).
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (lastLogged.current === pathname) return;
    const tool = toolLabelForPath(pathname);
    if (!tool) return;
    lastLogged.current = pathname;
    void logActivityEvent(supabase, { tool, action: "view" });
  }, [pathname, supabase]);

  return null;
}
