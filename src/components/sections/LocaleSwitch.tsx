"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { LOCALE_STORAGE_KEY, negotiateLocale } from "@/i18n/negotiate";

function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this visit only.
  }
}

/** EN/FR switch. An explicit click is remembered and wins over browser settings next time. */
export function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <nav aria-label={label} className="flex rounded-lg border border-line p-0.5 font-mono text-xs">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}/`}
          hrefLang={l}
          lang={l}
          onClick={() => saveLocale(l)}
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
  );
}

const HINTS: Record<Locale, { text: string; cta: string; dismiss: string }> = {
  en: { text: "This site is also available in English.", cta: "Switch to English", dismiss: "Stay here" },
  fr: { text: "Ce site existe aussi en français.", cta: "Passer en français", dismiss: "Rester ici" },
};

/**
 * Shared links keep their language, but when the visitor's browser prefers another supported
 * language and they never chose one, we offer it once (in that language) instead of redirecting.
 */
export function LocaleHint({ locale }: { locale: Locale }) {
  const [suggested, setSuggested] = useState<Locale | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved) return;
    const best = negotiateLocale(navigator.languages ?? [navigator.language], locales, locale) as Locale;
    // Deferred so the hint never blocks first paint.
    const id = window.setTimeout(() => setSuggested(best !== locale ? best : null), 600);
    return () => window.clearTimeout(id);
  }, [locale]);

  if (!suggested) return null;
  const hint = HINTS[suggested];
  return (
    <div role="region" aria-label={hint.text} lang={suggested} className="border-b border-volt/30 bg-volt/10 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-center">
        <span>{hint.text}</span>
        <Link
          href={`/${suggested}/${typeof window === "undefined" ? "" : window.location.search}`}
          onClick={() => saveLocale(suggested)}
          className="font-semibold text-volt underline underline-offset-4"
        >
          {hint.cta}
        </Link>
        <button
          type="button"
          onClick={() => {
            saveLocale(locale);
            setSuggested(null);
          }}
          className="text-muted hover:text-text"
        >
          {hint.dismiss}
        </button>
      </div>
    </div>
  );
}
