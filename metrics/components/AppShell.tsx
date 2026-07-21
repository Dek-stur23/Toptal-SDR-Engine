"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import type { Profile } from "@/lib/types";
import { OnboardingModal } from "@/components/OnboardingModal";

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

  const tabs = [
    { href: "/goals", label: "Goals & Metrics", icon: BarChart3 },
    { href: "/meetings", label: "Meetings Tracker", icon: CalendarClock },
    { href: "/accounts", label: "Accounts", icon: Building2 },
  ];
  if (profile?.isAdmin) {
    tabs.push({ href: "/admin/invites", label: "Admin", icon: ShieldCheck });
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
              {tabs.map((tab) => {
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
