"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/rewardsApi";
import { PLACES_ATTRIBUTION, PLACES_LICENSE_URL } from "@/lib/webapp/places";
import type { NotesView } from "@/lib/webapp/livingApi";
import {
  checkPlaceNote,
  PLACE_NOTE_TAG_TEXT,
  PLACE_NOTE_TAGS,
  PLACE_NOTE_TAGS_MAX,
  PLACE_NOTE_TEXT,
  PLACE_NOTE_TEXT_MAX,
  placeAggregateLine,
  placeNoteProblemText,
  type PlaceAggregate,
  type PlaceNoteProblem,
  type PlaceNoteTag,
} from "@/lib/webapp/living/placeNotes";
import { sportLabel } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { useLiving } from "./Journey";
import { Btn, Card, H1, Kicker, Small } from "./ui";

/**
 * Rate a spot in 3 taps (VVFit living-app.md §6.1, docs/05-tech/places-and-meetups.md): stars, would you recommend it,
 * up to 4 tips from the list and, if you like, 80 characters of text (game-core checkPlaceNote and the UGC filter).
 * Anonymous: the note goes with the place's key only (an OpenStreetMap id, or a ~150 m map square), never the route or
 * the session. Offered after a web GPS workout by the next-step engine (rate_spot), and from a place in Spots.
 */

const ratedKey = (userId: string) => `vvake-app-rated-places:${userId}`;

/** The places this browser rated (keys only), so "New for you" leaves them out. */
export function ratedPlaces(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ratedKey(userId)) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function remember(userId: string, key: string) {
  try {
    localStorage.setItem(ratedKey(userId), JSON.stringify([...ratedPlaces(userId).filter((k) => k !== key), key].slice(-200)));
  } catch {
    // private mode: this visit only
  }
}

/** A place's notes as game-core's aggregate (for placeAggregateLine), or null below 3 notes. Pure. */
export function aggregateOf(v: NotesView | undefined | null): PlaceAggregate | null {
  if (!v?.shown || v.count < 3) return null;
  return {
    placeKey: v.placeKey ?? "",
    count: v.count,
    rating: v.rating ?? 0,
    recommendPct: v.recommendPct ?? 0,
    tags: v.tags.filter((t): t is { tag: PlaceNoteTag; count: number } => (PLACE_NOTE_TAGS as readonly string[]).includes(t.tag)),
    tips: v.tips.map((t) => ({ id: t.id ?? null, text: t.text })),
  };
}

