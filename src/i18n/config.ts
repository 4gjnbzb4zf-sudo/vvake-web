export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const localeLabels: Record<Locale, string> = { en: "English", fr: "Français" };
export const ogLocales: Record<Locale, string> = { en: "en_US", fr: "fr_FR" };
