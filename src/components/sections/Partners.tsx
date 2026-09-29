import { buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/dictionaries";

const ICONS = ["⚡", "🎟️", "🏃", "🏟️"] as const;

/** Partner pitch with a pre-filled email (the site is static, so no form backend is needed). */
export function Partners({ dict, index }: { dict: Dictionary["partners"]; index: string }) {
  const mailto = `mailto:${siteConfig.partnersEmail}?subject=${encodeURIComponent(dict.emailSubject)}&body=${encodeURIComponent(dict.emailBody)}`;
  return (
    <Section id="partners" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {dict.offers.map((o, i) => (
          <li
            key={o.title}
            className="flex gap-4 rounded-3xl border border-line bg-surface/60 p-6 transition-colors hover:border-volt-fg/40"
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-night text-2xl"
            >
              {ICONS[i % ICONS.length]}
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">{o.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{o.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-6 rounded-3xl border border-volt-fg/30 bg-volt/5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap gap-2">
          {dict.promises.map((p) => (
            <li key={p} className="rounded-full border border-line bg-night px-3.5 py-1.5 font-mono text-xs text-muted">
              <span className="mr-1.5 text-volt-fg">✓</span>
              {p}
            </li>
          ))}
        </ul>
        <div className="shrink-0 text-center lg:text-right">
          <a href={mailto} className={buttonClass("primary")}>
            {dict.cta} →
          </a>
          <p className="mt-2 text-xs text-faint">
            {dict.or}{" "}
            <a href={`mailto:${siteConfig.partnersEmail}`} className="text-muted underline underline-offset-4 hover:text-text">
              {siteConfig.partnersEmail}
            </a>
          </p>
        </div>
      </div>
    </Section>
  );
}
