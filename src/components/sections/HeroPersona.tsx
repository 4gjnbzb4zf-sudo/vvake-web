"use client";

import { useSyncExternalStore } from "react";
import { VVaker } from "@/components/vvaker/VVaker";
import { HERO_PERSONAS } from "@/lib/personas";

// A different VVaker at each page load: picked once per load in the browser (the server render shows the first).
const pick = typeof window === "undefined" ? 0 : Math.floor(Math.random() * HERO_PERSONAS.length);
const noop = () => () => {};

export function HeroPersona({ className }: { className?: string }) {
  const i = useSyncExternalStore(
    noop,
    () => pick,
    () => 0,
  );
  return <VVaker key={HERO_PERSONAS[i]} sport={HERO_PERSONAS[i]!} className={className} />;
}
