"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { castImage, HERO_PAIRS, type CastId } from "@/lib/personas";

// A different pair at each page load: picked once per load in the browser (the server render shows the first).
const pick = typeof window === "undefined" ? 0 : Math.floor(Math.random() * HERO_PAIRS.length);
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
  const [woman, man] = HERO_PAIRS[i]!;
  return (
    <div key={i} className="relative flex h-full items-end">
      <Cast id={man} className="relative z-0 h-[88%] w-auto" />
      <Cast id={woman} priority className="relative z-10 -ml-[12%] h-full w-auto" />
    </div>
  );
}
