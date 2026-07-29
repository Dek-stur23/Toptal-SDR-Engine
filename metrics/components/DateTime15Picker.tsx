"use client";

import { useMemo } from "react";

// Compact date + hour + 15-minute picker. Splits the datetime into
// three separate controls so the user never sees or types an
// off-quarter minute value. Emits milliseconds-since-epoch on any
// change; the parent owns the state.
//
// Design goals:
// - Cross-browser (no reliance on native datetime-local step).
// - Zero chance of a value like 14:37 sneaking through — minutes
//   are constrained to :00, :15, :30, :45 by construction.
// - Reads and writes local time (matches how the earlier
//   datetime-local input behaved).
export function DateTime15Picker({
  valueMs,
  onChange,
  focusRingClass = "focus:ring-blue-500",
}: {
  valueMs: number;
  onChange: (nextMs: number) => void;
  focusRingClass?: string;
}) {
  const parts = useMemo(() => splitLocal(valueMs), [valueMs]);
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    []
  );

  const emit = (
    dateStr: string,
    hourStr: string,
    minuteStr: string
  ): void => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d)
    ) {
      return;
    }
    const next = new Date(
      y,
      (m as number) - 1,
      d as number,
      Number(hourStr),
      Number(minuteStr),
      0,
      0
    );
    onChange(next.getTime());
  };

  const inputClass = `rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:ring-2 ${focusRingClass} outline-none`;

  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={parts.date}
        onChange={(e) => emit(e.target.value, parts.hour, parts.minute)}
        className={`${inputClass} flex-1 min-w-0`}
      />
      <select
        value={parts.hour}
        onChange={(e) => emit(parts.date, e.target.value, parts.minute)}
        className={`${inputClass} w-20`}
        aria-label="Hour"
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        value={parts.minute}
        onChange={(e) => emit(parts.date, parts.hour, e.target.value)}
        className={`${inputClass} w-20`}
        aria-label="Minute"
      >
        {["00", "15", "30", "45"].map((m) => (
          <option key={m} value={m}>
            :{m}
          </option>
        ))}
      </select>
    </div>
  );
}

// Break an ms-epoch timestamp into local date / hour / rounded-to-15
// minute strings for the three controls.
function splitLocal(ms: number): { date: string; hour: string; minute: string } {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return splitLocal(now.getTime());
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  // Round to nearest 15 mins. If we round up to 60, roll the hour and
  // (rarely) the date forward so the picker is always on a valid
  // quarter.
  const rawMin = d.getMinutes();
  let rounded = Math.round(rawMin / 15) * 15;
  let extraHours = 0;
  if (rounded === 60) {
    rounded = 0;
    extraHours = 1;
  }
  if (extraHours > 0) {
    const rolled = new Date(d);
    rolled.setMinutes(0, 0, 0);
    rolled.setHours(rolled.getHours() + extraHours);
    return {
      date: `${rolled.getFullYear()}-${String(rolled.getMonth() + 1).padStart(2, "0")}-${String(rolled.getDate()).padStart(2, "0")}`,
      hour: String(rolled.getHours()).padStart(2, "0"),
      minute: "00",
    };
  }
  return {
    date: `${y}-${m}-${day}`,
    hour,
    minute: String(rounded).padStart(2, "0"),
  };
}
