/**
 * Picks the best supported locale from the visitor's ordered language list.
 * Kept dependency-free: it is also serialised into the inline redirect script at "/".
 */
export function negotiateLocale(preferred: readonly string[], supported: readonly string[], fallback: string): string {
  for (const tag of preferred) {
    const primary = String(tag).toLowerCase().split("-")[0];
    if (primary && supported.includes(primary)) return primary;
  }
  return fallback;
}

export const LOCALE_STORAGE_KEY = "vvake-locale";
