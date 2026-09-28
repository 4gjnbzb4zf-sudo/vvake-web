import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { LocaleHint, LocaleSwitch } from "./LocaleSwitch";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary["nav"] }) {
  const links = [
    { href: "#why", label: dict.why },
    { href: "#earn", label: dict.earn },
    { href: "#how", label: dict.play },
    { href: "#vvaker", label: dict.vvaker },
    { href: "#rwa", label: dict.web3 },
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
          <ul className="flex items-center gap-5 font-mono text-[0.72rem] tracking-[0.12em] whitespace-nowrap text-muted uppercase xl:gap-7">
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
          <details className="group relative lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg border border-line px-3 font-mono text-xs tracking-[0.12em] text-muted uppercase hover:text-text [&::-webkit-details-marker]:hidden">
              {dict.menu} <span className="ml-1.5 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <ul className="absolute right-0 mt-2 w-52 space-y-1 rounded-2xl border border-line bg-night/95 p-2 font-mono text-xs tracking-[0.12em] uppercase shadow-xl backdrop-blur-xl">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="block rounded-lg px-3 py-2.5 text-muted hover:bg-surface hover:text-text">
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="sm:hidden">
                <a href="#unlock" className="block rounded-lg bg-pulse px-3 py-2.5 text-night">
                  {dict.join}
                </a>
              </li>
            </ul>
          </details>
          <div className="hidden sm:block">
            <ButtonLink href="#unlock" className="h-10 px-4 whitespace-nowrap">
              {dict.join}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}
