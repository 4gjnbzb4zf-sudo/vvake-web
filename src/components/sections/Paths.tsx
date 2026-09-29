import { Container } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pageHref, type Page } from "@/lib/routes";
import { cn } from "@/lib/cn";

const TONES: Record<string, string> = {
  try: "hover:border-volt-fg/60 [&_[data-cta]]:text-volt-fg",
  learn: "hover:border-sky-fg/60 [&_[data-cta]]:text-sky-fg",
  back: "hover:border-pulse-fg/60 [&_[data-cta]]:text-pulse-fg",
};

/** Home page: three ways to go deeper, one per page (the app, your VVaker, backers). */
export function Paths({ locale, dict }: { locale: Locale; dict: Dictionary["paths"] }) {
  return (
    <nav aria-label={dict.label} className="relative border-t border-line/60 py-16 sm:py-20">
      <Container>
        <p className="mb-6 font-display text-2xl font-semibold sm:text-3xl">{dict.label}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {dict.items.map((item) => (
            <li key={item.key}>
              <a
                href={pageHref(locale, item.page as Page)}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border border-line bg-surface/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface",
                  TONES[item.key],
                )}
              >
                <p className="flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">
                  <span aria-hidden="true" className="text-base">
                    {item.icon}
                  </span>
                  {item.kicker}
                </p>
                <p className="mt-3 font-display text-lg leading-tight font-semibold">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
                <p data-cta className="mt-auto pt-4 font-display text-sm font-semibold">
                  {item.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </p>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
