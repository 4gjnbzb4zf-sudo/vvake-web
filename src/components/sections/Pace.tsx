import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const ICONS = ["🔥", "🏆", "✅", "🔔", "🎧", "🎁"] as const;
/** Example week: 5 active days, 2 protected rest days (Wednesday and Sunday). */
const WEEK = ["on", "on", "rest", "on", "on", "on", "rest"] as const;

export function Pace({ dict, index }: { dict: Dictionary["pace"]; index: string }) {
  const w = dict.widgets;
  return (
    <Section id="pace" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        {/* Widget stack: what "keeping your pace" looks like in the app */}
        <div className="space-y-3" aria-hidden="true">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-pulse-fg uppercase">{w.streak}</p>
              <p className="font-display text-3xl font-bold">
                23 <span className="text-base font-semibold text-muted">{w.days} 🔥</span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {WEEK.map((d, i) => (
                <div key={i} className="text-center">
                  <div
                    className={
                      d === "on"
                        ? "mx-auto h-9 w-9 rounded-xl bg-pulse shadow-[0_6px_18px_-6px_rgb(255_61_110/0.7)]"
                        : "mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-calm-fg/60 text-[0.6rem] text-calm-fg"
                    }
                  >
                    {d === "rest" ? "zz" : null}
                  </div>
                  <p className="mt-1.5 font-mono text-[0.65rem] text-faint">{w.week[i]}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.65rem] text-calm-fg">
              ▢ = {w.rest} · {dict.healthy[0]}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface p-5">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-volt-fg uppercase">🏆 {w.league}</p>
              <p className="mt-3 font-display text-2xl font-bold">#4</p>
              <p className="mt-1 text-xs text-muted">{w.rank}</p>
              <div className="stripe-bar mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full w-[78%] rounded-full bg-volt" />
              </div>
            </div>
            <div className="rounded-3xl border border-line bg-surface p-5">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-lilac-fg uppercase">{w.quests}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {w.questList.map((q, i) => (
                  <li key={q} className="flex items-center gap-2">
                    <span
                      className={
                        i < 2
                          ? "flex h-5 w-5 items-center justify-center rounded-md bg-lilac text-[0.65rem] text-ink"
                          : "h-5 w-5 rounded-md border border-line"
                      }
                    >
                      {i < 2 ? "✓" : null}
                    </span>
                    <span className={i < 2 ? "text-muted line-through" : "text-text"}>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pulse to-volt text-2xl">
              🎧
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{w.nowPlaying}</p>
              <p className="truncate font-display text-lg font-semibold">{w.track}</p>
              <p className="text-xs text-volt-fg">♪ {w.tempo}</p>
            </div>
            <div className="flex gap-2 text-lg text-muted">
              <span>⏮</span>
              <span className="text-text">⏸</span>
              <span>⏭</span>
            </div>
          </div>
        </div>

        <div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {dict.items.map((item, i) => (
              <li key={item.title} className="rounded-3xl border border-line bg-surface/60 p-5 transition-colors hover:border-pulse-fg/40">
                <span aria-hidden="true" className="text-2xl">
                  {ICONS[i % ICONS.length]}
                </span>
                <h3 className="mt-3 font-display text-lg leading-snug font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-3xl border border-line bg-night-2 p-5">
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.musicLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {dict.musicServices.map((s) => (
                <li key={s} className="rounded-xl border border-line bg-surface px-4 py-2 font-display text-sm font-semibold">
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">{dict.musicNote}</p>
          </div>
        </div>
      </div>

      <ul className="mt-8 flex flex-wrap gap-2">
        {dict.healthy.map((h) => (
          <li key={h} className="rounded-full border border-calm-fg/40 bg-calm/10 px-3.5 py-1.5 font-mono text-xs text-calm-fg">
            ♥ {h}
          </li>
        ))}
      </ul>
    </Section>
  );
}
