"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/rewardsApi";
import { dayLabel, timeLabel } from "@/lib/webapp/format";
import type { LatLon } from "@/lib/webapp/geo";
import { defaultMeetupStart, downloadText, localInputValue, type Friend, type MeetupView } from "@/lib/webapp/livingApi";
import {
  checkMeetup,
  isMeetupPointSet,
  MEETUP_DURATION_MIN,
  MEETUP_LEVEL_MAX,
  MEETUP_MAX_AHEAD_DAYS,
  MEETUP_MIN_LEAD_MIN,
  MEETUP_PEOPLE,
  MEETUP_POINT_KINDS,
  MEETUP_REPORT_REASON_TEXT,
  MEETUP_REPORT_REASONS,
  MEETUP_TEXT,
  meetupIcs,
  meetupProblemText,
  type MeetupReportReason,
} from "@/lib/webapp/living/meetups";
import { osmPlaceKey } from "@/lib/webapp/living/placeNotes";
import {
  directionsUrl,
  fetchPlaces,
  kindName,
  nearestPlaces,
  PLACES_ATTRIBUTION,
  PLACES_LICENSE_URL,
  type NearPlace,
} from "@/lib/webapp/places";
import { meetupSavedMoment } from "@/lib/webapp/suggest/steps";
import { sportLabel, WEB_SPORTS } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { useLiving } from "./Journey";
import { NextStepsRow } from "./NextSteps";
import { PlacesMap } from "./PlacesMap";
import { useNow } from "./useNow";
import { Btn, Card, Field, H1, inputCls, Kicker, List, Note, Row, Small } from "./ui";

/**
 * Training meetups on the web (VVFit living-app.md §14 "Meetups on the map", docs/05-tech/places-and-meetups.md):
 * invite-only (the people you've faced: GET /v1/friends), a public meeting point picked from OpenStreetMap places near
 * you (GET /v1/places?sport=meet: car parks, trailheads, parks, tracks…, never a typed position), a pace line, a size;
 * then the meetup's page: the map and directions, I'm in / I can't make it, "I'm here" (a tap, no location) from
 * 30 minutes before, add to calendar (an .ics made here by game-core's meetupIcs: no names, no e-mail), report and
 * block. Social feature. The list lives in Crew & City.
 */

const DURATIONS = [30, 45, 60, 90, 120, 180, 240];
/** The meetup just created in this tab: its page offers "Add it to your calendar?" once (the next-step engine). */
const JUST_SAVED = "vvake-app-meetup-saved";
const markSaved = (id: string) => {
  try {
    sessionStorage.setItem(JUST_SAVED, id);
  } catch {
    // no storage: no calendar step, the button below still adds it
  }
};
/** Is this the meetup just saved? (the mark is cleared once its page has shown, so it's offered once) */
const wasJustSaved = (id: string) => {
  try {
    return sessionStorage.getItem(JUST_SAVED) === id;
  } catch {
    return false;
  }
};
const clearSaved = () => {
  try {
    sessionStorage.removeItem(JUST_SAVED);
  } catch {
    // nothing kept
  }
};

const errorText = (e: unknown, L: ReturnType<typeof useLiving>["L"]) =>
  e instanceof ApiError && e.code in L.meetups.errors ? L.meetups.errors[e.code as keyof typeof L.meetups.errors] : L.meetups.error;

