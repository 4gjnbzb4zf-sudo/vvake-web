"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { castImage, HERO_MEN, HERO_WOMEN, type CastId } from "@/lib/personas";

interface Duo {
  woman: CastId;
  man: CastId;
  womanLeft: boolean;
  womanTaller: boolean;
}

const FIRST: Duo = { woman: HERO_WOMEN[0]!, man: HERO_MEN[0]!, womanLeft: false, womanTaller: false };
const LAST_KEY = "vvake-hero-duo";
const any = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

/**
 * Drawn once per page load in the browser (the server render shows FIRST): any woman with any man, never the
 * same duo as the previous visit, and a separate coin flip for who stands left and who's taller.
 */
function draw(): Duo {
  let last = "";
  try {
    last = sessionStorage.getItem(LAST_KEY) ?? "";
  } catch {
    // Storage unavailable: repeats are just a little more likely.
  }
  let woman = any(HERO_WOMEN);
  let man = any(HERO_MEN);
  for (let tries = 0; `${woman}|${man}` === last && tries < 10; tries++) {
    woman = any(HERO_WOMEN);
    man = any(HERO_MEN);
  }
  try {
    sessionStorage.setItem(LAST_KEY, `${woman}|${man}`);
  } catch {
    // ignore
  }
  return { woman, man, womanLeft: Math.random() < 0.5, womanTaller: Math.random() < 0.5 };
}

const duo = typeof window === "undefined" ? FIRST : draw();
const noop = () => () => {};

function Cast({ id, tall, className }: { id: CastId; tall: boolean; className: string }) {
  const img = castImage(id);
  return (
    <Image
      src={img.src}
      width={img.w}
      height={img.h}
      alt=""
      loading="lazy"
      className={`${className} w-auto ${tall ? "h-full" : "h-[88%]"}`}
    />
  );
}

/** A woman and a man of the cast throwing the sign, in front of the phone. */
export function HeroPersona() {
  const d = useSyncExternalStore(
    noop,
    () => duo,
    () => FIRST,
  );
  const [left, right] = d.womanLeft ? [d.woman, d.man] : [d.man, d.woman];
  const tallLeft = d.womanLeft === d.womanTaller;
  return (
    <div key={`${d.woman}-${d.man}`} className="relative flex h-full items-end">
      <Cast id={left} tall={tallLeft} className="relative z-0" />
      <Cast id={right} tall={!tallLeft} className="relative z-10 -ml-[12%]" />
    </div>
  );
}
