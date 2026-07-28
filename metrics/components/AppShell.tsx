"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  MoreHorizontal,
  Settings as SettingsIcon,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import type { Profile } from "@/lib/types";
import { OnboardingModal } from "@/components/OnboardingModal";

// Additional Tools dropdown menu.
//
// Register new secondary tools here — they'll show up automatically
// in the "Additional Tools" dropdown in the header. Primary tools
// (Goals & Metrics, Meetings Tracker, Accounts) stay as flat tabs.
// Move an item into the primary tabs array in AppShell when it
// graduates to daily-use status.
export const ADDITIONAL_TOOLS: {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}[] = [
  // Example shape:
  // { href: "/insights", label: "Insights", icon: LineChart, description: "Cross-account trends" },
];

// Shell rendered by the protected layout. Header with view tabs and a
// sign-out form; children fill the rest. The current-user profile is
// passed in from the server so the header knows the display name and
// whether to render the Admin tab.
export function AppShell({
  profile,
  email,
  children,
}: {
  profile: Profile | null;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const primaryTabs = [
    { href: "/goals", label: "Goals & Metrics", icon: BarChart3 },
    { href: "/meetings", label: "Meetings Tracker", icon: CalendarClock },
    { href: "/accounts", label: "Accounts", icon: Building2 },
  ];
  if (profile?.isAdmin) {
    primaryTabs.push({
      href: "/admin/invites",
      label: "Admin",
      icon: ShieldCheck,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="text-sm font-semibold tracking-tight text-slate-900">
              SDR Sidekick
            </div>
            <nav className="flex items-center gap-1">
              {primaryTabs.map((tab) => {
                const active =
                  pathname === tab.href || pathname.startsWith(tab.href + "/");
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={clsx(
                      "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
              <AdditionalToolsDropdown pathname={pathname} />
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {profile?.displayName || email}
            </span>
            <Link
              href="/settings"
              className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100"
              title="Settings"
              aria-label="Settings"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>

      {profile && profile.onboardedAt === null && (
        <OnboardingModal
          initialEmail={email}
          initialDisplayName={profile.displayName}
        />
      )}
    </div>
  );
}

function AdditionalToolsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close the dropdown when the user navigates to one of its items.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const activeItem = ADDITIONAL_TOOLS.find(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/")
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm",
          activeItem
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
        Additional Tools
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {ADDITIONAL_TOOLS.length === 0 ? (
            <div className="px-3 py-4 text-xs italic text-slate-500">
              No additional tools yet. New ones will land here as they ship.
            </div>
          ) : (
            <ul className="py-1">
              {ADDITIONAL_TOOLS.map((tool) => {
                const active =
                  pathname === tool.href ||
                  pathname.startsWith(tool.href + "/");
                const Icon = tool.icon;
                return (
                  <li key={tool.href}>
                    <Link
                      href={tool.href}
                      role="menuitem"
                      className={clsx(
                        "flex items-start gap-2 px-3 py-2 text-sm",
                        active
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <div className="font-medium">{tool.label}</div>
                        {tool.description && (
                          <div className="text-[11px] text-slate-500">
                            {tool.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
