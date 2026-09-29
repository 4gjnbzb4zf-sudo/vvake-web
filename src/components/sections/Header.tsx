import Link from "next/link";
import { Logo, VVMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { CurrencySelect } from "@/components/ui/Money";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleHint, LocaleSwitch } from "./LocaleSwitch";
import type { Locale } from "@/i18n/config";
import { pageHref, sectionHref } from "@/lib/routes";
import type { Dictionary } from "@/i18n/dictionaries";

/** "VVaker" in the menu is written with the logo's VV. */
function NavLabel({ label }: { label: string }) {
  if (!label.startsWith("VV")) return <>{label}</>;
  return (
    <span className="inline-flex items-baseline" aria-label={label}>
      <VVMark className="mr-px h-[1.15em] translate-y-[0.2em]" />
      <span aria-hidden="true">{label.slice(2)}</span>
    </span>
  );
}

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary["nav"] }) {
  const links = [
    { href: pageHref(locale, "app/"), label: dict.app },
    { href: pageHref(locale, "vvaker/"), label: dict.vvaker },
    { href: pageHref(locale, "backers/"), label: dict.backers },
    { href: sectionHref(locale, "faq"), label: dict.faq },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-night/75 backdrop-blur-xl supports-[backdrop-filter]:bg-night/60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded-lg focus:bg-volt focus:px-3 focus:py-2 focus:text-ink"
      >
        {dict.skip}
      </a>
      <LocaleHint locale={locale} />
      <Container className="flex h-16 items-center justify-between gap-3 sm:gap-6">
        <Link href={`/${locale}/`} aria-label="VVake" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-5 font-mono text-[0.72rem] tracking-[0.12em] whitespace-nowrap text-muted uppercase xl:gap-7">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="border-b-2 border-transparent py-1 transition-colors hover:border-volt-fg hover:text-text">
                  <NavLabel label={l.label} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitch locale={locale} label={dict.language} />
          {/* On phones these two live in the menu, so the bar fits 375 px. */}
          <div className="hidden items-center gap-3 sm:flex">
            <CurrencySelect label={dict.currency} />
            <ThemeToggle labels={{ light: dict.themeLight, dark: dict.themeDark }} />
          </div>
          <details className="group relative lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg border border-line px-3 font-mono text-xs tracking-[0.12em] text-muted uppercase hover:text-text [&::-webkit-details-marker]:hidden">
              {dict.menu} <span className="ml-1.5 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <ul className="absolute right-0 mt-2 w-52 space-y-1 rounded-2xl border border-line bg-night/95 p-2 font-mono text-xs tracking-[0.12em] uppercase shadow-xl backdrop-blur-xl">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="block rounded-lg px-3 py-2.5 text-muted hover:bg-surface hover:text-text">
                    <NavLabel label={l.label} />
                  </a>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-line px-1 pt-2 sm:hidden">
                <CurrencySelect label={dict.currency} />
                <ThemeToggle labels={{ light: dict.themeLight, dark: dict.themeDark }} />
              </li>
              <li className="sm:hidden">
                <a href={`/${locale}/#unlock`} className="block rounded-lg bg-pulse px-3 py-2.5 text-ink">
                  {dict.join}
                </a>
              </li>
            </ul>
          </details>
          <div className="hidden sm:block">
            <ButtonLink href={`/${locale}/#unlock`} className="h-10 px-4 whitespace-nowrap">
              {dict.join}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}
