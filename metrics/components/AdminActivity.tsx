"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Clock, Users } from "lucide-react";
import type { ActivityReport } from "@/lib/data/activityReport";
import type { RangeKey } from "@/lib/usage";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

export function AdminActivity({
  report,
  range,
  rangeLabel,
  from,
  to,
}: {
  report: ActivityReport;
  range: RangeKey;
  rangeLabel: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const go = (key: RangeKey) => {
    if (key === "custom") {
      const params = new URLSearchParams({ range: "custom" });
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
      router.push(`/admin/activity?${params.toString()}`);
    } else {
      router.push(`/admin/activity?range=${key}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" /> Platform Usage
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Who&apos;s using SDR Sidekick and which tools they&apos;re using.
          Showing <strong>{rangeLabel}</strong>.
        </p>
      </div>

      {/* Range switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => go(r.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${
              range === r.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => go("custom")}
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          icon={<Users className="w-4 h-4 text-blue-600" />}
          label="Active users"
          value={report.activeUsers.toLocaleString()}
        />
        <Kpi
          icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
          label="Total actions"
          value={report.totalEvents.toLocaleString()}
        />
        <Kpi
          icon={<Activity className="w-4 h-4 text-blue-600" />}
          label="Most-used tool"
          value={report.topTool ?? "—"}
        />
      </div>

      {report.totalEvents === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 italic">
          No recorded activity in this period yet. Usage is tracked from when
          the tracker went live — earlier activity won&apos;t appear.
        </p>
      ) : (
        <>
          {/* Per-rep engagement */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Per-rep engagement
            </h2>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Rep</Th>
                      <Th className="text-right">Actions</Th>
                      <Th className="text-right">Active days</Th>
                      <Th>Tools used</Th>
                      <Th>Last active</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.perRep.map((r) => (
                      <tr
                        key={r.userId}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">
                            {r.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {r.email}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                          {r.events.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {r.activeDays}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.toolsUsed.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                          <Clock className="inline w-3 h-3 mr-1 -mt-0.5 text-slate-400" />
                          {new Date(r.lastActive).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Per-tool usage */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Per-tool usage
            </h2>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Tool / tab</Th>
                      <Th className="text-right">Actions</Th>
                      <Th className="text-right">Distinct users</Th>
                      <Th className="text-right">Share</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.perTool.map((t) => {
                      const share = report.totalEvents
                        ? Math.round((t.events / report.totalEvents) * 100)
                        : 0;
                      return (
                        <tr
                          key={t.tool}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {t.tool}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                            {t.events.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {t.users}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-blue-500"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-slate-500 w-8 text-right">
                                {share}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}
