import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { LocaleHint, LocaleSwitch } from "./LocaleSwitch";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary["nav"] }) {
  const links = [
    { href: "#challenges", label: dict.challenges },
    { href: "#crew", label: dict.crew },
    { href: "#app", label: dict.app },
    { href: "#rivalries", label: dict.rivalries },
    { href: "#open-book", label: dict.openBook },
    { href: "#vvaker", label: dict.vvaker },
    { href: "#partners", label: dict.partners },
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
      <LocaleHint locale={locale} />
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href={`/${locale}/`} aria-label="VVake" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6 font-mono text-[0.72rem] tracking-[0.14em] text-muted uppercase">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="border-b-2 border-transparent py-1 transition-colors hover:border-volt hover:text-text">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitch locale={locale} label={dict.language} />
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
