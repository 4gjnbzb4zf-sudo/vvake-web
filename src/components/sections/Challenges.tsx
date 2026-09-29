import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";

const TAG_STYLES = [
  "bg-down text-ink",
  "bg-pulse text-ink",
  "bg-butter text-ink",
  "bg-volt text-ink",
  "bg-lilac text-ink",
  "bg-mint text-ink",
] as const;

export function Challenges({ dict, index }: { dict: Dictionary["challenges"]; index: string }) {
  return (
    <Section id="challenges" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dict.items.map((c, i) => (
          <li
            key={c.tag}
            className="group relative flex flex-col rounded-3xl border border-line bg-surface/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:-rotate-[0.6deg] hover:border-pulse-fg/40"
          >
            <span
              className={`inline-flex -rotate-2 self-start rounded-md px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.12em] uppercase ${TAG_STYLES[i % TAG_STYLES.length]}`}
            >
              {c.tag}
            </span>
            <h3 className="mt-4 font-display text-xl leading-snug font-semibold">{c.title}</h3>
            <dl className="mt-5 space-y-2.5 text-sm">
              <Row label={dict.goal} value={c.goal} />
              <Row label={dict.window} value={c.window} />
              <Row label={dict.reward} value={c.reward} highlight />
            </dl>
          </li>
        ))}
      </ul>

      <div className="mt-12 grid items-center gap-8 rounded-[2rem] border border-line bg-night-2 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative mx-auto w-full max-w-[260px]">
          <div className="absolute inset-0 rounded-full bg-pulse/20 blur-3xl" aria-hidden="true" />
          <VVaker color="candy" eyes="star" mouth="grin" accessory="medal" energy={4} className="relative w-full" />
        </div>
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-volt-fg uppercase">{dict.results.example}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{dict.results.title}</h3>
          <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface/70">
            {dict.results.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="font-display text-lg font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-faint">{dict.results.note}</p>
        </div>
      </div>

      <div className="relative mt-12 overflow-hidden rounded-[2rem] bg-pulse px-6 py-10 text-center text-ink sm:px-10">
        <div className="hazard pointer-events-none absolute -top-2 left-8 h-6 w-40 opacity-40" aria-hidden="true" />
        <p className="mx-auto max-w-2xl font-display text-3xl leading-tight font-bold italic sm:text-4xl">{dict.cta.title}</p>
        <ButtonLink href="#unlock" className="mt-6 bg-night text-text shadow-none hover:bg-night-2 focus-visible:outline-night">
          {dict.cta.button} →
        </ButtonLink>
      </div>
    </Section>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <dt className="font-mono text-[0.68rem] tracking-[0.14em] text-faint uppercase">{label}</dt>
      <dd className={highlight ? "text-right font-semibold text-volt-fg" : "text-right text-text"}>{value}</dd>
    </div>
  );
}
