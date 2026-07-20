"use client";

import { useState } from "react";
import type { ChartBucket } from "@/lib/goals";

// Small hand-rolled SVG bar chart. See the parent Launchpad component
// of the same name for the visual contract.

interface Props {
  title: string;
  subtitle?: string;
  buckets: ChartBucket[];
  goal: number;
  benchmark: number;
  barColorClass: string;
  currentBarColorClass?: string;
  goalStrokeClass?: string;
  benchmarkStrokeClass?: string;
  emptyLabel?: string;
}

const CHART_HEIGHT = 160;
const AXIS_LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 32;
const RIGHT_PAD = 8;
const TOP_PAD = 8;
const BAR_GAP = 4;

export function PacingChart({
  title,
  subtitle,
  buckets,
  goal,
  benchmark,
  barColorClass,
  currentBarColorClass,
  goalStrokeClass = "stroke-slate-700",
  benchmarkStrokeClass = "stroke-slate-400",
  emptyLabel = "No entries logged in this range.",
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const anyData = buckets.some((b) => b.count > 0);
  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const rawMax = Math.max(peak, goal, benchmark);
  const yMax = rawMax > 0 ? Math.ceil(rawMax * 1.15) : 1;

  const bucketCount = Math.max(1, buckets.length);
  const totalBarSpace = 400;
  const barWidth = (totalBarSpace - BAR_GAP * (bucketCount - 1)) / bucketCount;
  const totalViewboxWidth = Y_AXIS_WIDTH + totalBarSpace + RIGHT_PAD;
  const totalViewboxHeight = CHART_HEIGHT + TOP_PAD + AXIS_LABEL_HEIGHT;

  const yForValue = (v: number) =>
    TOP_PAD + CHART_HEIGHT - (v / yMax) * CHART_HEIGHT;

  const goalY = goal > 0 ? yForValue(goal) : null;
  const benchmarkY = benchmark > 0 ? yForValue(benchmark) : null;

  const ticks = [0, 0.5, 1].map((frac) => ({
    v: Math.round(yMax * frac),
    y: yForValue(yMax * frac),
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {goal > 0 && (
            <span className="flex items-center gap-1">
              <span className={`inline-block w-4 h-[2px] ${goalStrokeToBg(goalStrokeClass)}`} />
              Goal {goal}
            </span>
          )}
          {benchmark > 0 && (
            <span className="flex items-center gap-1">
              <svg width="16" height="6" className="inline-block">
                <line
                  x1="0"
                  y1="3"
                  x2="16"
                  y2="3"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                  className={benchmarkStrokeClass}
                />
              </svg>
              Benchmark {benchmark}
            </span>
          )}
        </div>
      </div>

      {!anyData && goal === 0 && benchmark === 0 ? (
        <p className="text-xs italic text-slate-500 py-6 text-center">
          {emptyLabel}
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${totalViewboxWidth} ${totalViewboxHeight}`}
            className="w-full h-auto"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title} bar chart`}
          >
            <line
              x1={Y_AXIS_WIDTH}
              y1={TOP_PAD + CHART_HEIGHT}
              x2={Y_AXIS_WIDTH + totalBarSpace}
              y2={TOP_PAD + CHART_HEIGHT}
              className="stroke-slate-200"
              strokeWidth="1"
            />
            {ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={Y_AXIS_WIDTH - 3}
                  y1={t.y}
                  x2={Y_AXIS_WIDTH + totalBarSpace}
                  y2={t.y}
                  className="stroke-slate-100"
                  strokeWidth="1"
                />
                <text
                  x={Y_AXIS_WIDTH - 5}
                  y={t.y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px]"
                >
                  {t.v}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);
              const bh = (b.count / yMax) * CHART_HEIGHT;
              const y = TOP_PAD + CHART_HEIGHT - bh;
              const fillClass =
                b.isCurrent && currentBarColorClass
                  ? currentBarColorClass
                  : barColorClass;
              const emphasized = hoverIdx === i;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-default"
                >
                  <rect
                    x={x}
                    y={TOP_PAD}
                    width={barWidth}
                    height={CHART_HEIGHT}
                    fill="transparent"
                  />
                  {bh > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={bh}
                      className={`${fillClass} ${emphasized ? "opacity-90" : "opacity-100"} transition-opacity`}
                      rx={1.5}
                    />
                  )}
                  {b.isCurrent && (
                    <rect
                      x={x - 1}
                      y={TOP_PAD + CHART_HEIGHT}
                      width={barWidth + 2}
                      height={2}
                      className="fill-slate-700"
                    />
                  )}
                </g>
              );
            })}
            {goalY !== null && (
              <line
                x1={Y_AXIS_WIDTH}
                y1={goalY}
                x2={Y_AXIS_WIDTH + totalBarSpace}
                y2={goalY}
                strokeWidth="1.5"
                className={goalStrokeClass}
              />
            )}
            {benchmarkY !== null && (
              <line
                x1={Y_AXIS_WIDTH}
                y1={benchmarkY}
                x2={Y_AXIS_WIDTH + totalBarSpace}
                y2={benchmarkY}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className={benchmarkStrokeClass}
              />
            )}
            {buckets.map((b, i) => {
              const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP) + barWidth / 2;
              const showEvery = bucketCount > 10 ? 2 : 1;
              if (i % showEvery !== 0 && i !== bucketCount - 1) return null;
              return (
                <text
                  key={i}
                  x={x}
                  y={TOP_PAD + CHART_HEIGHT + 14}
                  textAnchor="middle"
                  className={`text-[9px] ${
                    b.isCurrent
                      ? "fill-slate-700 font-semibold"
                      : "fill-slate-400"
                  }`}
                >
                  {b.label}
                </text>
              );
            })}
          </svg>

          {hoverIdx !== null && buckets[hoverIdx] && (
            <div className="absolute top-0 right-0 text-[11px] bg-slate-900 text-white px-2 py-1 rounded shadow pointer-events-none">
              <span className="font-semibold">{buckets[hoverIdx].label}:</span>{" "}
              {buckets[hoverIdx].count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function goalStrokeToBg(strokeClass: string): string {
  return strokeClass.replace(/^stroke-/, "bg-");
}
