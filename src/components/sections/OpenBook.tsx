import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const SEGMENT_COLORS = ["bg-volt", "bg-pulse", "bg-lilac", "bg-calm"] as const;
const TEXT_COLORS = ["text-volt-fg", "text-pulse-fg", "text-lilac-fg", "text-calm-fg"] as const;

export function OpenBook({ dict, index }: { dict: Dictionary["openBook"]; index: string }) {
  return (
    <Section id="open-book" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 rounded-3xl border border-line bg-surface/50 p-6 sm:p-8">
        <div
          className="flex h-5 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={dict.split.map((s) => `${s.label} ${s.value}%`).join(", ")}
        >
          {dict.split.map((s, i) => (
            <div key={s.label} className={SEGMENT_COLORS[i]} style={{ width: `${s.value}%` }} />
          ))}
        </div>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {dict.split.map((s, i) => (
            <div key={s.label}>
              <dt className="flex items-baseline gap-2">
                <span className={`font-display text-4xl font-bold ${TEXT_COLORS[i]}`}>{s.value}%</span>
                <span className="font-display text-base font-semibold">{s.label}</span>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{s.note}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 border-t border-line pt-5 font-mono text-sm text-text">{dict.promise}</p>
      </div>
    </Section>
  );
}
