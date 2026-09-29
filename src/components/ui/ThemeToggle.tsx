"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, isTheme, resolveTheme, type Theme } from "@/lib/theme";

const EVENT = "vvake-pref:theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function current(): Theme {
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(EVENT));
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Light/dark switch. A click is remembered in this browser; until then the site follows the OS setting. */
export function ThemeToggle({ labels }: { labels: { light: string; dark: string } }) {
  const theme = useSyncExternalStore(subscribe, current, () => "dark" as Theme);

  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY);
    const onOsChange = () => apply(resolveTheme(readSaved(), media.matches));
    media.addEventListener("change", onOsChange);
    // Other tabs: follow a choice made there.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) onOsChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onOsChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? labels.light : labels.dark;
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Storage unavailable: the choice lasts for this page view only.
        }
        apply(next);
      }}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-text"
    >
      {theme === "dark" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
        </svg>
      )}
    </button>
  );
}
