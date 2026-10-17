"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "./AppContext";

/**
 * Your VVaker on every screen (the phone's useMyVVaker): your own render when the account has one (GET
 * /v1/vvaker/mine, the current render, read with your token as a data: URL: the page's img-src is 'self' and data:),
 * else the cast member you picked (castId), else the closest stand-in, the runner.
 */

/** The ready-made cast (VVFit packages/game-core cast.ts ids = public/personas file names). */
export const CAST_IDS = [
  "runner",
  "runner-f",
  "runner-m",
  "walker",
  "walker-f",
  "cyclist",
  "lifter",
  "lifter-f",
  "boxer",
  "boxer-f",
  "boxer-m",
  "yogi",
  "baller",
  "baller-f",
  "coder",
  "coder-m",
  "martial",
  "paddler",
  "meditator",
  "roller",
  "skater",
  "skater-f",
  "swimmer",
  "hiker",
  "hiker-f",
  "climber",
  "climber-f",
  "racket",
  "dancer",
  "dancer-m",
  "skier",
  "footballer",
  "footballer-f",
] as const;

export const castSrc = (id: string | null | undefined) =>
  `/personas/${id && (CAST_IDS as readonly string[]).includes(id) ? id : "runner"}.webp`;

let cachedRender: { key: string; src: string | null } | null = null;

/** The picture of your VVaker (a data: URL of your render, or the cast's file). */
export function useVVakerSrc(): { src: string; own: boolean } {
  const { me, session } = useApp();
  const key = `${me.id}:${me.castId ?? ""}:${me.vvakerCode ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; src: string | null } | null>(null);
  const cached = cachedRender?.key === key ? cachedRender.src : undefined;
  const render = cached !== undefined ? cached : loaded?.key === key ? loaded.src : null;
  useEffect(() => {
    if (cachedRender?.key === key) return;
    let alive = true;
    void session
      .myVVakers()
      .then(async (list) => {
        const cur = list.find((v) => v.current) ?? null;
        const r =
          cur?.renders.find((x) => x.current && x.status === "ready" && x.imageUrl) ??
          cur?.renders.find((x) => x.status === "ready" && x.imageUrl);
        const src = r?.imageUrl ? await session.vvakerImage(r.imageUrl) : null;
        cachedRender = { key, src };
        if (alive) setLoaded({ key, src });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, session]);
  return render ? { src: render, own: true } : { src: castSrc(me.castId), own: false };
}

/** Forget the cached render (after picking another VVaker). */
export const resetVVakerCache = () => {
  cachedRender = null;
};

export function VVakerImg({ className, alt, src }: { className?: string; alt: string; src?: string }) {
  const mine = useVVakerSrc();
  return (
    // A local or data: image (CSP img-src 'self' data:): next/image adds nothing for these.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src ?? mine.src} alt={alt} className={cn("object-contain", className)} draggable={false} />
  );
}
