import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary["nav"] }) {
  const links = [
    { href: "#story", label: dict.story },
    { href: "#how", label: dict.how },
    { href: "#rivalries", label: dict.rivalries },
    { href: "#open-book", label: dict.openBook },
    { href: "#vvaker", label: dict.vvaker },
    { href: "#faq", label: dict.faq },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-night/75 backdrop-blur-xl supports-[backdrop-filter]:bg-night/60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded-lg focus:bg-volt focus:px-3 focus:py-2 focus:text-night"
      >
        {dict.skip}
      </a>
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href={`/${locale}/`} aria-label="VVake" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm text-muted">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-text">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <nav aria-label={dict.language} className="flex rounded-lg border border-line p-0.5 font-mono text-xs">
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}/`}
                hrefLang={l}
                lang={l}
                aria-current={l === locale ? "true" : undefined}
                title={localeLabels[l]}
                className={
                  l === locale
                    ? "rounded-md bg-surface-2 px-2.5 py-1.5 text-text"
                    : "rounded-md px-2.5 py-1.5 text-faint transition-colors hover:text-text"
                }
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
          <div className="hidden sm:block">
            <ButtonLink href="#unlock" className="h-10 px-4">
              {dict.join}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}
