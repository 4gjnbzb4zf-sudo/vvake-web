import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

const TONES = [
  { ring: "border-pulse-fg/50", tag: "bg-pulse", glow: "from-pulse/15" },
  { ring: "border-lilac-fg/50", tag: "bg-lilac", glow: "from-lilac/15" },
  { ring: "border-sky-fg/50", tag: "bg-sky", glow: "from-sky/15" },
  { ring: "border-volt-fg/40", tag: "bg-volt", glow: "from-volt/10" },
] as const;

function DuelArt() {
  return (
    <div className="flex items-end justify-center gap-1">
      <VVaker sport="runner" color="candy" eyes="fired" mouth="grin" className="h-24 w-auto" />
      <span className="mb-10 -skew-x-6 font-display text-2xl font-bold text-pulse-fg italic">VS</span>
      <VVaker sport="boxer" color="sky" eyes="fired" className="h-24 w-auto -scale-x-100" />
    </div>
  );
}

function CrewArt() {
  return (
    <div className="flex items-end justify-center">
      <div className="flex -space-x-8">
        <VVaker sport="walker" color="mint" className="h-16 w-auto" />
        <VVaker sport="runner" color="candy" className="h-16 w-auto" />
        <VVaker sport="cyclist" color="butter" className="h-16 w-auto" />
      </div>
      <span className="mx-1 mb-7 font-display text-lg font-bold text-lilac-fg italic">VS</span>
      <div className="flex -scale-x-100 -space-x-7">
        <VVaker sport="baller" color="coral" className="h-16 w-auto" />
        <VVaker sport="roller" color="lilac" className="h-16 w-auto" />
        <VVaker sport="runner" color="slate" className="h-16 w-auto" />
      </div>
    </div>
  );
}

function WorldArt() {
  return (
    <div className="flex items-end justify-center gap-3">
      <VVaker sport="runner" color="olive" className="h-24 w-auto" />
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-sky-fg/50 bg-sky/10 text-3xl">
        🌍
        <span className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-sky" />
      </div>
      <VVaker sport="yogi" color="butter" eyes="happy" className="h-24 w-auto -scale-x-100" />
    </div>
  );
}

function GhostArt() {
  return (
    <div className="relative flex items-end justify-center">
      <VVaker sport="runner" color="candy" accessory="bib" bib={10} className="h-24 w-auto" />
      <div className="-ml-10 opacity-35 grayscale">
        <VVaker sport="runner" color="sky" className="h-24 w-auto" />
      </div>
      <span className="absolute top-0 right-6 rounded-md bg-volt px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-ink">+20 m</span>
    </div>
  );
}

const ART: readonly (() => ReactNode)[] = [DuelArt, CrewArt, WorldArt, GhostArt];

/** In-app challenge invitations (game-core duel.ts): duel, crew vs crew, worldwide match, ghost race. */
export function Dare({ dict, index }: { dict: Dictionary["dare"]; index: string }) {
  return (
    <Section id="dare" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dict.cards.map((c, i) => {
          const tone = TONES[i]!;
          const Art = ART[i]!;
          return (
            <li
              key={c.label}
              className={cn(
                "flex flex-col overflow-hidden rounded-[1.75rem] border bg-gradient-to-b to-surface shadow-[0_24px_60px_-34px_rgb(0_0_0/0.9)] transition-transform duration-300 hover:-translate-y-1.5",
                tone.ring,
                tone.glow,
              )}
            >
              <div className="px-4 pt-4" aria-hidden="true">
                <Art />
              </div>
              <div className="flex flex-1 flex-col border-t border-line/60 bg-night/60 p-4">
                <span
                  className={cn(
                    "self-start rounded-md px-2 py-0.5 font-mono text-[0.62rem] font-medium tracking-[0.1em] text-ink uppercase",
                    tone.tag,
                  )}
                >
                  {c.label}
                </span>
                <p className="mt-3 text-xs text-muted">{c.from}</p>
                <p className="mt-1 font-display text-lg leading-snug font-semibold">{c.title}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-faint">{c.meta}</p>
                <div className="mt-auto flex gap-2 pt-4" aria-hidden="true">
                  <span className="flex min-h-9 flex-1 items-center justify-center rounded-xl bg-text px-2 py-1 text-center font-display text-sm leading-tight font-semibold text-night">
                    {c.accept}
                  </span>
                  <span className="flex min-h-9 flex-1 items-center justify-center rounded-xl border border-line px-2 py-1 text-center text-xs leading-tight text-muted">
                    {c.counter}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-pulse-fg/40 bg-surface/70 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-display font-semibold">
              <span className="h-2 w-2 animate-ping rounded-full bg-pulse" aria-hidden="true" />
              {dict.live.title}
            </p>
            <span className="font-mono text-xs text-faint">{dict.live.left}</span>
          </div>
          {[
            { who: dict.live.you, pct: 128, raw: "84", color: "bg-pulse" },
            { who: dict.live.them, pct: 104, raw: "210", color: "bg-sky" },
          ].map((row) => (
            <div key={row.who} className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{row.who}</span>
                <span className="font-mono text-xs text-muted">
                  <span className="font-display text-lg font-bold text-text">{row.pct}%</span> {dict.live.unit} · {row.raw} effort
                </span>
              </div>
              <div className="stripe-bar mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
                <div className={cn("h-full rounded-full", row.color)} style={{ width: `${Math.min(100, row.pct / 1.5)}%` }} />
              </div>
            </div>
          ))}
          <p className="mt-4 text-sm text-volt-fg">⚖️ {dict.live.fair}</p>
        </div>
        <ul className="space-y-2 rounded-3xl border border-line bg-surface/60 p-5 text-sm text-muted sm:p-6">
          {dict.rules.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-volt-fg" aria-hidden="true">
                ✓
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
