"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { castImage, HERO_PAIRS, type CastId } from "@/lib/personas";

// A different pair at each page load, picked once per load in the browser (the server render shows the first).
// Who stands on the left and who's taller also vary, so neither the woman nor the man always leads.
const pick = typeof window === "undefined" ? 0 : Math.floor(Math.random() * HERO_PAIRS.length * 4);
const noop = () => () => {};

function Cast({ id, className, priority }: { id: CastId; className: string; priority?: boolean }) {
  const img = castImage(id);
  return <Image src={img.src} width={img.w} height={img.h} alt="" priority={priority} className={className} />;
}

/** A woman and a man of the cast throwing the sign, in front of the phone. */
export function HeroPersona() {
  const i = useSyncExternalStore(
    noop,
    () => pick,
    () => 0,
  );
  const [woman, man] = HERO_PAIRS[i % HERO_PAIRS.length]!;
  const variant = Math.floor(i / HERO_PAIRS.length); // 0–3: which side, who's taller
  const [back, front] = variant % 2 === 0 ? [man, woman] : [woman, man];
  const frontTaller = variant < 2;
  return (
    <div key={i} className="relative flex h-full items-end">
      <Cast id={back} className={`relative z-0 w-auto ${frontTaller ? "h-[88%]" : "h-full"}`} />
      <Cast id={front} priority className={`relative z-10 -ml-[12%] w-auto ${frontTaller ? "h-full" : "h-[90%]"}`} />
    </div>
  );
}
