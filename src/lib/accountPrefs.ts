import * as z from "zod/mini";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * The VVake account's app preferences (GET /v1/me `prefs`, set in the app under You → Settings): "system" means each
 * device's own setting. Anything malformed or unknown is dropped, never an error.
 */
export const accountPrefsSchema = z.object({
  prefs: z.optional(
    z.catch(
      z.nullable(
        z.object({
          lang: z.optional(z.catch(z.nullable(z.string()), null)),
          theme: z.optional(z.catch(z.nullable(z.string()), null)),
          timeFormat: z.optional(z.catch(z.nullable(z.string()), null)),
          dateFormat: z.optional(z.catch(z.nullable(z.string()), null)),
        }),
      ),
      null,
    ),
  ),
});
export type AccountPrefs = NonNullable<z.infer<typeof accountPrefsSchema>["prefs"]>;

/** The account's language when it differs from the page's (null: the same, "system", or unknown). */
export function accountLangOffer(page: Locale, prefs: AccountPrefs | null | undefined): Locale | null {
  const l = prefs?.lang;
  return l && isLocale(l) && l !== page ? l : null;
}

/** The offer, written in the account's language (like the locale hint). */
export const ACCOUNT_LANG_TEXT: Record<Locale, { text: string; cta: string }> = {
  en: { text: "Your VVake account is set to English.", cta: "Show this page in English" },
  fr: { text: "Ton compte VVake est en français.", cta: "Afficher cette page en français" },
};

/** The region of a BCP 47 locale ("fr-CA" → "CA", "en" → undefined): what "system" means for dates. */
export function regionOf(locale: string | undefined | null): string | undefined {
  const parts = (locale ?? "").replace(/_/g, "-").split("-");
  return parts
    .slice(1)
    .find((p) => /^[A-Za-z]{2}$/.test(p) || /^\d{3}$/.test(p))
    ?.toUpperCase();
}
