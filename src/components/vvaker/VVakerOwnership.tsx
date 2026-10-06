"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { RewardsSession, type MyVVaker, type VVakerOwner } from "@/lib/rewardsApi";

type Dict = Dictionary["vvaker"]["persona"]["ownership"];

/**
 * VVaker ownership on the site (monorepo ADR-0026): when this tab is signed in (the Rewards page's session), says
 * whether the look on screen is free, yours, or someone else's (then "change one detail" with the nearest free look),
 * and lists the visitor's own VVakers read-only. Signed out, it can't know: it says where to sign in. Another
 * account's render is never fetched: the API serves renders only to their owner, and only "My VVakers" are shown.
 * Choosing and rendering happen in the app.
 */
export function VVakerOwnership({
  dict,
  lang,
  apiUrl,
  code,
  cast,
  onTry,
}: {
  dict: Dict;
  lang: Locale;
  apiUrl: string;
  code: string;
  /** The look on screen is one of the site's cast (free for everyone). */
  cast: boolean;
  onTry: (code: string) => void;
}) {
  const [session] = useState(() => new RewardsSession(apiUrl));
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [owner, setOwner] = useState<{ code: string; state: VVakerOwner } | null>(null);
  const [mine, setMine] = useState<MyVVaker[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    // Signed in on this tab (the Rewards page's session), or not: the answer comes after the refresh.
    const resumed = RewardsSession.hasStored() ? session.resume() : Promise.resolve(false);
    void resumed.then(async (ok) => {
      if (!alive) return;
      setSignedIn(ok);
      if (!ok) return;
      const list = await session.myVVakers().catch(() => [] as MyVVaker[]);
      if (!alive) return;
      setMine(list);
      for (const v of list) {
        for (const r of v.renders) {
          if (r.status !== "ready" || !r.imageUrl) continue;
          const src = await session.vvakerImage(r.imageUrl);
          if (!alive) return;
          if (src) setImages((m) => ({ ...m, [r.id]: src }));
        }
      }
    });
    return () => {
      alive = false;
    };
  }, [session]);

  // The look on screen, checked a moment after the last change (not on every chip tap).
  useEffect(() => {
    if (!signedIn || cast) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void session.vvakerOwner(code).then(
        (state) => alive && setOwner({ code, state }),
        () => undefined,
      );
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [session, signedIn, code, cast]);

  if (signedIn === null) return null;
  const state = owner?.code === code ? owner.state : null;
  const versions = mine.flatMap((v) =>
    v.renders.filter((r) => r.status === "ready").map((r) => ({ ...r, code: v.code, on: v.current && !!r.current })),
  );

  return (
    <div className="mx-auto mt-4 max-w-[460px] space-y-3" aria-live="polite">
      {!signedIn ? (
        <p className="text-xs leading-relaxed text-muted">
          {dict.signedOut}{" "}
          <a href={`/${lang}/rewards/`} className="text-volt-fg underline underline-offset-4">
            {dict.signIn}
          </a>
        </p>
      ) : cast ? (
        <p className="text-xs text-muted">{dict.cast}</p>
      ) : !state ? (
        <p className="text-xs text-faint">{dict.checking}</p>
      ) : state.owner === "someone" ? (
        <div className="rounded-2xl border border-down-fg/40 bg-down/5 p-4">
          <p className="text-sm text-text">{dict.taken}</p>
          {state.suggestion && (
            <button
              type="button"
              onClick={() => onTry(state.suggestion!)}
              className="mt-2 font-mono text-sm text-volt-fg underline underline-offset-4"
            >
              {dict.tryIt.replace("{code}", state.suggestion)}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">{state.owner === "you" ? dict.mine : dict.free}</p>
      )}

      {signedIn && versions.length > 0 && (
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">{dict.mineTitle}</p>
          <ul className="mt-2 flex snap-x gap-2 overflow-x-auto pb-2">
            {versions.map((r) => (
              <li key={r.id} className="shrink-0 snap-start">
                <div
                  className={cn(
                    "flex h-28 w-20 flex-col items-center justify-end overflow-hidden rounded-xl border bg-surface p-1",
                    r.on ? "border-volt-fg" : "border-line",
                  )}
                  title={r.code}
                >
                  {images[r.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[r.id]} alt={r.code} className="h-20 w-auto object-contain" />
                  ) : (
                    <span className="h-20" />
                  )}
                  <span className={cn("text-[0.6rem]", r.on ? "text-volt-fg" : "text-faint")}>
                    {r.on ? dict.current : r.createdAt.slice(0, 10)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">{dict.mineNote}</p>
        </div>
      )}
    </div>
  );
}
