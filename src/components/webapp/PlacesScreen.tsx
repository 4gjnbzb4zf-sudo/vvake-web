"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sports as catalog } from "@/lib/sports";
import { cn } from "@/lib/cn";
import { cameraSport } from "@/lib/webapp/camera/webSetup";
import type { LatLon } from "@/lib/webapp/geo";
import {
  compassPoint,
  directionsUrl,
  fetchPlaces,
  formatPlaceDistance,
  hasPlaces,
  kindName,
  kindsIn,
  nearestPlaces,
  openNow,
  osmUrl,
  PLACES_ATTRIBUTION,
  PLACES_LICENSE_URL,
  PLACES_RADIUS,
  placeTitle,
  type NearPlace,
  type PlacesAnswer,
} from "@/lib/webapp/places";
import { QUICK_SPORTS, sportLabel, WEB_SPORTS } from "@/lib/webapp/workout";
import { routeHash, useApp } from "./AppContext";
import { PlacesMap } from "./PlacesMap";
import { Btn, Card, H1, Kicker, Note, Segmented, Small } from "./ui";
import { useNow } from "./useNow";
import { useWorkout } from "./WorkoutContext";
import { EntryChoice } from "./WorkoutScreen";
import { useLiving } from "./Journey";
import { aggregateOf, PlaceNotesLine, ratedPlaces } from "./PlaceNote";
import { osmPlaceKey } from "@/lib/webapp/living/placeNotes";
import type { NotesView } from "@/lib/webapp/livingApi";

/**
 * Where to train near me (the phone's Places screen, monorepo docs/02-product/nearby-places.md): pick a sport, tap
 * "Use my location" (the browser asks then, never before), and get the places from OpenStreetMap nearest first, on
 * a list and a map: distance and direction from where you are, open now when the hours are simple, surface and
 * length for routes, directions in Apple Maps or Google Maps, and Start here (the workout for that sport).
 *
 * Only a point rounded to 2 decimals goes to GET /v1/places (public); the exact fix stays in this page's memory to
 * sort and point the way, never stored or sent. #/places/<sport>.
 *
 * Place notes (living app §6): each place shows what athletes said of it (GET /v1/places/notes, from 3 notes on:
 * stars, % who recommend it, the top tips, approved text tips), a Rate button (3 taps), and "New for you" lists the
 * well-rated places near you that this browser hasn't rated yet. Our own notes, beside OpenStreetMap's places.
 */

const SPORT_KEY = "vvake-app-places-sport";
const RADII = [2, 5, 10, 25] as const;
const SHOWN = 30;

function readSport(): string | null {
  try {
    const v = localStorage.getItem(SPORT_KEY);
    return v && hasPlaces(v) ? v : null;
  } catch {
    return null;
  }
}
function keepSport(s: string) {
  try {
    localStorage.setItem(SPORT_KEY, s);
  } catch {
    // private mode: this visit only
  }
}

type Loc = "idle" | "asking" | "denied" | "nofix" | "ready";
type Res =
  { kind: "idle" } | { kind: "loading" } | { kind: "ok"; answer: PlacesAnswer } | { kind: "busy"; until: number } | { kind: "error" };