/** Crew & City: your meetups (upcoming and the last 7 days) and "New meetup". */
export function MeetupsSection() {
  const { lang, go, fmt, featureOn } = useApp();
  const { la, L } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const [list, setList] = useState<MeetupView[] | null>(null);
  const [error, setError] = useState(false);
  const social = featureOn("social");
  useEffect(() => {
    if (!social) return;
    let live = true;
    la.meetups()
      .then((m) => live && setList(m))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [la, social]);
  if (!social) return null;
  const sorted = (list ?? []).slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return (
    <section aria-label={L.meetups.list} className="space-y-2">
      <Kicker tone="pulse">{MEETUP_TEXT.title[l]}</Kicker>
      <Small>{L.meetups.lead}</Small>
      {sorted.length > 0 && (
        <List>
          {sorted.map((m) => (
            <Row
              key={m.id}
              tone={m.phase === "now" || m.phase === "soon" ? "pulse" : "sky"}
              icon="⚐"
              title={`${sportLabel(m.sport, lang)} · ${dayLabel(m.startsAt, lang)} ${timeLabel(m.startsAt, lang)}`}
              detail={[
                m.point.name ?? (m.point.kind ? kindName(m.point.kind, lang) : null),
                fmt(L.meetups.going, { n: m.going ?? 0 }),
                (L.meetups.phase as Record<string, string>)[m.phase],
              ]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => go({ name: "meetup", id: m.id })}
            />
          ))}
        </List>
      )}
      {list && !sorted.length && <Small>{L.meetups.none}</Small>}
      {error && <Small>{L.meetups.error}</Small>}
      <Btn variant="ghost" className="w-full" onClick={() => go({ name: "meetup-new" })}>
        + {MEETUP_TEXT.newMeetup[l]}
      </Btn>
    </section>
  );
}

type PointsState =
  { kind: "idle" } | { kind: "loading" } | { kind: "denied" } | { kind: "ok"; here: LatLon; places: NearPlace[] } | { kind: "error" };

/** A new meetup: sport, time, duration, a public meeting point near you, a pace line, a size, the invites. */
export function MeetupNewScreen({ sport: routeSport }: { sport?: string }) {
  const { lang, go, apiUrl, fmt, t } = useApp();
  const { la, L } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const [now] = useState(() => Date.now());
  const clock = useNow(30_000);
  const [sport, setSport] = useState(() => (routeSport && WEB_SPORTS.some((s) => s.key === routeSport) ? routeSport : "run"));
  const [when, setWhen] = useState(() => localInputValue(defaultMeetupStart(now)));
  const [duration, setDuration] = useState(60);
  const [level, setLevel] = useState("");
  const [maxPeople, setMaxPeople] = useState(6);
  const [points, setPoints] = useState<PointsState>({ kind: "idle" });
  const [point, setPoint] = useState<NearPlace | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    la.friends()
      .then((f) => live && setFriends(f))
      .catch(() => live && setFriends([]));
    return () => {
      live = false;
    };
  }, [la]);

  const findPoints = () => {
    if (!("geolocation" in navigator)) return setPoints({ kind: "error" });
    setPoints({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        // Only a point rounded to 2 decimals goes to GET /v1/places (as in Spots); the fix stays in this page.
        void fetchPlaces(apiUrl, { sport: "meet", lat: here.lat, lon: here.lon, radiusKm: 5 })
          .then((r) => {
            if (r.kind !== "ok") return setPoints({ kind: "error" });
            const ok = r.answer.places.filter(
              (p) =>
                (MEETUP_POINT_KINDS as readonly string[]).includes(p.kind) && (!p.set || isMeetupPointSet(p.set)) && !!osmPlaceKey(p.id),
            );
            setPoints({ kind: "ok", here, places: nearestPlaces(ok, here, 5, 40) });
          })
          .catch(() => setPoints({ kind: "error" }));
      },
      (err) => setPoints({ kind: err.code === err.PERMISSION_DENIED ? "denied" : "error" }),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    );
  };

  const startMs = Date.parse(when);
  const pointKey = point ? (osmPlaceKey(point.id) ?? "") : "";
  const checked = checkMeetup({ sport, startMs, durationMin: duration, pointKey: pointKey || "x", level, maxPeople, invitees }, clock);
  const problem = !checked.ok ? checked.problem : !point ? ("point" as const) : null;

  const create = async () => {
    if (!checked.ok || !point) return;
    setBusy(true);
    setMsg(null);
    try {
      const m = await la.createMeetup({
        sport,
        startsAt: new Date(startMs).toISOString(),
        durationMin: duration,
        point: { key: checked.pointKey, ...(point.set ? { set: point.set } : {}), near: { lat: point.lat, lon: point.lon } },
        ...(checked.level ? { level: checked.level } : {}),
        maxPeople,
        invitees: checked.invitees,
      });
      markSaved(m.id);
      go({ name: "meetup", id: m.id });
    } catch (e) {
      const field = e instanceof ApiError && e.code === "ugc" ? meetupProblemText("abuse", l) : null;
      setMsg(field ?? (e instanceof ApiError && e.code === "invalid" && e.message ? e.message : L.meetups.error));
    } finally {
      setBusy(false);
    }
  };

  const minIso = localInputValue(now + MEETUP_MIN_LEAD_MIN * 60_000);
  const maxIso = localInputValue(now + MEETUP_MAX_AHEAD_DAYS * 86_400_000);
  return (
    <div className="space-y-4 pt-2">
      <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "crew" })}>
        ‹ {L.notes.back}
      </button>
      <div>
        <Kicker tone="pulse">{MEETUP_TEXT.title[l]}</Kicker>
        <H1>{MEETUP_TEXT.newMeetup[l]}</H1>
        <Small className="mt-1">{MEETUP_TEXT.inviteHint[l]}</Small>
      </div>
      <Card className="space-y-3">
        <Field label={L.meetups.sport}>
          <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
            {WEB_SPORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={L.meetups.when}>
          <input
            type="datetime-local"
            className={inputCls}
            min={minIso}
            max={maxIso}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
        <Field label={L.meetups.duration}>
          <select className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.filter((d) => d >= MEETUP_DURATION_MIN.min && d <= MEETUP_DURATION_MIN.max).map((d) => (
              <option key={d} value={d}>
                {fmt(L.meetups.minutes, { n: d })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={MEETUP_TEXT.level[l]}>
          <input
            className={inputCls}
            maxLength={MEETUP_LEVEL_MAX + 5}
            value={level}
            placeholder={MEETUP_TEXT.levelPlaceholder[l]}
            onChange={(e) => setLevel(e.target.value)}
          />
        </Field>
        <Field label={MEETUP_TEXT.maxPeople[l]}>
          <select className={inputCls} value={maxPeople} onChange={(e) => setMaxPeople(Number(e.target.value))}>
            {Array.from({ length: MEETUP_PEOPLE.max - MEETUP_PEOPLE.min + 1 }, (_, i) => i + MEETUP_PEOPLE.min).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-3">
        <Kicker tone="mint">{MEETUP_TEXT.meetingPoint[l]}</Kicker>
        <Small>{MEETUP_TEXT.pointHint[l]}</Small>
        {point ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold">
              {point.name ?? kindName(point.kind, lang)}
              <span className="block text-xs font-normal text-muted">{kindName(point.kind, lang)}</span>
            </p>
            <Btn variant="ghost" className="h-10" onClick={() => setPoint(null)}>
              {L.meetups.change}
            </Btn>
          </div>
        ) : (
          <>
            <Btn variant="volt" className="w-full" disabled={points.kind === "loading"} onClick={findPoints}>
              ◎ {L.meetups.findPoints}
            </Btn>
            {points.kind === "loading" && (
              <p role="status" className="text-sm text-muted">
                {L.meetups.pointsLoading}
              </p>
            )}
            {points.kind === "denied" && <p className="text-sm text-butter-fg">{L.meetups.pointsDenied}</p>}
            {points.kind === "error" && <p className="text-sm text-butter-fg">{L.meetups.error}</p>}
            {points.kind === "ok" && points.places.length === 0 && <p className="text-sm text-muted">{L.meetups.pointsNone}</p>}
            {points.kind === "ok" && points.places.length > 0 && (
              <>
                <PlacesMap
                  className="h-60"
                  here={points.here}
                  places={points.places}
                  selected={null}
                  onSelect={(id) => setPoint(points.places.find((p) => p.id === id) ?? null)}
                  youLabel={t.places.you}
                  creditLabel={t.places.credit}
                />
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {points.places.slice(0, 20).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPoint(p)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block font-medium">{p.name ?? kindName(p.kind, lang)}</span>
                          <span className="block text-xs text-muted">{kindName(p.kind, lang)}</span>
                        </span>
                        <span className="text-xs text-muted tabular-nums">{Math.round(p.distanceM)} m</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <Small>
          <a className="underline" href={PLACES_LICENSE_URL} target="_blank" rel="noopener noreferrer">
            {PLACES_ATTRIBUTION}
          </a>
        </Small>
      </Card>

      <Card className="space-y-2">
        <Kicker tone="pulse">{MEETUP_TEXT.invite[l]}</Kicker>
        {!friends && <Small>{L.meetups.friendsLoading}</Small>}
        {friends && friends.length === 0 && <Note tone="butter">{L.meetups.noFriends}</Note>}
        {friends && friends.length > 0 && (
          <ul className="space-y-1">
            {friends.map((f) => {
              const on = invitees.includes(f.id);
              return (
                <li key={f.id}>
                  <label className="flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--color-volt)]"
                      checked={on}
                      onChange={() => setInvitees((x) => (on ? x.filter((y) => y !== f.id) : [...x, f.id]))}
                    />
                    <span className="text-sm">{f.displayName ?? "VVaker"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Note>{MEETUP_TEXT.safety[l]}</Note>
      {problem && point && (
        <p role="alert" className="text-sm text-butter-fg">
          {meetupProblemText(problem, l)}
        </p>
      )}
      <Btn big variant="volt" className="w-full" disabled={!!problem || busy} onClick={() => void create()}>
        {busy ? L.meetups.creating : L.meetups.create}
      </Btn>
      {msg && (
        <p role="alert" className="text-sm text-butter-fg">
          {msg}
        </p>
      )}
    </div>
  );
}

/** A meetup's page: when, where (map, directions), who's coming, I'm in / here, add to calendar, report and block. */
export function MeetupScreen({ id }: { id: string }) {
  const { lang, go, fmt, me, t } = useApp();
  const { la, L } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const [m, setM] = useState<MeetupView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState<null | { personId?: string; name?: string }>(null);
  const [saved] = useState(() => wasJustSaved(id));
  useEffect(() => {
    if (saved) clearSaved();
  }, [saved]);
  useEffect(() => {
    let live = true;
    la.meetup(id)
      .then((x) => {
        if (!live) return;
        setM(x);
        setState("ok");
      })
      .catch((e) => live && setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
    return () => {
      live = false;
    };
  }, [la, id]);

  const act = async (fn: () => Promise<MeetupView>) => {
    setBusy(true);
    setMsg(null);
    try {
      setM(await fn());
    } catch (e) {
      setMsg(errorText(e, L));
    } finally {
      setBusy(false);
    }
  };
  const ics = () => {
    if (!m) return;
    const text = meetupIcs({
      id: m.id,
      sport: m.sport,
      startMs: Date.parse(m.startsAt),
      durationMin: m.durationMin,
      status: m.status === "cancelled" ? "cancelled" : m.status === "done" ? "done" : "planned",
      place: m.point.name ?? (m.point.kind ? kindName(m.point.kind, lang) : MEETUP_TEXT.meetingPoint[l]),
      ...(typeof m.point.lat === "number" && typeof m.point.lon === "number" ? { lat: m.point.lat, lon: m.point.lon } : {}),
      level: m.level ?? null,
      nowMs: Date.now(),
      sequence: m.sequence ?? 0,
      lang: l,
    });
    downloadText("vvake-meetup.ics", text);
  };
  const here = useMemo<NearPlace[]>(
    () =>
      m && typeof m.point.lat === "number" && typeof m.point.lon === "number"
        ? [
            {
              id: m.point.id ?? m.point.key,
              kind: m.point.kind ?? "park",
              lat: m.point.lat,
              lon: m.point.lon,
              distanceM: 0,
              bearing: 0,
              ...(m.point.name ? { name: m.point.name } : {}),
            },
          ]
        : [],
    [m],
  );

  if (state === "loading")
    return (
      <p role="status" className="mt-24 text-center text-muted">
        …
      </p>
    );
  if (state !== "ok" || !m)
    return (
      <div className="space-y-4 pt-6">
        <Card>{state === "missing" ? L.meetups.notFound : L.meetups.error}</Card>
        <Btn variant="ghost" className="w-full" onClick={() => go({ name: "crew" })}>
          ‹ {L.notes.back}
        </Btn>
      </div>
    );

  const isHost = m.me.role === "host";
  const going = m.me.answer === "going" || isHost;
  const closed = m.phase === "done" || m.phase === "cancelled";
  const full = !going && (m.going ?? 0) >= m.maxPeople;
  const place = m.point.name ?? (m.point.kind ? kindName(m.point.kind, lang) : MEETUP_TEXT.meetingPoint[l]);
  return (
    <div className="space-y-4 pt-2">
      <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "crew" })}>
        ‹ {L.notes.back}
      </button>
      <div>
        <Kicker tone={m.phase === "now" || m.phase === "soon" ? "pulse" : "faint"}>
          {(L.meetups.phase as Record<string, string>)[m.phase] ?? m.phase}
        </Kicker>
        <H1>{`${sportLabel(m.sport, lang)} · ${dayLabel(m.startsAt, lang)} ${timeLabel(m.startsAt, lang)}`}</H1>
        <Small className="mt-1">
          {fmt(L.meetups.minutes, { n: m.durationMin })}
          {m.level ? ` · ${m.level}` : ""} · {fmt(L.meetups.going, { n: m.going ?? 0 })} / {m.maxPeople}
        </Small>
        <Small className="mt-1">{isHost ? L.meetups.youHost : `${L.meetups.host}: ${m.host.name ?? "VVaker"}`}</Small>
      </div>

      {saved && (
        <NextStepsRow
          moment={meetupSavedMoment(m.sport)}
          target={{ meetupId: m.id }}
          onHere={(s) => {
            if (s.id !== "calendar_add") return false;
            ics();
            return true;
          }}
        />
      )}

      <Card>
        <Kicker tone="mint">{MEETUP_TEXT.meetingPoint[l]}</Kicker>
        <p className="mt-1 font-semibold">{place}</p>
        {here.length > 0 ? (
          <>
            <PlacesMap
              className="mt-3 h-56"
              here={null}
              places={here}
              selected={here[0]!.id}
              onSelect={() => undefined}
              youLabel={t.places.you}
              creditLabel={t.places.credit}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="sr-only">{MEETUP_TEXT.directions[l]}:</span>
              <a
                className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold"
                href={directionsUrl({ lat: here[0]!.lat, lon: here[0]!.lon, ...(m.point.name ? { name: m.point.name } : {}) }, "apple")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {MEETUP_TEXT.directions[l]} · Apple
              </a>
              <a
                className="inline-flex min-h-10 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold"
                href={directionsUrl({ lat: here[0]!.lat, lon: here[0]!.lon }, "google")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {MEETUP_TEXT.directions[l]} · Google
              </a>
            </div>
          </>
        ) : (
          <Small className="mt-2">{L.meetups.pointGone}</Small>
        )}
        <Small className="mt-2">
          <a className="underline" href={PLACES_LICENSE_URL} target="_blank" rel="noopener noreferrer">
            {PLACES_ATTRIBUTION}
          </a>
        </Small>
      </Card>

      {!closed && (
        <div className="space-y-2">
          {m.me.canHere && !m.me.here && (
            <Btn big variant="volt" className="w-full" disabled={busy} onClick={() => void act(() => la.meetupAct(m.id, "here"))}>
              {MEETUP_TEXT.here[l]}
            </Btn>
          )}
          {m.me.here && <Note tone="mint">{MEETUP_TEXT.hereDone[l]}</Note>}
          {!isHost && !going && (
            <Btn big variant="volt" className="w-full" disabled={busy || full} onClick={() => void act(() => la.meetupAct(m.id, "join"))}>
              {full ? MEETUP_TEXT.full[l] : MEETUP_TEXT.join[l]}
            </Btn>
          )}
          {!isHost && going && (
            <Btn variant="ghost" className="w-full" disabled={busy} onClick={() => void act(() => la.meetupAct(m.id, "leave"))}>
              {MEETUP_TEXT.leave[l]}
            </Btn>
          )}
          <Small>{MEETUP_TEXT.noLive[l]}</Small>
        </div>
      )}
      {m.phase === "done" && (
        <Btn variant="volt" className="w-full" onClick={() => go({ name: "place-note", key: m.point.key, sport: m.sport })}>
          {MEETUP_TEXT.rateSpot[l]}
        </Btn>
      )}
      {msg && (
        <p role="alert" className="text-sm text-butter-fg">
          {msg}
        </p>
      )}

      <Card>
        <Kicker>{L.meetups.who}</Kicker>
        <ul className="mt-2 divide-y divide-line">
          {m.people.map((p) => (
            <li key={p.id} className="flex min-h-12 items-center gap-3 py-1 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {p.id === me.id ? (l === "fr" ? "Toi" : "You") : (p.name ?? "VVaker")}
                  {p.host ? ` · ${L.meetups.host}` : ""}
                </span>
                <span className="block text-xs text-muted">
                  {(L.meetups.answer as Record<string, string>)[p.answer ?? "invited"] ?? p.answer}
                  {p.here ? ` · ${L.meetups.here}` : ""}
                </span>
              </span>
              {p.id !== me.id && (
                <button
                  type="button"
                  className="min-h-10 shrink-0 text-xs text-muted underline"
                  onClick={() => setReporting({ personId: p.id, name: p.name ?? "VVaker" })}
                >
                  {MEETUP_TEXT.report[l]}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-2">
        <Btn variant="ghost" className="w-full" onClick={ics}>
          {MEETUP_TEXT.addToCalendar[l]}
        </Btn>
        {isHost && !closed && (
          <Btn
            variant="danger"
            className="w-full"
            disabled={busy}
            onClick={() => window.confirm(L.meetups.cancelConfirm) && void act(() => la.cancelMeetup(m.id))}
          >
            {MEETUP_TEXT.cancel[l]}
          </Btn>
        )}
        {!isHost && (
          <button type="button" className="min-h-11 text-sm text-muted underline" onClick={() => setReporting({})}>
            {L.meetups.reportTitle}
          </button>
        )}
      </div>
      <Note>{MEETUP_TEXT.safety[l]}</Note>
      {reporting && (
        <ReportSheet
          meetup={m}
          personId={reporting.personId}
          name={reporting.name}
          onClose={(sent) => {
            setReporting(null);
            if (sent) setMsg(L.meetups.reportSent);
          }}
        />
      )}
    </div>
  );
}

function ReportSheet({
  meetup,
  personId,
  name,
  onClose,
}: {
  meetup: MeetupView;
  personId?: string;
  name?: string;
  onClose: (sent: boolean) => void;
}) {
  const { lang, fmt } = useApp();
  const { la, L } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const [reason, setReason] = useState<MeetupReportReason>("unsafe");
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const send = async () => {
    setBusy(true);
    setErr(false);
    try {
      await la.reportMeetup(meetup.id, {
        reason,
        ...(personId ? { personId } : {}),
        ...(note.trim() ? { note: note.trim().slice(0, 280) } : {}),
        ...(block ? { block: true } : {}),
      });
      onClose(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-night-2 p-4">
        <p className="font-display text-lg font-semibold">
          {personId ? fmt(L.meetups.reportPerson, { name: name ?? "" }) : L.meetups.reportTitle}
        </p>
        <div role="radiogroup" aria-label={MEETUP_TEXT.report[l]} className="space-y-1">
          {MEETUP_REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "flex min-h-11 w-full items-center rounded-xl border px-3 text-left text-sm",
                reason === r ? "border-pulse-fg bg-surface-2 font-semibold" : "border-line",
              )}
            >
              {MEETUP_REPORT_REASON_TEXT[r][l]}
            </button>
          ))}
        </div>
        <Field label={L.meetups.reportNote}>
          <textarea className={cn(inputCls, "h-20 py-2")} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          {L.meetups.blockToo}
        </label>
        {err && <p className="text-sm text-butter-fg">{L.meetups.error}</p>}
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={() => onClose(false)}>
            {L.comeback.close}
          </Btn>
          <Btn variant="danger" className="flex-1" disabled={busy} onClick={() => void send()}>
            {L.meetups.send}
          </Btn>
        </div>
      </div>
    </div>
  );
}
