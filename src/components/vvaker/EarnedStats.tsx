"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { VVakerTraits } from "./traits";
import { VVaker } from "./VVaker";

type Stat = keyof Dictionary["vvaker"]["stats"]["names"];
type Archetype = keyof Dictionary["vvaker"]["stats"]["archetypes"];

const STATS: readonly Stat[] = ["endurance", "intensity", "consistency", "teamSpirit", "calm"];
const BAR: Record<Stat, string> = {
  endurance: "bg-pulse",
  intensity: "bg-[#ff8a3d]",
  consistency: "bg-volt",
  teamSpirit: "bg-sky",
  calm: "bg-calm",
};

/** Example profiles; the archetype follows `archetype()` in packages/game-core/src/attributes.ts. */
const PROFILES: readonly { stats: Record<Stat, number>; archetype: Archetype; look: Partial<VVakerTraits> }[] = [
  {
    stats: { endurance: 82, intensity: 48, consistency: 55, teamSpirit: 22, calm: 15 },
    archetype: "marathonHeart",
    look: { sport: "runner", color: "candy", accessory: "bib", bib: 42, eyes: "fired", mouth: "grin" },
  },
  {
    stats: { endurance: 58, intensity: 52, consistency: 70, teamSpirit: 91, calm: 30 },
    archetype: "crewCaptain",
    look: { sport: "baller", color: "mint", headgear: "beanie", eyes: "star", mouth: "grin" },
  },
  {
    stats: { endurance: 30, intensity: 25, consistency: 76, teamSpirit: 18, calm: 84 },
    archetype: "zenMaster",
    look: { sport: "meditator", color: "lilac", headgear: "headphones", eyes: "happy", mouth: "calm", accent: "calm" },
  },
];

/** Pentagon radar: one axis per stat, 0 at the centre, 100 at the edge. */
function Radar({ stats, label, names }: { stats: Record<Stat, number>; label: string; names: Record<Stat, string> }) {
  const c = 110;
  const r = 90;
  const point = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length;
    return `${(c + Math.cos(a) * r * v).toFixed(1)},${(c + Math.sin(a) * r * v).toFixed(1)}`;
  };
  const ring = (v: number) => STATS.map((_, i) => point(i, v)).join(" ");
  return (
    <svg viewBox="-50 -12 320 240" role="img" aria-label={label} className="mx-auto w-full max-w-80">
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" className="stroke-line" strokeWidth="1" />
      ))}
      {STATS.map((_, i) => (
        <line key={i} x1={c} y1={c} x2={point(i, 1).split(",")[0]} y2={point(i, 1).split(",")[1]} className="stroke-line" />
      ))}
      <polygon
        points={STATS.map((s, i) => point(i, stats[s] / 100)).join(" ")}
        className="fill-volt/25 stroke-volt transition-all duration-500"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {STATS.map((s, i) => {
        const [x, y] = point(i, 1.14).split(",").map(Number) as [number, number];
        return (
          <text
            key={s}
            x={x}
            y={y + 4}
            textAnchor={Math.abs(x - c) < 5 ? "middle" : x > c ? "start" : "end"}
            className="fill-muted font-mono text-[11px]"
          >
            {names[s]}
          </text>
        );
      })}
    </svg>
  );
}

export function EarnedStats({ dict }: { dict: Dictionary["vvaker"]["stats"] }) {
  const [active, setActive] = useState(0);
  const profile = PROFILES[active]!;
  return (
    <div className="mt-14 rounded-[2rem] border border-volt/30 bg-gradient-to-b from-volt/10 to-transparent p-6 sm:p-10">
      <h3 className="max-w-3xl font-display text-2xl leading-tight font-semibold sm:text-3xl">{dict.title}</h3>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">{dict.body}</p>

      <div role="tablist" aria-label={dict.example} className="mt-6 flex flex-wrap gap-2">
        {dict.profiles.map((name, i) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${i === active ? "border-volt bg-volt text-night" : "border-line text-muted hover:border-volt/50 hover:text-text"}`}
          >
            {name}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6 grid items-center gap-6 md:grid-cols-[auto_1fr_1.2fr]">
        <div className="text-center">
          <VVaker {...profile.look} energy={4} className="mx-auto h-40 w-auto" />
          <p className="mt-2 inline-flex rounded-md bg-volt px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.12em] text-night uppercase">
            {dict.archetypes[profile.archetype]}
          </p>
        </div>
        <Radar stats={profile.stats} names={dict.names} label={`${dict.profiles[active]}: ${dict.archetypes[profile.archetype]}`} />
        <ul className="space-y-3">
          {STATS.map((s) => (
            <li key={s}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display font-semibold">{dict.names[s]}</span>
                <span className="font-mono text-sm text-text tabular-nums">{profile.stats[s]}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line/60">
                <div className={`h-full rounded-full ${BAR[s]} transition-all duration-500`} style={{ width: `${profile.stats[s]}%` }} />
              </div>
              <p className="mt-1 text-xs text-faint">{dict.hints[s]}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-faint">{dict.decay}</p>
    </div>
  );
}
