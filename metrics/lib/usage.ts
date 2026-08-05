// Usage-tracking helpers shared by the page-view tracker (client) and
// the admin usage dashboard (server). Plain module — safe to import from
// both. No server-only or client-only imports here.

// Maps an app route to a human tool/tab label. Most specific prefix
// wins, so /admin/activity and /admin/invites resolve before the bare
// /admin fallback.
export const USAGE_TOOLS: { prefix: string; label: string }[] = [
  { prefix: "/goals", label: "Goals & Metrics" },
  { prefix: "/meetings", label: "Meetings Tracker" },
  { prefix: "/accounts", label: "Accounts" },
  { prefix: "/lusha-csv", label: "ZoomInfo → Lusha" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/admin/activity", label: "Admin: Usage" },
  { prefix: "/admin/invites", label: "Admin: Invites" },
  { prefix: "/admin", label: "Admin" },
];

// The tool/tab label for a pathname, or null for routes we don't track
// (e.g. the "/" redirect shell).
export function toolLabelForPath(pathname: string): string | null {
  for (const t of USAGE_TOOLS) {
    if (pathname === t.prefix || pathname.startsWith(t.prefix + "/")) {
      return t.label;
    }
  }
  return null;
}

// ---------- Date-range presets for the usage dashboard ----------

export type RangeKey = "day" | "week" | "month" | "all" | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolves a range key (+ optional custom from/to as YYYY-MM-DD) into an
// ISO window and a human label. Rolling windows keep the semantics
// unambiguous for leadership ("Last 7 days" beats a timezone-sensitive
// "this week"). Runs server-side only, so `new Date()` is fine here.
export function resolveRange(
  range: RangeKey,
  from?: string,
  to?: string
): { fromISO: string; toISO: string; label: string } {
  const now = new Date();

  if (range === "custom") {
    const start = from
      ? new Date(`${from}T00:00:00`)
      : new Date(now.getTime() - 7 * DAY_MS);
    const end = to ? new Date(`${to}T23:59:59.999`) : now;
    return {
      fromISO: start.toISOString(),
      toISO: end.toISOString(),
      label: `${from || "start"} → ${to || "now"}`,
    };
  }

  if (range === "day") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { fromISO: start.toISOString(), toISO: now.toISOString(), label: "Today" };
  }

  if (range === "month") {
    const start = new Date(now.getTime() - 30 * DAY_MS);
    return {
      fromISO: start.toISOString(),
      toISO: now.toISOString(),
      label: "Last 30 days",
    };
  }

  if (range === "all") {
    // Far enough back to cover any real history in the project.
    return {
      fromISO: new Date("2000-01-01T00:00:00Z").toISOString(),
      toISO: now.toISOString(),
      label: "All time",
    };
  }

  // week (default)
  const start = new Date(now.getTime() - 7 * DAY_MS);
  return {
    fromISO: start.toISOString(),
    toISO: now.toISOString(),
    label: "Last 7 days",
  };
}
