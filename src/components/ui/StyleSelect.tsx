"use client";

import { VVAKER_LOOKS, type VVakerLook } from "@/components/vvaker/traits";
import { setLookPref, useLookPref } from "@/lib/prefs";

/** Site-wide VVaker style switch: every VVaker on the site follows it; remembered in this browser. */
export function StyleSelect({ label, looks }: { label: string; looks: Record<VVakerLook, string> }) {
  const look = useLookPref() ?? "toy";
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="pointer-events-none absolute left-2 text-xs">
        {look === "toy" ? "🧸" : "💪"}
      </span>
      <select
        value={look}
        onChange={(e) => setLookPref(e.target.value as VVakerLook)}
        title={label}
        className="h-[34px] cursor-pointer appearance-none rounded-lg border border-line bg-transparent pr-6 pl-7 font-mono text-xs text-muted transition-colors hover:text-text focus:text-text"
      >
        {VVAKER_LOOKS.map((l) => (
          <option key={l} value={l} className="bg-night text-text">
            {looks[l]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 text-[0.6rem] text-faint">
        ▾
      </span>
    </label>
  );
}
