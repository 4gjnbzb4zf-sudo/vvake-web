import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { VVakerTraits } from "./traits";
import { VVaker } from "./VVaker";

type Effect = "holo" | "flame" | "neon" | "dust" | "city";

const CARDS: readonly { effect: Effect; look: Partial<VVakerTraits>; bg: string }[] = [
  { effect: "holo", look: { color: "lilac", eyes: "star", mouth: "grin" }, bg: "bg-[#1b1830]" },
  { effect: "flame", look: { color: "coral", sport: "boxer", eyes: "fired", mouth: "teeth", accent: "flame" }, bg: "bg-[#2a1511]" },
  { effect: "neon", look: { color: "slate", sport: "cyclist", headgear: "helmet", eyes: "visor", accent: "volt" }, bg: "bg-[#14180a]" },
  { effect: "dust", look: { color: "mint", sport: "runner", accessory: "bib", bib: 23 }, bg: "bg-[#0f1c1a]" },
  { effect: "city", look: { color: "candy", headgear: "cap", accent: "snow", accessory: "medal" }, bg: "bg-[#231218]" },
];

/** Visual treatment per collectible: pure CSS/SVG layers, so the free VVaker underneath is unchanged. */
function Effected({ effect, children }: { effect: Effect; children: ReactNode }) {
  switch (effect) {
    case "holo":
      return (
        <div className="relative">
          {children}
          <div className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_120deg,#ff3d6e55,#ccff0055,#7fb6f555,#b9a7f555,#ff3d6e55)] mix-blend-color-dodge" />
        </div>
      );
    case "flame":
      return (
        <div className="relative">
          <div className="absolute inset-x-6 top-10 bottom-6 animate-pulse-glow rounded-full bg-[radial-gradient(circle,#ff8a3dcc,#ff3d6e55_45%,transparent_70%)] blur-xl" />
          <div className="relative">{children}</div>
        </div>
      );
    case "neon":
      return <div className="drop-shadow-[0_0_14px_#ccff00]">{children}</div>;
    case "dust":
      return (
        <div className="relative">
          {[
            ["8%", "55%", "bg-mint"],
            ["2%", "68%", "bg-volt"],
            ["14%", "74%", "bg-sky"],
            ["5%", "82%", "bg-mint"],
          ].map(([left, top, color]) => (
            <span key={`${left}${top}`} className={`absolute h-2.5 w-2.5 animate-float rounded-[2px] ${color}`} style={{ left, top }} />
          ))}
          {children}
        </div>
      );
    case "city":
      return (
        <div className="relative">
          {children}
          <span className="absolute top-3 right-2 rotate-6 rounded-md bg-pulse px-2 py-0.5 font-mono text-[0.6rem] font-medium tracking-widest text-ink">
            LYON
          </span>
        </div>
      );
  }
}

export function CollectorDrops({ dict }: { dict: Dictionary["vvaker"]["collect"] }) {
  return (
    <div
      id="collector"
      className="mt-16 scroll-mt-24 rounded-[2rem] border border-pulse-fg/30 bg-gradient-to-b from-pulse/10 to-transparent p-6 sm:p-10"
    >
      <p className="font-mono text-xs tracking-[0.18em] text-pulse-fg uppercase">{dict.kicker}</p>
      <h3 className="mt-3 max-w-3xl font-display text-2xl leading-tight font-semibold sm:text-4xl">{dict.title}</h3>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">{dict.body}</p>

      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={dict.kicker}>
        {CARDS.map((card, i) => {
          const info = dict.cards[i]!;
          return (
            <li
              key={info.name}
              className="group overflow-hidden rounded-2xl border border-line bg-surface transition-transform duration-300 hover:-translate-y-1.5 hover:-rotate-1"
            >
              <div className={`${card.bg} px-3 pt-3`} aria-hidden="true">
                <Effected effect={card.effect}>
                  <VVaker {...card.look} energy={4} className="mx-auto h-40 w-auto" />
                </Effected>
              </div>
              <div className="border-t border-line p-3">
                <p className="font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase">{info.slot}</p>
                <p className="font-display text-sm font-semibold">{info.name}</p>
                <p className="mt-1 font-mono text-[0.62rem] text-volt-fg">{info.supply}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <h4 className="mt-10 font-display text-xl font-semibold">{dict.utilityTitle}</h4>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dict.utility.map((u) => (
          <li key={u.title} className="flex gap-3 rounded-2xl border border-line bg-night/60 p-4 transition-colors hover:border-volt-fg/40">
            <span aria-hidden="true" className="text-2xl">
              {u.icon}
            </span>
            <div>
              <p className="font-display font-semibold">{u.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{u.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line bg-night/60 p-5">
          <p className="font-display font-semibold">{dict.perksTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {dict.perks.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-volt-fg" aria-hidden="true">
                  ✦
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-down-fg/30 bg-down/5 p-5">
          <p className="font-display font-semibold">{dict.neverTitle}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {dict.never.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="font-mono text-down-fg" aria-hidden="true">
                  ✕
                </span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.note}</p>
    </div>
  );
}
