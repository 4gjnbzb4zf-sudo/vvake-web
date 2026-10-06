"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, resolveTheme, themeChoice, type ThemeChoice } from "@/lib/theme";

const EVENT = "vvake-pref:theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** The choice as the inline theme script (or the last click) left it on <html>. */
function current(): ThemeChoice {
  return themeChoice(document.documentElement.dataset.themeChoice);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function prefersLight() {
  return typeof window.matchMedia === "function" && window.matchMedia(LIGHT_QUERY).matches;
}

function apply(choice: ThemeChoice) {
  const d = document.documentElement;
  d.dataset.themeChoice = choice;
  d.dataset.theme = resolveTheme(choice, prefersLight());
  window.dispatchEvent(new Event(EVENT));
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

const ICONS: Record<ThemeChoice, React.ReactNode> = {
  system: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  dark: <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />,
};

/**
 * System / Light / Dark. System (the default) follows the device's appearance, live; a pick is remembered in this
 * browser (the same three choices as You → Settings → Theme in the app).
 */
export function ThemeToggle({ labels }: { labels: { group: string; system: string; light: string; dark: string } }) {
  const choice = useSyncExternalStore(subscribe, current, () => "system" as ThemeChoice);

  useEffect(() => {
    // Other tabs: follow a choice made there. System: follow the device when its appearance changes.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) apply(themeChoice(readSaved()));
    };
    const mq = typeof window.matchMedia === "function" ? window.matchMedia(LIGHT_QUERY) : null;
    const onDevice = () => {
      if (current() === "system") apply("system");
    };
    window.addEventListener("storage", onStorage);
    mq?.addEventListener("change", onDevice);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq?.removeEventListener("change", onDevice);
    };
  }, []);

  const pick = (next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this page view only.
    }
    apply(next);
  };

  return (
    <div role="radiogroup" aria-label={labels.group} className="flex h-10 shrink-0 items-center rounded-lg border border-line p-0.5">
      {(["system", "light", "dark"] as const).map((c) => {
        const on = c === choice;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labels[c]}
            title={labels[c]}
            onClick={() => pick(c)}
            className={
              on
                ? "flex h-full w-8 items-center justify-center rounded-md bg-surface-2 text-text"
                : "flex h-full w-8 items-center justify-center rounded-md text-faint transition-colors hover:text-text"
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[c]}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
