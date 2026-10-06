import { regionOf, type AccountPrefs } from "./accountPrefs";
import type { ClockChoice, DateFormatPrefs, DateOrderChoice } from "./datetime";
import type { Locale } from "@/i18n/config";

/**
 * How this visitor reads dates (the rewards pages): the page's language for the words, the browser's region and clock
 * for "system", and, when signed in, the account's choices from the app (You → Settings → Time format, Date format).
 * Browser-only reads are guarded (prerendering has no navigator): the defaults are then the language's.
 */
export function visitorDatePrefs(lang: Locale, account?: AccountPrefs | null): DateFormatPrefs {
  let region: string | undefined;
  let hour12: boolean | undefined;
  try {
    if (typeof navigator !== "undefined") region = regionOf(navigator.language);
    const hc = (Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions() as { hourCycle?: string }).hourCycle;
    if (typeof navigator !== "undefined" && hc) hour12 = hc === "h11" || hc === "h12";
  } catch {
    // defaults
  }
  const tf = account?.timeFormat;
  const df = account?.dateFormat;
  return {
    lang,
    ...(region ? { region } : {}),
    ...(tf === "12h" || tf === "24h" || tf === "system" ? { timeFormat: tf as ClockChoice } : {}),
    ...(df === "dmy" || df === "mdy" || df === "ymd" || df === "system" ? { dateFormat: df as DateOrderChoice } : {}),
    system: { hour12 },
  };
}
