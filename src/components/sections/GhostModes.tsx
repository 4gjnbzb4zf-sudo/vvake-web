import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

const TONES = ["border-sky-fg/50", "border-butter-fg/50", "border-up-fg/50", "border-lilac-fg/50"] as const;
const TAGS = ["bg-sky", "bg-butter", "bg-up", "bg-lilac"] as const;

/** The route ghost on the map: your dot and the ghost's on the same route, the stretch between them green (you lead). */
function RouteMap({ dict }: { dict: Dictionary["ghostModes"]["map"] }) {
  return (
    <figure className="rounded-3xl border border-line bg-surface/70 p-5 sm:p-6">
      <svg viewBox="0 0 320 180" className="h-auto w-full" role="img" aria-label={dict.alt}>
        <path
          d="M20 150 C 60 150, 70 90, 120 90 S 170 40, 220 45 S 300 80, 300 140"
          fill="none"
          className="stroke-line"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M20 150 C 60 150, 70 90, 120 90 S 170 40, 220 45 S 300 80, 300 140"
          fill="none"
          className="stroke-muted/40"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        {/* The stretch between the ghost (behind) and you (ahead): green while you lead. */}
        <path d="M120 90 S 155 57, 178 48" fill="none" className="stroke-up" strokeWidth="6" strokeLinecap="round" />
        <circle cx="120" cy="90" r="9" className="fill-text/30 stroke-text/60" strokeWidth="2" />
        <text x="120" y="94" textAnchor="middle" fontSize="10">
          👻
        </text>
        <circle cx="178" cy="48" r="9" className="fill-pulse stroke-night" strokeWidth="3" />
        <rect x="186" y="10" width="92" height="22" rx="6" className="fill-up" />
        <text x="232" y="25" textAnchor="middle" fontSize="11" fontWeight="600" className="fill-ink font-mono">
          {dict.ahead}
        </text>
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-pulse" aria-hidden="true" />
          {dict.you}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-text/40" aria-hidden="true" />
          {dict.ghost}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-up" aria-hidden="true" />
          {dict.green}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-pulse" aria-hidden="true" />
          {dict.pink}
        </span>
      </figcaption>
      <p className="mt-3 text-sm text-muted">{dict.caption}</p>
    </figure>
  );
}

/** Ghost modes (the app's game-core ghostModes.ts): distance race, pace target, route ghost, training ghost. */
export function GhostModes({ dict, index }: { dict: Dictionary["ghostModes"]; index: string }) {
  return (
    <Section id="ghost-modes" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dict.modes.map((m, i) => (
          <li key={m.label} className={cn("flex flex-col rounded-[1.75rem] border bg-surface/70 p-5", TONES[i % TONES.length])}>
            <span
              className={cn(
                "self-start rounded-md px-2 py-0.5 font-mono text-[0.62rem] font-medium tracking-[0.1em] text-ink uppercase",
                TAGS[i % TAGS.length],
              )}
            >
              {m.label}
            </span>
            <p className="mt-3 font-display text-lg leading-snug font-semibold">{m.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{m.body}</p>
            <p className="mt-auto pt-4 font-mono text-[0.68rem] text-faint">{m.meta}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <RouteMap dict={dict.map} />
        <div className="space-y-4">
          <div className="rounded-3xl border border-pulse-fg/40 bg-surface/70 p-5 sm:p-6">
            <p className="font-display font-semibold">🔊 {dict.cuesTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {dict.cues.map((c) => (
                <li key={c} className="italic">
                  {c}
                </li>
              ))}
            </ul>
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
      </div>
    </Section>
  );
}
