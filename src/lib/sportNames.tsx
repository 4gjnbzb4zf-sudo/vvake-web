"use client";

import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { VVakerSport } from "@/components/vvaker/traits";

/**
 * Regional sport names: the page language picks the dictionary (EN/FR), the visitor's browser region
 * adjusts the few names that differ. Football is "soccer" in North America (Québec included), padel is
 * rare there while pickleball is everywhere, and "muscu" is French-from-France slang.
 */
const REGIONAL: Record<string, Partial<Record<VVakerSport, string>>> = {
  "en-US": { footballer: "Soccer", racket: "Tennis & pickleball" },
  "en-CA": { footballer: "Soccer", racket: "Tennis & pickleball" },
  "fr-CA": { footballer: "Soccer", racket: "Tennis & pickleball", lifter: "Musculation" },
};

function region(): string | null {
  const tag = (typeof navigator !== "undefined" && (navigator.languages?.[0] ?? navigator.language)) || "";
  return tag.split("-")[1]?.toUpperCase() ?? null;
}
const noop = () => () => {};

/** Returns a function giving the name to show for a sport in this visitor's language and region. */
export function useSportLabel(): (sport: VVakerSport, fallback: string) => string {
  const { lang } = useParams<{ lang: string }>();
  const r = useSyncExternalStore(noop, region, () => null);
  const overrides = r ? REGIONAL[`${lang}-${r}`] : undefined;
  return (sport, fallback) => overrides?.[sport] ?? fallback;
}

export function SportName({ sport, name }: { sport: VVakerSport; name: string }) {
  const label = useSportLabel();
  return <>{label(sport, name)}</>;
}
