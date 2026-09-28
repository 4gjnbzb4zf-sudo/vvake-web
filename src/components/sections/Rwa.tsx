import { Section } from "@/components/ui/Section";
import { MoneyText } from "@/components/ui/Money";
import type { Dictionary } from "@/i18n/dictionaries";

const LANE_STYLES = [
  { tag: "bg-down text-night", border: "border-down/40", glow: "from-down/15" },
  { tag: "bg-pulse text-night", border: "border-pulse/50", glow: "from-pulse/20" },
  { tag: "bg-volt text-night", border: "border-volt/40", glow: "from-volt/15" },
] as const;

/** How real-world market data, the game and the (planned) on-chain layer connect, with the compliance lines visible. */
export function Rwa({ dict, index }: { dict: Dictionary["rwa"]; index: string }) {
  return (
    <Section id="rwa" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ol className="relative mt-12 grid gap-4 lg:grid-cols-3">
        {dict.lanes.map((lane, i) => {
          const style = LANE_STYLES[i % LANE_STYLES.length]!;
          return (
            <li
              key={lane.tag}
              className={`relative flex flex-col rounded-3xl border ${style.border} bg-gradient-to-b ${style.glow} to-surface/40 p-6`}
            >
              <span
                className={`self-start rounded-md px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.12em] uppercase ${style.tag}`}
              >
                {String(i + 1).padStart(2, "0")} · {lane.tag}
              </span>
              <h3 className="mt-4 font-display text-xl leading-snug font-semibold">{lane.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{lane.body}</p>
              <ul className="mt-auto space-y-1.5 pt-5 font-mono text-xs text-text">
                {lane.points.map((p) => (
                  <li key={p}>
                    <span className="mr-2 text-volt">→</span>
                    {p}
                  </li>
                ))}
              </ul>
              {i < dict.lanes.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-4 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-night font-mono text-pulse lg:flex"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-line bg-surface/60 p-6">
          <h3 className="font-display text-lg font-semibold">📈 {dict.stockRewards.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{dict.stockRewards.body}</p>
        </div>
        <div className="rounded-3xl border border-down/30 bg-down/5 p-6">
          <h3 className="font-display text-lg font-semibold">{dict.never.title}</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {dict.never.items.map((item) => (
              <li key={item} className="text-muted">
                <span className="mr-2 font-mono text-down">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-volt/30 bg-volt/5 p-6 sm:p-8">
        <h3 className="font-display text-xl font-semibold">💹 {dict.wealth.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{dict.wealth.body}</p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {dict.wealth.items.map((w, i) => (
            <li key={w.title} className="rounded-2xl border border-line bg-night/60 p-4">
              <span className="font-mono text-xs text-volt">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 font-display font-semibold">{w.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                <MoneyText template={w.body} usd={1} />
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-faint">{dict.wealth.note}</p>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.disclaimer}</p>
    </Section>
  );
}
