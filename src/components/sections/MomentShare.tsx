"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { MOMENT_CAST, ordinal, readCityRank, type MomentKind } from "@/lib/moments";
import { castImage, type CastId } from "@/lib/personas";
import { parseReferralCode, referralAppUrl } from "@/lib/referralLink";

/**
 * A moment shared from the app (/<lang>/m/<kind>/#<CODE>): the same look as its preview card (the dark pulse glow, the
 * volt kicker, the VVaker duo), so the post, the story and the page feel like one thing. Then VVake in one line, the
 * sharer's invite code when the link has one, and the way in: the app with the code, or the web app right now.
 * Nothing personal: the code comes from the hash; a city share may add a known city and its rank (?city=&rank=).
 */
export function MomentShare({
  kind,
  lang,
  dict,
  appScheme,
}: {
  kind: MomentKind;
  lang: Locale;
  dict: Pick<Dictionary, "moments" | "referral">;
  appScheme: string;
}) {
  const m = dict.moments.kinds[kind];
  const page = dict.moments.page;
  const r = dict.referral;
  const [code, setCode] = useState<string | null>(null);
  const [cityLine, setCityLine] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const read = () => {
      setCode(parseReferralCode(window.location.hash));
      const rank = kind === "city" ? readCityRank(window.location.search) : null;
      setCityLine(rank ? format(page.cityRank, { rank: ordinal(rank.rank, lang), city: rank.city }) : null);
    };
    const id = window.setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("hashchange", read);
    };
  }, [kind, lang, page.cityRank]);

  const copy = (c: string) => {
    void navigator.clipboard
      ?.writeText(c)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const web = `/${lang}/app/`;
  const early = `/${lang}/#unlock`;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-night">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,61,110,0.35),transparent_60%)]"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-end">
          <div className="p-6 text-left sm:flex-1 sm:p-10 sm:pr-4">
            <p className="font-mono text-xs tracking-[0.16em] text-faint">vvake.com</p>
            <p className="mt-6 inline-flex rounded-full border border-volt-fg/45 bg-surface/90 px-3 py-1 font-mono text-xs tracking-[0.16em] text-volt-fg uppercase">
              {m.ogKicker}
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight font-semibold break-words sm:text-5xl">{m.headline}</h1>
            <div aria-live="polite">{cityLine && <p className="mt-3 font-display text-2xl font-semibold text-volt-fg">{cityLine}</p>}</div>
            <p className="mt-4 leading-relaxed text-muted">{m.sub}</p>
            <p className="mt-4 font-display text-lg font-semibold text-pulse-fg">{m.ogLine} →</p>
          </div>
          <div aria-hidden className="flex h-56 shrink-0 items-end justify-center sm:h-80 sm:w-[42%]">
            {MOMENT_CAST[kind].map((id, i) => {
              const img = castImage(id as CastId);
              return (
                <Image
                  key={id}
                  src={img.src}
                  width={img.w}
                  height={img.h}
                  alt=""
                  priority
                  className={`w-auto ${i === 0 ? "relative z-10 h-full" : "relative z-0 -ml-[14%] h-[92%]"}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10">
        <p className="mx-auto max-w-md leading-relaxed text-text">{dict.moments.about}</p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
          {page.facts.map((f) => (
            <li key={f} className="rounded-full border border-line bg-surface px-3 py-1 text-muted">
              {f}
            </li>
          ))}
        </ul>

        {code && (
          <div className="mt-8">
            <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{r.code}</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.12em] text-pulse-fg select-all sm:text-5xl">{code}</p>
            <button type="button" onClick={() => copy(code)} className={buttonClass("ghost", "mt-3")}>
              {copied ? r.copied : r.copy}
            </button>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">{r.steps}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{r.bonus}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {code ? (
            <>
              <a href={referralAppUrl(appScheme, code)} className={buttonClass("primary")}>
                {page.open}
              </a>
              <a href={web} className={buttonClass("ghost")}>
                {page.tryWeb}
              </a>
            </>
          ) : (
            <a href={web} className={buttonClass("primary")}>
              {page.tryWeb}
            </a>
          )}
          <a href={early} className={buttonClass("ghost")}>
            {page.join}
          </a>
        </div>
        <p className="mx-auto mt-6 max-w-md text-sm text-muted">{page.fair}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-faint">{r.noApp}</p>
      </div>
    </div>
  );
}
