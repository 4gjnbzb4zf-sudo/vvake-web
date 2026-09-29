"use client";

import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { setLookPref, useLookPref } from "@/lib/prefs";
import { VVAKER_LOOKS, type VVakerLook, type VVakerTraits } from "./traits";
import { VVaker } from "./VVaker";

/** Each card shows the same VVaker in one style, so the choice is about the look, not the character. */
const PREVIEW: Partial<VVakerTraits> = { sport: "runner", color: "candy", accent: "volt", eyes: "happy", mouth: "grin", energy: 4 };
const BLURB_TONE: Record<VVakerLook, string> = { toy: "text-pulse-fg", "athlete-a": "text-volt-fg", "athlete-b": "text-sky-fg" };

/** Big style chooser at the top of the VVaker section (same switch as the header and the studio). */
export function StylePicker({ dict }: { dict: Dictionary["vvaker"] }) {
  const current = useLookPref() ?? "toy";
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold">{dict.picker.title}</h3>
        <p className="text-sm text-faint">{dict.picker.note}</p>
      </div>
      <div role="radiogroup" aria-label={dict.picker.title} className="mt-4 grid gap-3 sm:grid-cols-3">
        {VVAKER_LOOKS.map((look) => {
          const active = current === look;
          return (
            <button
              key={look}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLookPref(look)}
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden rounded-3xl border p-4 text-left transition-all duration-300",
                active
                  ? "border-volt-fg bg-volt/10 shadow-[0_18px_50px_-24px_rgb(204_255_0/0.6)]"
                  : "border-line bg-surface/60 hover:-translate-y-1 hover:border-volt-fg/40",
              )}
            >
              <VVaker {...PREVIEW} look={look} lockLook className="h-28 w-auto shrink-0 transition-transform group-hover:scale-105" />
              <div>
                <p className="font-display text-lg font-semibold">{dict.looks[look]}</p>
                <p className={cn("mt-1 text-sm leading-snug", BLURB_TONE[look])}>{dict.picker.blurbs[look]}</p>
                <span
                  className={cn(
                    "mt-3 inline-flex rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] tracking-[0.1em] uppercase",
                    active ? "bg-volt text-ink" : "border border-line text-faint",
                  )}
                >
                  {active ? dict.picker.selected : dict.picker.choose}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