export function PlacesScreen({ sport: routeSport }: { sport?: string }) {
  const { t, lang, go, athlete, prefs, apiUrl, fmt, tabs, me } = useApp();
  const wk = useWorkout();
  const p = t.places;
  const { la, L } = useLiving();
  const [notes, setNotes] = useState<Record<string, NotesView>>({});

  const mine = useMemo(() => {
    const fromSurvey = (athlete?.survey?.sports ?? []).map((s) => s.sport).filter(hasPlaces);
    return [...new Set([...fromSurvey, ...QUICK_SPORTS.filter(hasPlaces)])].slice(0, 8);
  }, [athlete]);
  const [sport, setSport] = useState<string>(() => (routeSport && hasPlaces(routeSport) ? routeSport : (readSport() ?? mine[0] ?? "run")));
  const [radius, setRadius] = useState<number>(PLACES_RADIUS.default);
  const [fix, setFix] = useState<LatLon | null>(null);
  const [loc, setLoc] = useState<Loc>("idle");
  const [res, setRes] = useState<Res>({ kind: "idle" });
  const [kind, setKind] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState(SHOWN);
  const [asking, setAsking] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const now = useNow(res.kind === "busy" ? 1000 : 60_000);

  const search = useCallback(
    async (at: LatLon, s: string, r: number) => {
      inflight.current?.abort();
      const ctl = new AbortController();
      inflight.current = ctl;
      const timer = window.setTimeout(() => ctl.abort(), 60_000);
      setRes({ kind: "loading" });
      setKind(null);
      setSelected(null);
      setShown(SHOWN);
      try {
        const out = await fetchPlaces(apiUrl, { sport: s, lat: at.lat, lon: at.lon, radiusKm: r }, { signal: ctl.signal });
        if (inflight.current !== ctl) return;
        if (out.kind === "ok") setRes({ kind: "ok", answer: out.answer });
        else if (out.kind === "busy") setRes({ kind: "busy", until: Date.now() + out.retryAfterS * 1000 });
        else setRes({ kind: "error" });
      } catch {
        // aborted: a newer search took over, or 60 s passed
        if (inflight.current === ctl) setRes({ kind: "error" });
      } finally {
        window.clearTimeout(timer);
      }
    },
    [apiUrl],
  );

  const locate = () => {
    if (!("geolocation" in navigator)) return setLoc("nofix");
    setLoc("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setFix(at);
        setLoc("ready");
        void search(at, sport, radius);
      },
      (err) => setLoc(err.code === err.PERMISSION_DENIED ? "denied" : "nofix"),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    );
  };

  const pickSport = (s: string) => {
    setSport(s);
    keepSport(s);
    // The address follows the sport without a history entry per tap.
    window.history.replaceState(null, "", routeHash({ name: "places", sport: s }));
    if (fix) void search(fix, s, radius);
  };
  const pickRadius = (r: number) => {
    setRadius(r);
    if (fix) void search(fix, sport, r);
  };

  const near = useMemo<NearPlace[]>(
    () => (res.kind === "ok" && fix ? nearestPlaces(res.answer.places, fix, radius, 150) : []),
    [res, fix, radius],
  );
  const kinds = useMemo(() => kindsIn(near), [near]);
  // The notes of the nearest 50 places (aggregates only: never who wrote them).
  const noteKeys = useMemo(
    () =>
      near
        .slice(0, 50)
        .map((x) => osmPlaceKey(x.id))
        .filter((k): k is string => !!k)
        .join(","),
    [near],
  );
  useEffect(() => {
    if (!noteKeys) return;
    let live = true;
    la.notes(noteKeys.split(","))
      .then((n) => live && setNotes((old) => ({ ...old, ...n })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [la, noteKeys]);
  const fresh = useMemo(() => {
    const rated = new Set(ratedPlaces(me.id));
    return near
      .map((x) => ({ x, key: osmPlaceKey(x.id) ?? "", agg: aggregateOf(notes[osmPlaceKey(x.id) ?? ""]) }))
      .filter((r) => r.agg && !rated.has(r.key) && r.agg.rating >= 4 && r.agg.recommendPct >= 70)
      .sort((a, b) => b.agg!.rating - a.agg!.rating || a.x.distanceM - b.x.distanceM)
      .slice(0, 3);
  }, [near, notes, me.id]);
  const list = useMemo(() => (kind ? near.filter((x) => x.kind === kind) : near), [near, kind]);
  const dist = (m: number) => formatPlaceDistance(m, prefs.units, lang);
  const radiusText = (r: number) => (prefs.units === "imperial" ? dist(r * 1000) : `${r} km`);
  const nextRadius = RADII.find((r) => r > radius);
  const busyLeft = res.kind === "busy" ? Math.max(0, Math.ceil((res.until - now) / 1000)) : 0;

  const start = (s: string) => {
    if (cameraSport(s)) return setAsking(s);
    wk.start(s);
    go({ name: "workout" });
  };

  const groups = catalog.categories
    .map((c) => ({ key: c.key, title: c.name[lang], items: WEB_SPORTS.filter((s) => s.category === c.key && hasPlaces(s.key)) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-4 pt-2">
      {/* Back where you came from (Crew & City › Spots, Today, the workout); opened straight from a link: Spots' home. */}
      <button
        type="button"
        className="h-11 text-sm text-muted"
        onClick={() => (window.history.length > 1 ? window.history.back() : go({ name: tabs.includes("crew") ? "crew" : "today" }))}
      >
        ‹ {t.common.back}
      </button>
      <div>
        <Kicker tone="mint">{p.kicker}</Kicker>
        <H1>{p.title}</H1>
        <p className="mt-1 text-sm text-muted">{p.lead}</p>
      </div>

      {/* The sport: yours first, then every sport that has places. */}
      <section aria-label={p.sport} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(mine.includes(sport) ? mine : [sport, ...mine]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === sport}
              onClick={() => pickSport(k)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold",
                k === sport ? "border-volt-fg bg-volt text-ink" : "border-line bg-surface text-text hover:border-volt-fg",
              )}
            >
              {sportLabel(k, lang)}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">{p.sport}</span>
          <select
            className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-text"
            value={sport}
            onChange={(e) => pickSport(e.target.value)}
          >
            {groups.map((g) => (
              <optgroup key={g.key} label={g.title}>
                {g.items.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name[lang]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      {/* Location: asked only on this tap. */}
      <Card>
        <Btn big variant="volt" className="w-full" onClick={locate} disabled={loc === "asking" || res.kind === "loading"}>
          ◎ {fix ? p.searchAgain : p.useLocation}
        </Btn>
        <Small className="mt-2">{p.why}</Small>
        {loc === "denied" && (
          <p role="alert" className="mt-2 text-sm text-butter-fg">
            {p.denied}
          </p>
        )}
        {loc === "nofix" && (
          <p role="alert" className="mt-2 text-sm text-butter-fg">
            {p.noFix}
          </p>
        )}
        <div className="mt-3">
          <Segmented
            label={p.radius}
            value={String(radius)}
            options={RADII.map((r) => ({ value: String(r), label: radiusText(r) }))}
            onChange={(v) => pickRadius(Number(v))}
          />
        </div>
      </Card>

      {res.kind === "loading" && (
        <div role="status" className="rounded-2xl border border-line bg-surface p-4">
          <p className="font-semibold">{p.loading}</p>
          <Small className="mt-1">{p.loadingSlow}</Small>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-mint" />
          </div>
        </div>
      )}
      {res.kind === "busy" && (
        <Card tone="butter">
          <p role="alert" className="text-sm text-butter-fg">
            {p.busy}
          </p>
          <Btn variant="ghost" className="mt-3 w-full" disabled={busyLeft > 0} onClick={() => fix && void search(fix, sport, radius)}>
            {busyLeft > 0 ? fmt(p.busyRetry, { n: busyLeft }) : t.common.retry}
          </Btn>
        </Card>
      )}
      {res.kind === "error" && (
        <Card tone="butter">
          <p role="alert" className="text-sm text-butter-fg">
            {p.error}
          </p>
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => fix && void search(fix, sport, radius)}>
            {t.common.retry}
          </Btn>
        </Card>
      )}

      {res.kind === "ok" && fix && (
        <>
          <PlacesMap
            className="h-72"
            here={fix}
            places={list}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              const i = list.findIndex((x) => x.id === id);
              if (i >= shown) setShown(i + 1);
              window.setTimeout(() => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
            }}
            youLabel={p.you}
            creditLabel={p.credit}
          />
          {res.answer.partial && <Note tone="butter">{p.partial}</Note>}
          {near.length === 0 ? (
            <Card>
              <p className="text-sm">{fmt(p.none, { radius: radiusText(radius) })}</p>
              {nextRadius && (
                <Btn variant="ghost" className="mt-3 w-full" onClick={() => pickRadius(nextRadius)}>
                  {fmt(p.further, { radius: radiusText(nextRadius) })}
                </Btn>
              )}
            </Card>
          ) : (
            <>
              {fresh.length > 0 && (
                <Card>
                  <Kicker tone="mint">{L.notes.newForYou}</Kicker>
                  <Small className="mt-1">{L.notes.newForYouLead}</Small>
                  <ul className="mt-2 space-y-1">
                    {fresh.map(({ x, agg }) => (
                      <li key={x.id}>
                        <button
                          type="button"
                          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                          onClick={() => {
                            setSelected(x.id);
                            const i = list.findIndex((y) => y.id === x.id);
                            if (i >= shown) setShown(i + 1);
                            window.setTimeout(() => document.getElementById(`place-${x.id}`)?.scrollIntoView({ block: "center" }), 50);
                          }}
                        >
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="block font-medium">{placeTitle(x, lang)}</span>
                            <span className="block text-xs text-muted">{dist(x.distanceM)}</span>
                          </span>
                          <span className="text-sm font-semibold text-butter-fg">{`${lang === "fr" ? String(agg!.rating).replace(".", ",") : agg!.rating}★`}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <Small>{fmt(p.count, { n: near.length, radius: radiusText(radius) })}</Small>
              {kinds.length > 1 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={p.title}>
                  {[{ kind: null as string | null, n: near.length }, ...kinds].map((k) => (
                    <button
                      key={k.kind ?? "all"}
                      type="button"
                      aria-pressed={kind === k.kind}
                      onClick={() => (setKind(k.kind), setShown(SHOWN))}
                      className={cn(
                        "min-h-10 rounded-full border px-3 text-sm",
                        kind === k.kind ? "border-mint-fg bg-surface-2 font-semibold text-mint-fg" : "border-line bg-surface text-muted",
                      )}
                    >
                      {k.kind ? kindName(k.kind, lang) : p.all} · {k.n}
                    </button>
                  ))}
                </div>
              )}
              <ul className="space-y-3">
                {list.slice(0, shown).map((x) => (
                  <PlaceCard
                    key={x.id}
                    place={x}
                    picked={x.id === selected}
                    now={now}
                    dist={dist}
                    onStart={() => start(sport)}
                    startDisabled={!!wk.w}
                    onPick={() => setSelected(x.id)}
                    notes={notes[osmPlaceKey(x.id) ?? ""]}
                    onRate={() => {
                      const key = osmPlaceKey(x.id);
                      if (key) go({ name: "place-note", key, sport });
                    }}
                    rateLabel={L.notes.rate}
                  />
                ))}
              </ul>
              {list.length > shown && (
                <Btn variant="ghost" className="w-full" onClick={() => setShown(shown + SHOWN)}>
                  {t.common.more}
                </Btn>
              )}
            </>
          )}
        </>
      )}

      <Small>
        {p.credit}{" "}
        <a className="underline" href={PLACES_LICENSE_URL} target="_blank" rel="noopener noreferrer">
          {PLACES_ATTRIBUTION}
        </a>
      </Small>
      {asking && (
        <EntryChoice
          sport={asking}
          onClose={() => setAsking(null)}
          onHeart={() => {
            wk.start(asking);
            go({ name: "workout" });
          }}
        />
      )}
    </div>
  );
}

function PlaceCard({
  place: x,
  picked,
  now,
  dist,
  onStart,
  startDisabled,
  onPick,
  notes,
  onRate,
  rateLabel,
}: {
  place: NearPlace;
  picked: boolean;
  now: number;
  dist: (m: number) => string;
  onStart: () => void;
  startDisabled: boolean;
  onPick: () => void;
  notes?: NotesView;
  onRate: () => void;
  rateLabel: string;
}) {
  const { t, lang, fmt } = useApp();
  const p = t.places;
  const open = openNow(x.hours, new Date(now));
  const title = placeTitle(x, lang);
  const facts = [
    x.lengthM ? fmt(p.length, { d: dist(x.lengthM) }) : null,
    x.surface ? fmt(p.surface, { s: x.surface.replace(/_/g, " ") }) : null,
    x.indoor ? p.indoor : null,
    x.fee === true ? p.fee : x.fee === false ? p.free : null,
    x.lit ? p.lit : null,
    x.access === "members" || x.access === "customers" || x.access === "private" ? p.members : null,
  ].filter(Boolean);
  const link =
    "inline-flex min-h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold hover:border-muted/60";
  return (
    <li id={`place-${x.id}`} className={cn("rounded-2xl border bg-surface p-4", picked ? "border-pulse-fg" : "border-line")}>
      <button type="button" onClick={onPick} className="flex w-full items-start gap-3 text-left">
        <span className="min-w-0 flex-1">
          <Kicker tone="mint">{kindName(x.kind, lang)}</Kicker>
          <span className="mt-0.5 block font-display text-[17px] leading-snug font-semibold">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden className="inline-block text-base text-volt-fg" style={{ transform: `rotate(${x.bearing}deg)` }}>
            ↑
          </span>
          {fmt(p.toward, { d: dist(x.distanceM), dir: compassPoint(x.bearing, lang) })}
        </span>
      </button>
      {(open !== null || x.hours) && (
        <p className="mt-2 text-sm">
          {open === true && <span className="mr-2 font-semibold text-up-fg">{p.openNow}</span>}
          {open === false && <span className="mr-2 font-semibold text-down-fg">{p.closedNow}</span>}
          {x.hours && x.hours !== "24/7" && <span className="text-muted">{fmt(p.hours, { hours: x.hours })}</span>}
          {x.hours === "24/7" && <span className="text-muted">24/7</span>}
        </p>
      )}
      {facts.length > 0 && <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>}
      <PlaceNotesLine view={notes} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn className="h-10" onClick={onStart} disabled={startDisabled}>
          {p.startHere}
        </Btn>
        <span className="sr-only">{p.directions}:</span>
        <a className={link} href={directionsUrl({ ...x, name: x.name }, "apple", x.distanceM)} target="_blank" rel="noopener noreferrer">
          {p.apple}
        </a>
        <a className={link} href={directionsUrl(x, "google", x.distanceM)} target="_blank" rel="noopener noreferrer">
          {p.google}
        </a>
        <button type="button" className={link} onClick={onRate}>
          ★ {rateLabel}
        </button>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-faint">
        {x.website && /^https?:\/\//.test(x.website) && (
          <a className="underline" href={x.website} target="_blank" rel="noopener noreferrer nofollow">
            {p.website}
          </a>
        )}
        <a className="underline" href={osmUrl(x.id)} target="_blank" rel="noopener noreferrer">
          {p.onOsm}
        </a>
      </p>
    </li>
  );
}
