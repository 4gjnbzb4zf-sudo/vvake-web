import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const SEGMENT_COLORS = ["bg-volt", "bg-pulse", "bg-lilac", "bg-calm"] as const;
const TEXT_COLORS = ["text-volt-fg", "text-pulse-fg", "text-lilac-fg", "text-calm-fg"] as const;

/**
 * Where the money goes: one public split per source (Plus revenue, launchpad trading fees), never one split for
 * everything. A share that no published rule sets is left blank rather than guessed.
 */
export function OpenBook({ dict, index }: { dict: Dictionary["openBook"]; index: string }) {
  return (
    <Section id="open-book" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {dict.sources.map((source) => (
          <div key={source.name} className="rounded-3xl border border-line bg-surface/50 p-6 sm:p-8">
            <p className="font-display text-xl font-semibold">{source.name}</p>
            <p className="mt-1 font-mono text-xs tracking-[0.16em] text-faint uppercase">{source.basis}</p>
            <div
              className="mt-6 flex h-5 w-full overflow-hidden rounded-full bg-line"
              role="img"
              aria-label={source.split.map((s) => `${s.label} ${s.value}%`).join(", ")}
            >
              {source.split.map((s, i) => (
                <div key={s.label} className={SEGMENT_COLORS[i]} style={{ width: `${s.value}%` }} />
              ))}
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              {source.split.map((s, i) => (
                <div key={s.label}>
                  <dt className="flex items-baseline gap-2">
                    <span className={`font-display text-4xl font-bold ${TEXT_COLORS[i]}`}>{s.value}%</span>
                    <span className="font-display text-base font-semibold">{s.label}</span>
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{s.note}</dd>
                </div>
              ))}
            </dl>
            {source.note && <p className="mt-6 text-sm leading-relaxed text-muted">{source.note}</p>}
          </div>
        ))}
      </div>
      <p className="mt-8 border-t border-line pt-5 font-mono text-sm text-text">{dict.promise}</p>
    </Section>
  );
}
