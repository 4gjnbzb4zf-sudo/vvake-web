import { Container, Kicker } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { sectionHref } from "@/lib/routes";

/** Home page, right under the hero: what's in it for you, in three cards. */
export function Benefits({ locale, dict }: { locale: Locale; dict: Dictionary["benefits"] }) {
  return (
    <section id="benefits" aria-labelledby="benefits-title" className="relative py-16 sm:py-20">
      <Container>
        <Kicker>{dict.kicker}</Kicker>
        <h2 id="benefits-title" className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          {dict.title}
        </h2>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {dict.items.map((item) => (
            <li key={item.target} className="flex flex-col rounded-3xl border border-line bg-surface/60 p-6">
              <span aria-hidden="true" className="text-3xl">
                {item.icon}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
              <a href={sectionHref(locale, item.target)} className="group mt-auto pt-5 font-display text-sm font-semibold text-pulse-fg">
                {item.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
