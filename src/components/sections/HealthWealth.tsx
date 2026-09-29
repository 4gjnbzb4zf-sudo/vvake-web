import { InView } from "@/components/ui/InView";
import { MoneyText } from "@/components/ui/Money";
import { Container } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

/** Twelve weeks of a steady habit: fitness climbs, and so do the player's own contributions (not returns). */
const FIT = [18, 24, 27, 33, 36, 42, 45, 49, 55, 58, 63, 68];
const INV = [4, 8, 12, 17, 21, 26, 30, 34, 39, 44, 48, 53];
const path = (ys: readonly number[]) => ys.map((y, i) => `${i ? "L" : "M"}${20 + i * 40} ${150 - y * 1.8}`).join(" ");

/** "Health and wealth, better together": the core promise of VVake Fit, right under the highlights. */
export function HealthWealth({ dict }: { dict: Dictionary["healthWealth"] }) {
  return (
    <section className="py-10" aria-labelledby="health-wealth-title">
      <Container>
        <div className="grid items-center gap-8 rounded-[2rem] border border-line bg-gradient-to-br from-pulse/10 via-transparent to-mint/15 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] uppercase">
              <span className="text-pulse-fg">♥ Health</span> <span className="text-faint">×</span>{" "}
              <span className="text-mint-fg">Wealth 📈</span>
            </p>
            <h2 id="health-wealth-title" className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
              {dict.title}
            </h2>
            <p className="mt-4 leading-relaxed text-muted">{dict.body}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {dict.stats.map((s) => (
                <li key={s.label} className="rounded-2xl border border-line bg-night/60 p-3">
                  <p className="font-display text-2xl font-bold">
                    <MoneyText template={s.value} usd={1} />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted">{s.label}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <InView>
              <svg viewBox="0 0 480 170" className="w-full" role="img" aria-label={`${dict.fitness} / ${dict.invested}`}>
                {[30, 70, 110, 150].map((y) => (
                  <path key={y} d={`M10 ${y} H470`} stroke="#343a41" strokeDasharray="3 5" />
                ))}
                <path
                  d={path(FIT)}
                  stroke="#ff3d6e"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  className="draw-on-view"
                />
                <path
                  d={path(INV)}
                  stroke="#5bd08a"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  className="draw-on-view [animation-delay:400ms]"
                />
                <circle cx={20 + 11 * 40} cy={150 - FIT[11]! * 1.8} r="6" fill="#ff3d6e" className="animate-pulse-glow" />
                <circle cx={20 + 11 * 40} cy={150 - INV[11]! * 1.8} r="6" fill="#5bd08a" className="animate-pulse-glow" />
              </svg>
            </InView>
            <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
              <span className="inline-flex items-center gap-2">
                <i className="h-1 w-5 rounded bg-pulse" aria-hidden="true" /> {dict.fitness}
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-1 w-5 rounded bg-[#5bd08a]" aria-hidden="true" /> {dict.invested}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">{dict.disclaimer}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
