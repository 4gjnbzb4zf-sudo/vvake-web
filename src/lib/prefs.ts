"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_TRAITS,
  VVAKER_BACKGROUNDS,
  VVAKER_LOOKS,
  sanitizeTraits,
  type VVakerBackground,
  type VVakerLook,
  type VVakerTraits,
} from "@/components/vvaker/traits";

/**
 * Per-visitor preferences kept in this browser only (localStorage): nothing is sent anywhere.
 * Reads can fail (private mode, blocked storage): the site then falls back to defaults.
 */
function createStore<T>(key: string, parse: (raw: string) => T | null, fallback: T) {
  const event = `vvake-pref:${key}`;
  let cacheRaw: string | null | undefined;
  let cacheValue = fallback;
  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw !== cacheRaw) {
      cacheRaw = raw;
      cacheValue = (raw !== null && parse(raw)) || fallback;
    }
    return cacheValue;
  };
  const subscribe = (onChange: () => void) => {
    window.addEventListener(event, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(event, onChange);
      window.removeEventListener("storage", onChange);
    };
  };
  return {
    use: () => useSyncExternalStore(subscribe, read, () => fallback),
    set: (value: T | null) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage unavailable: the choice lasts for this page view only.
      }
      window.dispatchEvent(new Event(event));
    },
  };
}

const lookStore = createStore<VVakerLook | null>(
  "vvake-look",
  (raw) => {
    const v = JSON.parse(raw) as unknown;
    return (VVAKER_LOOKS as readonly unknown[]).includes(v) ? (v as VVakerLook) : null;
  },
  null,
);
/** The style this visitor picked in the studio (null = no choice yet: the site shows a mix). */
export const useLookPref = lookStore.use;
export const setLookPref = lookStore.set;

export interface StudioState {
  traits: VVakerTraits;
  background: VVakerBackground;
}
const studioStore = createStore<StudioState>(
  "vvake-vvaker",
  (raw) => {
    const v = JSON.parse(raw) as Partial<StudioState>;
    if (!v || typeof v !== "object" || !v.traits || !(String(v.background) in VVAKER_BACKGROUNDS)) return null;
    return { traits: sanitizeTraits(v.traits), background: v.background as VVakerBackground };
  },
  { traits: DEFAULT_TRAITS, background: "night" },
);
/** The VVaker being built in the studio, restored on the next visit. */
export const useStudio = studioStore.use;
export const saveStudio = studioStore.set;