export function PlaceNoteScreen({ placeKey, sport, fresh }: { placeKey: string; sport: string; fresh?: boolean }) {
  const { lang, go, me, fmt } = useApp();
  const { la, L } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const [rating, setRating] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [tags, setTags] = useState<PlaceNoteTag[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { pending: boolean }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const back = () => (window.history.length > 1 ? window.history.back() : go({ name: "today" }));
  const toggle = (t: PlaceNoteTag) =>
    setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : x.length >= PLACE_NOTE_TAGS_MAX ? x : [...x, t]));
  const input = { placeKey, sport, rating, recommend: recommend === true, tags, text };
  const checked = rating && recommend !== null ? checkPlaceNote(input) : null;
  const problem = checked && !checked.ok ? checked.problem : null;

  const send = async () => {
    if (!checked?.ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const n = checked.note;
      const r = await la.addNote({
        placeKey: n.placeKey,
        sport: n.sport,
        rating: n.rating,
        recommend: n.recommend,
        tags: n.tags,
        ...(n.text ? { text: n.text } : {}),
      });
      remember(me.id, n.placeKey);
      setDone({ pending: r.note?.textStatus === "pending" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        remember(me.id, placeKey);
        setMsg(PLACE_NOTE_TEXT.tooSoon[l]);
      } else if (e instanceof ApiError && e.status === 403) setMsg(L.notes.signIn);
      else if (e instanceof ApiError && e.status === 422) setMsg(placeNoteProblemText("abuse", l));
      else setMsg(L.notes.error);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="space-y-4 pt-6">
        <Card>
          <p className="font-display text-lg font-semibold">{PLACE_NOTE_TEXT.thanks[l]}</p>
          {done.pending && <Small className="mt-2">{PLACE_NOTE_TEXT.pending[l]}</Small>}
        </Card>
        <Btn big variant="volt" className="w-full" onClick={back}>
          {PLACE_NOTE_TEXT.done[l]}
        </Btn>
      </div>
    );

  return (
    <div className="space-y-4 pt-2">
      <button type="button" className="h-11 text-sm text-muted" onClick={back}>
        ‹ {L.notes.back}
      </button>
      <div>
        <Kicker tone="mint">{sportLabel(sport, lang)}</Kicker>
        <H1>{fresh ? PLACE_NOTE_TEXT.newTitle[l] : PLACE_NOTE_TEXT.title[l]}</H1>
        <Small className="mt-1">{PLACE_NOTE_TEXT.private[l]}</Small>
      </div>

      <Card>
        <div role="radiogroup" aria-label={L.notes.starsLabel} className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={fmt(L.notes.stars, { n })}
              onClick={() => setRating(n)}
              className={cn("h-12 w-12 text-3xl leading-none", n <= rating ? "text-butter-fg" : "text-faint")}
            >
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-medium">{PLACE_NOTE_TEXT.recommend[l]}</p>
        <div role="radiogroup" aria-label={PLACE_NOTE_TEXT.recommend[l]} className="mt-2 grid grid-cols-2 gap-2">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={recommend === v}
              onClick={() => setRecommend(v)}
              className={cn(
                "min-h-12 rounded-xl border text-sm font-semibold",
                recommend === v ? "border-volt-fg bg-volt text-ink" : "border-line bg-surface-2 text-text",
              )}
            >
              {v ? PLACE_NOTE_TEXT.yes[l] : PLACE_NOTE_TEXT.no[l]}
            </button>
          ))}
        </div>
      </Card>

      <section aria-label={fmt(L.notes.tips, { n: PLACE_NOTE_TAGS_MAX })} className="space-y-2">
        <Small>{fmt(L.notes.tips, { n: PLACE_NOTE_TAGS_MAX })}</Small>
        <div className="flex flex-wrap gap-2">
          {PLACE_NOTE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tags.includes(t)}
              disabled={!tags.includes(t) && tags.length >= PLACE_NOTE_TAGS_MAX}
              onClick={() => toggle(t)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm disabled:opacity-40",
                tags.includes(t) ? "border-mint-fg bg-surface-2 font-semibold text-mint-fg" : "border-line bg-surface text-muted",
              )}
            >
              {PLACE_NOTE_TAG_TEXT[t][l]}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">{PLACE_NOTE_TEXT.tipPlaceholder[l]}</span>
          <input
            className="h-12 w-full rounded-xl border border-line bg-night px-4 text-base text-text outline-none placeholder:text-faint focus:border-pulse-fg"
            maxLength={PLACE_NOTE_TEXT_MAX + 10}
            value={text}
            placeholder={PLACE_NOTE_TEXT.tipPlaceholder[l]}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {problem && problem !== "place" && problem !== "sport" && (
          <p role="alert" className="text-sm text-butter-fg">
            {placeNoteProblemText(problem as PlaceNoteProblem, l)}
          </p>
        )}
      </section>

      <Btn big variant="volt" className="w-full" disabled={!checked?.ok || busy} onClick={() => void send()}>
        {PLACE_NOTE_TEXT.done[l]}
      </Btn>
      {msg && (
        <p role="status" className="text-sm text-butter-fg">
          {msg}
        </p>
      )}
      <button type="button" className="min-h-11 w-full text-sm text-muted underline" onClick={back}>
        {L.notes.skip}
      </button>
      <Small>
        {PLACE_NOTE_TEXT.credit[l].split("©")[0]}
        <a className="underline" href={PLACES_LICENSE_URL} target="_blank" rel="noopener noreferrer">
          {PLACES_ATTRIBUTION}
        </a>
      </Small>
    </div>
  );
}

/** A place's notes in Spots: the one-line aggregate and the approved text tips (each can be reported). */
export function PlaceNotesLine({ view }: { view: NotesView | undefined }) {
  const { lang } = useApp();
  const { la, L } = useLiving();
  const [reported, setReported] = useState<string[]>([]);
  const agg = aggregateOf(view);
  const l = lang === "fr" ? "fr" : "en";
  if (!agg) return null;
  return (
    <div className="mt-2 rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="text-sm">
        <span className="sr-only">{L.notes.from}: </span>
        {placeAggregateLine(agg, l)}
      </p>
      {agg.tips.length > 0 && (
        <ul className="mt-1 space-y-1">
          {agg.tips.map((t) => (
            <li key={t.id ?? t.text} className="flex items-start gap-2 text-sm text-muted">
              <span className="flex-1">“{t.text}”</span>
              {t.id &&
                (reported.includes(t.id) ? (
                  <span className="text-xs">{L.notes.reported}</span>
                ) : (
                  <button
                    type="button"
                    className="min-h-8 shrink-0 text-xs underline"
                    onClick={() => {
                      const id = t.id!;
                      setReported((r) => [...r, id]);
                      void la.reportTip(id).catch(() => undefined);
                    }}
                  >
                    {L.notes.report}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
