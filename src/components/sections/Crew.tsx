import { Section } from "@/components/ui/Section";
import type { VVakerTraits } from "@/components/vvaker/traits";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";
import { DEMO_ROUTE_PATH } from "./routeDemo";

const CREW: readonly Partial<VVakerTraits>[] = [
  { color: "candy", eyes: "fired", mouth: "grin" },
  { color: "mint", headgear: "cap", accent: "volt" },
  { color: "butter", headgear: "beanie", eyes: "happy", mouth: "calm" },
  { color: "sky", accessory: "bib", bib: 7 },
  { color: "coral", headgear: "headphones", accent: "ocean" },
];

export function Crew({ dict, index }: { dict: Dictionary["crew"]; index: string }) {
  const inv = dict.invite;
  return (
    <Section id="crew" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4" aria-hidden="true">
          {/* Invitation card */}
          <div className="rounded-[2rem] border border-pulse/40 bg-gradient-to-b from-pulse/15 to-surface p-6 shadow-[0_24px_60px_-30px_rgb(255_61_110/0.7)]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-pulse uppercase">{inv.label}</p>
              <span className="rounded-full border border-line bg-night px-2 py-0.5 font-mono text-[0.65rem] text-muted">
                ↻ {inv.repeat}
              </span>
            </div>
            <p className="mt-4 font-display text-2xl font-semibold">🏃 {inv.sport}</p>
            <p className="mt-1 font-display text-lg text-text">{inv.when}</p>
            <p className="mt-1 text-sm text-muted">📍 {inv.where}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex -space-x-3">
                {CREW.map((look, i) => (
                  <div key={i} className="h-12 w-12 overflow-hidden rounded-full border-2 border-surface bg-night-2">
                    <VVaker {...look} energy={4} className="-mt-1 h-16 w-12" />
                  </div>
                ))}
              </div>
              <p className="font-mono text-xs text-volt">{inv.going}</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {inv.buttons.map((b, i) => (
                <span
                  key={b}
                  className={
                    i === 0
                      ? "rounded-xl bg-pulse py-2.5 text-center font-display text-sm font-semibold text-night"
                      : "rounded-xl border border-line bg-night py-2.5 text-center font-display text-sm font-semibold text-muted"
                  }
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Past run card: privacy-trimmed route line art, no map */}
          <div className="overflow-hidden rounded-[2rem] border border-line bg-surface">
            <div className="bg-voxel-grid relative bg-night-2 px-4 pt-4">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.routeCard.label}</p>
              <svg viewBox="0 0 320 180" className="mt-2 h-44 w-full">
                <defs>
                  <linearGradient id="route-grad" x1="0" x2="1">
                    <stop offset="0" stopColor="#ff3d6e" />
                    <stop offset="1" stopColor="#ccff00" />
                  </linearGradient>
                </defs>
                <path
                  d={DEMO_ROUTE_PATH}
                  fill="none"
                  stroke="#ff3d6e"
                  strokeOpacity="0.25"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={DEMO_ROUTE_PATH}
                  fill="none"
                  stroke="url(#route-grad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="absolute right-3 bottom-2 w-16">
                <VVaker color="candy" eyes="star" mouth="grin" accessory="medal" energy={4} className="h-auto w-full" />
              </div>
            </div>
            <dl className="grid grid-cols-4 divide-x divide-line border-t border-line">
              {dict.routeCard.stats.map((st) => (
                <div key={st.label} className="px-2 py-3 text-center">
                  <dt className="font-mono text-[0.6rem] tracking-[0.12em] text-faint uppercase">{st.label}</dt>
                  <dd className="font-display text-lg font-semibold">{st.value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-line px-4 py-2.5 font-mono text-[0.65rem] text-calm">🔒 {dict.routeCard.privacy}</p>
          </div>

          {/* Reminder sequence */}
          <ol className="space-y-2">
            {dict.reminders.map((r, i) => (
              <li
                key={r.when}
                className={`flex gap-3 rounded-2xl border p-3 text-sm ${i === dict.reminders.length - 1 ? "border-volt/40 bg-volt/10" : "border-line bg-surface/70"}`}
              >
                <span className="w-20 shrink-0 font-mono text-xs text-faint">{r.when}</span>
                <span className={i === dict.reminders.length - 1 ? "text-volt" : "text-text"}>{r.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {dict.features.map((f) => (
              <li key={f.title} className="rounded-3xl border border-line bg-surface/60 p-5 transition-colors hover:border-pulse/40">
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-2xl border border-calm/30 bg-calm/10 p-4 text-sm text-calm">♥ {dict.note}</p>
        </div>
      </div>
    </Section>
  );
}
