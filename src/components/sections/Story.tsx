import { Container, Kicker } from "@/components/ui/Section";
import { MoneyText } from "@/components/ui/Money";
import type { Dictionary } from "@/i18n/dictionaries";

export function Story({ dict, index }: { dict: Dictionary["story"]; index: string }) {
  return (
    <section
      id="story"
      aria-labelledby="story-title"
      data-nav={dict.nav}
      data-nav-index={index}
      className="relative border-t border-line/60 py-20 sm:py-28"
    >
      <Container className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div>
          <Kicker index={index}>{dict.kicker}</Kicker>
          <h2 id="story-title" className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            {dict.title}
          </h2>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
            {dict.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>

        <div className="self-center rounded-3xl border border-line bg-surface/70 p-6 sm:p-8">
          <h3 className="font-display text-lg font-semibold">{dict.fixesTitle}</h3>
          <ul className="mt-6 divide-y divide-line">
            {dict.fixes.map((f) => (
              <li key={f.was} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto_1.3fr] sm:items-center sm:gap-4">
                <span className="text-faint line-through decoration-down-fg/70">
                  <MoneyText template={f.was} usd={1000} />
                </span>
                <span className="hidden font-mono text-pulse-fg sm:block" aria-hidden="true">
                  →
                </span>
                <span className="font-medium text-text">{f.now}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
