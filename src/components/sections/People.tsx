import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";

/** Buddy, crew and Sweat date matching (game-core match.ts). Safety rules C29 are listed, not hidden. */
export function People({ dict, index }: { dict: Dictionary["people"]; index: string }) {
  return (
    <Section id="people" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          {dict.modes.map((m, i) => (
            <div
              key={m.name}
              className={`flex gap-4 rounded-3xl border p-5 ${i === 2 ? "border-pulse/50 bg-gradient-to-r from-pulse/15 to-transparent" : "border-line bg-surface/60"}`}
            >
              <span aria-hidden="true" className="text-3xl">
                {m.icon}
              </span>
              <div>
                <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
                  {m.name}
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase ${i === 2 ? "bg-pulse text-night" : "bg-line text-muted"}`}
                  >
                    {m.tag}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{m.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-pulse/40 bg-gradient-to-b from-pulse/10 to-surface p-6" aria-hidden="true">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-pulse uppercase">{dict.demo.label}</p>
            <p className="rounded-full bg-pulse px-3 py-1 font-display text-sm font-bold text-night">{dict.demo.score}</p>
          </div>
          <div className="relative mt-4 flex items-end justify-center gap-2">
            <VVaker sport="runner" color="candy" eyes="happy" mouth="grin" accent="volt" className="h-40 w-auto" />
            <span className="mb-20 animate-pulse-glow text-4xl">💘</span>
            <VVaker
              sport="yogi"
              look="athlete-b"
              color="sky"
              headgear="cap"
              eyes="star"
              mouth="smile"
              accent="flame"
              className="h-40 w-auto -scale-x-100"
            />
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {dict.demo.reasons.map((r) => (
              <li key={r} className="rounded-full border border-line bg-night/60 px-3 py-1 text-xs text-text">
                ✓ {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex h-11 items-center justify-center rounded-xl bg-pulse font-display text-sm font-semibold text-night">
            🏃 {dict.demo.cta}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-mint/30 bg-mint/5 p-6">
        <p className="font-display text-lg font-semibold">🛡️ {dict.safetyTitle}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm text-muted sm:grid-cols-2">
          {dict.safety.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="text-mint" aria-hidden="true">
                ✓
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.note}</p>
    </Section>
  );
}
