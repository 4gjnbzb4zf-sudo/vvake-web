"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addFix, gpsBars, splitsOf, type LatLon } from "@/lib/webapp/geo";
import { spotOfRoute } from "@/lib/webapp/livingApi";
import { heartProfileOf, zoneOf, type HeartProfile } from "@/lib/webapp/heart";
import { localTz, type UploadReply } from "@/lib/webapp/api";
import { MILE_M } from "@/lib/webapp/format";
import { enqueue, WORKOUT_KEY } from "@/lib/webapp/store";
import { hush, playCue, prefetchLines, unlockAudio, warmVoice } from "@/lib/webapp/coachAudio";
import { cueAllowed, cueSpoken, spokenClock } from "@/lib/webapp/voice";
import { splitLines, type Spoken } from "@/lib/webapp/voicePick";
import { heartForSport, hrIsRoughGuide } from "@/lib/webapp/sportHeart";
import { paceKind, speedThresholdsFor, windowSpeedKmh, workoutChattiness, zoneOfSpeed, type PaceKind } from "@/lib/webapp/speedZones";
import {
  afterReload,
  buildSession,
  elapsedS,
  emptyReason,
  isPaused,
  MINUTES_PER_ENERGY,
  newWorkout,
  pause as pauseW,
  resume as resumeW,
  sportLabel,
  sportOf,
  spend,
  tick,
  usesGps,
  uuid,
  withHeart,
  type WebSession,
  type WorkoutSnapshot,
} from "@/lib/webapp/workout";
import {
  distanceCapKmh,
  inVehicle,
  speedReading,
  vehicleOutcome,
  vehicleResumeNow,
  vehicleStep,
  type SpeedFix,
} from "@/lib/webapp/vehicle/workoutVehicle";
import {
  acceptAutoCard,
  autoPauseModeFor,
  autoPauseStep,
  dismissAutoCard,
  parseAutoPausePrefs,
  type AutoPauseCard,
} from "@/lib/webapp/vehicle/workoutAutoPause";
import type { AutoPauseAction } from "@/lib/webapp/vehicle/autoPause";
import {
  adaptiveUpload,
  answerAdaptive,
  cueEssential,
  cueSpokenOf,
  heardAdaptive,
  pacesOf,
  restoreAdaptive,
  startAdaptive,
  stepAdaptive,
  vibrationOf,
  viewOf,
  zoneCapOf,
  type PlannedStart,
} from "@/lib/webapp/adaptive/workoutAdaptive";
import {
  classifySaid,
  type AdaptiveSummary,
  type AdaptiveView,
  type RpeTap,
  type SessionStructure,
} from "@/lib/webapp/adaptive/adaptiveSession";
import { adaptiveOn, parseAdaptivePrefs } from "@/lib/webapp/adaptive/progressApi";
import { useApp } from "./AppContext";
import { cachedReadiness } from "./useProgress";

/**
 * The workout running in this browser, for every screen (the phone's lib/liveWorkout.ts + app/workout.tsx): one
 * controller above the tabs, so moving to Coach or You never stops it and a pill brings it back. It keeps the snapshot
 * in IndexedDB (a reload resumes it), follows GPS with navigator.geolocation.watchPosition (high accuracy, filtered
 * by geo.ts), keeps the screen on with the Screen Wake Lock (asked again when the page comes back), takes the heart
 * rate from the paired sensor, says the apps' cues, and at the end builds the session, queues it and uploads it.
 *
 * Without a heart rate streaming (no strap, or it dropped), a GPS sport's live zone comes from speed instead (ADR-0044:
 * the distance over the last 30 s against your speed zones for the sport): the zone shown and the zone cues only.
 * It never goes into the session (no zone seconds, no heart samples): no heart rate, no points, as before. The
 * workout voice switch (on, essential, off) decides what is said.
 *
 * Foot sports (walk, run, hike…) run the vehicle guard on the GPS speed (build 58, vehicle/workoutVehicle.ts): in a
 * car, bus or train the workout pauses from where the ride began and resumes by itself on foot; a session that was
 * mostly a ride is saved with the flag "vehicle" (not counted). The browser has no step count: speed alone judges.
 *
 * GPS sports run auto-pause on the same speed reading (build 59, vehicle/workoutAutoPause.ts, ADR-0065), per sport from
 * the account's prefs.autoPause (Off / Suggest / Automatic, set on vvake.com/account): Automatic pauses from where a
 * stop began and resumes from where you moved again; Suggest shows "Stopped? Pause" / "Moving again? Resume". A short
 * buzz (where the browser vibrates) and "Paused" / "Resumed" when the workout voice allows it; never in a vehicle.
 *
 * A planned session (build 62, ADR-0069, adaptive/workoutAdaptive.ts) runs game-core's adaptive engine every second
 * with the strap's heart zone, else the live GPS pace: segment, target, time left or "until recovered", status and next
 * on screen, its cues through the same speech path (the workout voice switch decides; Essential keeps the turns and
 * safety), a buzz per cue where the browser vibrates, and the Easy / Moderate / Hard card on an effort check. The
 * session uploads with `rpe` and `adaptive`. Free workouts keep the zone cues as before.
 */

export type GpsState = "off" | "searching" | "live" | "denied" | "unsupported";

export interface Summary {
  session: WebSession | null;
  discarded: boolean;
  reply: UploadReply | null;
  uploading: boolean;
  /** Saved but not sent yet (offline or the API refused for now). */
  queued: boolean;
  splits: number[];
  gainM: number;
  /** Where the session spent most time (livingApi spotOfRoute), in this page's memory only: to ask if the spot is new. */
  spot?: LatLon | null;
  /** A planned session run adaptively: what happened (time in target, adjustments, effort answers). */
  adaptive?: { structure: SessionStructure; summary: AdaptiveSummary } | null;
}

/** The planned session's live panel (null for a free workout). */
export interface AdaptiveLive {
  view: AdaptiveView;
  /** The effort card is on screen (Easy / Moderate / Hard, gone after 20 s). */
  asking: boolean;
  eased?: "tired" | "strained";
  fixed: boolean;
  /** Heart rate is streaming (zones), else pace or effort. */
  hasHr: boolean;
}

interface WorkoutApi {
  w: WorkoutSnapshot | null;
  /** A workout found in this browser after a reload, waiting for Resume or End. */
  restored: boolean;
  now: number;
  gps: GpsState;
  accuracy: number | null;
  bars: number;
  zone: number;
  /** Where the zone comes from: the heart rate, speed (no heart rate, GPS sport with speed zones), or nothing. */
  zoneSource: "heart" | "speed" | null;
  /** The speed over the last 30 s (km/h) while the zone comes from speed, else null. */
  speedKmh: number | null;
  /** How this sport's speed reads (per km/mi, km/h, /100 m, /500 m, or none). */
  paceKind: PaceKind;
  /** Effort by feel (prefs.heartZones.rpe): zones show as effort words, no bpm targets. */
  rpe: boolean;
  /** Heart rate is only a rough guide in this sport (strength, mind & body). */
  roughGuide: boolean;
  /** The session's heart: your base numbers and the sport's thresholds (ADR-0048). */
  heart: HeartProfile;
  wakeLock: boolean | null;
  gap: boolean;
  /** Paused by the vehicle guard: the banner shows (Resume / End). */
  vehicle: boolean;
  /** Paused by auto-pause (it resumes by itself when you move again). */
  autoPaused: boolean;
  /** Auto-pause's suggestion card (Suggest mode), or null. */
  autoCard: AutoPauseCard | null;
  /** The card's button (Pause from where the stop began, or Resume now) and its ×. */
  acceptAutoCard: () => void;
  dismissAutoCard: () => void;
  summary: Summary | null;
  adaptive: AdaptiveLive | null;
  /** An effort answer (the card, or a spoken one). */
  answerEffort: (tap: RpeTap) => void;
  /** Words said during the workout (the coach talk's transcript): "pain", "too hard", "easy"… feed the session. */
  heard: (text: string) => void;
  /** `plan`: today's planned session (purpose, minutes, zone) with the season's health flags: runs it adaptively. */
  start: (
    sport: string,
    plan?: PlannedStart & { health?: { condition?: boolean | null; cleared?: boolean | null; easyOnly?: boolean | null } },
  ) => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  discard: () => void;
  confirmRestore: () => void;
  closeSummary: () => void;
  lastCue: string | null;
}

const Ctx = createContext<WorkoutApi | null>(null);
export function useWorkout(): WorkoutApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkout outside the provider");
  return v;
}

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(t: "release", f: () => void): void;
}

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { lang, me, prefs, kv, athlete, energy, setEnergy, bpm, sensorState, api, deviceKey, queue, setQueue, refresh } = app;
  const { workoutVoice, speedZones, heartZones, suggestLevel } = app;
  const [w, setW] = useState<WorkoutSnapshot | null>(null);
  const wRef = useRef<WorkoutSnapshot | null>(null);
  const [restored, setRestored] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState<GpsState>("off");
  const [wakeLock, setWakeLock] = useState<boolean | null>(null);
  const [gap, setGap] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastCue, setLastCue] = useState<string | null>(null);

  const update = useCallback((f: (x: WorkoutSnapshot) => WorkoutSnapshot) => {
    const cur = wRef.current;
    if (!cur) return;
    const next = f(cur);
    if (next === cur) return;
    wRef.current = next;
    setW(next);
  }, []);

  // The sport's thresholds (yours, else automatic with the sport family's max), with your base max: the live zone, the
  // time in zones and the uploaded hrProfile agree, and the server keeps them plausible (ADR-0048).
  const wSport = w?.sport;
  const heart = useMemo(
    () => (wSport ? heartForSport(athlete?.health, wSport, heartZones) : heartProfileOf(athlete?.health ?? null)),
    [athlete, wSport, heartZones],
  );
  const level = useMemo(
    () => (wSport ? (athlete?.survey?.sports?.find((s) => s.sport === wSport)?.experience ?? null) : null),
    [athlete, wSport],
  );
  const sport = w ? sportOf(w.sport) : null;
  const gpsOn = !!sport && usesGps(sport);
  // Speed zones (ADR-0044): only while no heart rate is streaming, for a GPS sport that has them.
  const sportKey = w?.sport;
  const thresholds = useMemo(() => (sportKey ? speedThresholdsFor(sportKey, speedZones, level) : undefined), [sportKey, speedZones, level]);
  const speedOn = bpm === null && gpsOn && !!thresholds;
  const [speedZone, setSpeedZone] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  /** [elapsed s, metres] over the last minute, for the speed over the last 30 s. */
  const distRef = useRef<[number, number][]>([]);
  const zone = bpm !== null ? zoneOf(bpm, heart) : speedOn ? speedZone : 0;
  const zoneSource = bpm !== null ? "heart" : speedOn ? "speed" : null;

  // ── Restore after a reload ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!kv) return;
    void kv.get<WorkoutSnapshot>(WORKOUT_KEY).then((saved) => {
      if (!saved || saved.v !== 1 || saved.userId !== me.id || wRef.current) return;
      // A planned session's machine comes back only when it still checks out (else the workout runs free).
      const r = afterReload({ ...saved, adaptive: restoreAdaptive(saved.adaptive) });
      wRef.current = r;
      setW(r);
      setRestored(true);
    });
  }, [kv, me.id]);

  // ── Persist (every change, at most every 3 s, and when the page hides) ───────────────────────────────────────
  const savedAt = useRef(0);
  useEffect(() => {
    if (!kv || !w || restored) return;
    const t = Date.now();
    if (t - savedAt.current < 3000 && !isPaused(w)) return;
    savedAt.current = t;
    void kv.set(WORKOUT_KEY, w);
  }, [kv, w, restored]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden" && wRef.current && kv) void kv.set(WORKOUT_KEY, wRef.current);
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
    };
  }, [kv]);

  // ── Speaking ─────────────────────────────────────────────────────────────────────────────────────────────────
  // The workout voice switch: off says nothing, essential only the essentials (start, pause, end, and the cues quiet
  // chattiness allows); the line stays on screen either way. Muting stops the line speaking now (AppContext: hush()).
  const speak = useCallback(
    (line: Spoken, essential = false) => {
      const text = line.text;
      setLastCue(text);
      window.setTimeout(() => setLastCue((x) => (x === text ? null : x)), 4000);
      if (workoutVoice === "on" || (workoutVoice === "essential" && essential)) playCue(line);
    },
    [workoutVoice],
  );

  // ── The clock: a tick a second (samples every 10 s, cues) ─────────────────────────────────────────────────────
  const zoneRef = useRef({ zone: -1, since: 0, spoken: -1 });
  const splitCount = useRef(0);
  /** Elapsed seconds at the last full km (or mile): the next split's own time. */
  const splitAt = useRef(0);
  const energyCueSaid = useRef(false);
  useEffect(() => {
    if (!w || summary || restored) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      update((x) => tick(x, t));
      const cur = wRef.current;
      if (!cur || isPaused(cur)) return;
      const s = elapsedS(cur, t);
      // The speed over the last 30 s (GPS distance), for the speed zone when there is no heart rate.
      const d = distRef.current;
      if (!d.length || d[d.length - 1]![0] < s) d.push([s, cur.track.metres]);
      while (d.length && d[0]![0] < s - 60) d.shift();
      const kmh = speedOn ? windowSpeedKmh(d) : 0;
      const sz = speedOn && thresholds ? zoneOfSpeed(kmh, thresholds) : 0;
      if (sz !== speedZone) setSpeedZone(sz);
      setSpeedKmh((x) => (Math.abs(x - kmh) < 0.05 ? x : kmh));
      const z = zoneRef.current;
      const level = workoutChattiness(workoutVoice, prefs.chattiness) ?? "quiet";
      // A planned session (ADR-0069): the engine steps every second and says its own cues (no zone cues then).
      if (cur.adaptive && !cur.adaptive.state.done) {
        const pkmh = gpsOn ? windowSpeedKmh(d) : 0;
        const hr = bpm !== null ? zoneOf(bpm, heart) : 0;
        const r = stepAdaptive(cur.adaptive, {
          t: s,
          ...(hr > 0 ? { zone: hr, bpm: bpm ?? undefined } : {}),
          ...(pkmh > 1 ? { paceSPerKm: 3600 / pkmh } : {}),
        });
        update((x) => ({ ...x, adaptive: r.a }));
        for (const c of r.cues) {
          const v = vibrationOf(c);
          if (v)
            try {
              navigator.vibrate?.(v);
            } catch {
              // not allowed here
            }
          speak(cueSpokenOf(c, lang), cueEssential(c));
        }
      }
      // A zone settled for 15 s is said once.
      if (cur.adaptive) {
        // the engine speaks for the zones
      } else if (zone !== z.zone) {
        z.zone = zone;
        z.since = s;
      } else if (s - z.since === 15 && zone > 0 && zone !== z.spoken) {
        z.spoken = zone;
        if (cueAllowed(level, "zone", zone)) speak(cueSpoken.zone(lang, zone), true);
      }
      // Each full km (or mile) outdoors, with its split; every 5 minutes indoors.
      const unit = prefs.units === "imperial" ? MILE_M : 1000;
      const full = Math.floor(cur.track.metres / unit);
      if (gpsOn && full > splitCount.current) {
        const imperial = prefs.units === "imperial";
        // One split at a time (a GPS jump over two): its own time only when it is a single one.
        const splitS = full === splitCount.current + 1 ? s - splitAt.current : null;
        splitCount.current = full;
        splitAt.current = s;
        if (cueAllowed(level, "split")) speak(cueSpoken.split(lang, full, spokenClock(s), imperial, splitS), true);
        void prefetchLines(splitLines(full + 1, null, imperial));
      } else if (s > 0 && s % 300 === 0 && (!gpsOn ? cueAllowed(level, "minutes") : level === "chatty")) {
        speak(cueSpoken.minutes(lang, s / 60, zone), true);
      }
      // Energy used up (heart rate only: without it nothing is scored anyway).
      const cap = cur.energyAtStart * MINUTES_PER_ENERGY * 60;
      if (!energyCueSaid.current && cur.bpm && s >= cap && cap >= 0) {
        energyCueSaid.current = true;
        speak(cueSpoken.energy(lang));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    w,
    summary,
    restored,
    update,
    zone,
    prefs.chattiness,
    prefs.units,
    gpsOn,
    lang,
    speak,
    speedOn,
    thresholds,
    speedZone,
    workoutVoice,
    bpm,
    heart,
  ]);

  // ── Heart rate from the sensor ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bpm === null || !wRef.current || summary) return;
    update((x) => withHeart(x, bpm, Date.now()));
  }, [bpm, summary, update]);
  const prevSensor = useRef(sensorState);
  useEffect(() => {
    if (wRef.current && !summary) {
      if (prevSensor.current === "connected" && sensorState === "reconnecting") speak(cueSpoken.sensorLost(lang));
      if (prevSensor.current === "reconnecting" && sensorState === "connected") speak(cueSpoken.sensorBack(lang));
    }
    prevSensor.current = sensorState;
  }, [sensorState, summary, speak, lang]);

  const speedFixes = useRef<SpeedFix[]>([]);
  // Auto-pause (build 59): the account's choice per sport, read on every fix (the GPS watch isn't re-subscribed for it).
  const autoPausePrefs = useMemo(() => parseAutoPausePrefs(me.prefs?.autoPause), [me.prefs?.autoPause]);
  const autoPausePrefsRef = useRef(autoPausePrefs);
  useEffect(() => {
    autoPausePrefsRef.current = autoPausePrefs;
  }, [autoPausePrefs]);
  const autoFeedback = useRef<(a: AutoPauseAction) => void>(() => undefined);
  useEffect(() => {
    autoFeedback.current = (a) => {
      if (a?.kind !== "pause" && a?.kind !== "resume") return;
      // A short buzz where the browser has it (Android); iOS Safari has none. Spoken only as the workout voice allows.
      try {
        navigator.vibrate?.(40);
      } catch {
        // not allowed here
      }
      speak(a.kind === "pause" ? cueSpoken.paused(lang) : cueSpoken.resumed(lang), true);
    };
  }, [speak, lang]);
  // ── GPS ──────────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!w || !gpsOn || summary || restored || !("geolocation" in navigator)) return;
    // A foot sport never adds a fix-to-fix step faster than a person moves (the vehicle guard's hard maximum).
    const cap = sport ? distanceCapKmh(sport.key, sport.capKmh) : null;
    speedFixes.current = [];
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps("live");
        const t = Date.now();
        const fix = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          acc: p.coords.accuracy,
          alt: p.coords.altitude,
          at: p.timestamp || t,
        };
        const sp = speedReading(speedFixes.current, { ...fix, speed: p.coords.speed });
        speedFixes.current = sp.buffer;
        let action: AutoPauseAction = null;
        update((x) => {
          const r = addFix(x.track, fix, { t: elapsedS(x, t), now: t, capKmh: cap, paused: isPaused(x) });
          // The vehicle guard (foot sports): paused from where a ride began, resumed on foot.
          const v = vehicleStep({ ...x, track: r.state }, { now: t, speedMs: sp.speedMs }).w;
          // Auto-pause (build 59): back-dated pause at a stop, back-dated resume when moving again, or a card.
          const mode = autoPauseModeFor(v.sport, autoPausePrefsRef.current);
          const a = autoPauseStep(v, { now: t, speedMs: sp.speedMs, mode, fixes: speedFixes.current });
          action = a.action;
          return a.w;
        });
        autoFeedback.current(action);
      },
      (e) => setGps(e.code === e.PERMISSION_DENIED ? "denied" : "searching"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // Re-subscribed only when the workout itself starts, ends or changes sport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, gpsOn, summary, restored, update]);

  // ── Screen Wake Lock, asked again when the page comes back; a gap when it was hidden ───────────────────────────
  const lock = useRef<WakeLockSentinelLike | null>(null);
  const hiddenAt = useRef(0);
  useEffect(() => {
    if (!w || summary || restored) return;
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinelLike> } };
    const ask = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible")
        return setWakeLock(nav.wakeLock ? (lock.current ? !lock.current.released : false) : false);
      try {
        const s = await nav.wakeLock.request("screen");
        lock.current = s;
        setWakeLock(true);
        s.addEventListener("release", () => setWakeLock(false));
      } catch {
        setWakeLock(false);
      }
    };
    void ask();
    const vis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > 5000 && gpsOn) setGap(true);
        hiddenAt.current = 0;
        void ask();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
    // Asked again only when the workout itself starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id, summary, restored, gpsOn]);

  // ── Controls ─────────────────────────────────────────────────────────────────────────────────────────────────
  const start = useCallback(
    (
      sportKey: string,
      plan?: PlannedStart & { health?: { condition?: boolean | null; cleared?: boolean | null; easyOnly?: boolean | null } },
    ) => {
      if (wRef.current) return;
      // The Start tap: the one audio element and the browser voice are unlocked here (iOS Safari autoplay).
      unlockAudio();
      void warmVoice();
      const t = Date.now();
      const base = newWorkout({ id: uuid(), userId: me.id, sport: sportKey, now: t, energy: Math.floor(energy.current) });
      // A planned session (ADR-0069): its structure with the day's readiness, the health cap and your set paces.
      const ad =
        plan && adaptiveOn(me)
          ? startAdaptive(plan, {
              sport: sportKey,
              prefs: parseAdaptivePrefs(me.prefs?.adaptive),
              level: suggestLevel,
              readiness: cachedReadiness(me.id),
              zoneCap: zoneCapOf(plan.health),
              paces: pacesOf(speedZones?.sports?.[sportKey]),
            })
          : null;
      const fresh = ad ? { ...base, adaptive: ad } : base;
      wRef.current = fresh;
      setW(fresh);
      setSummary(null);
      setGap(false);
      setGps("searching");
      setNow(t);
      zoneRef.current = { zone: -1, since: 0, spoken: -1 };
      distRef.current = [];
      setSpeedZone(0);
      setSpeedKmh(0);
      splitCount.current = 0;
      splitAt.current = 0;
      energyCueSaid.current = false;
      void kv?.set(WORKOUT_KEY, fresh);
      speak(cueSpoken.start(lang, me.name ?? "", sportLabel(sportKey, lang)), true);
    },
    [me, energy, kv, lang, speak, suggestLevel, speedZones],
  );
  const answerEffort = useCallback(
    (tap: RpeTap) => update((x) => (x.adaptive ? { ...x, adaptive: answerAdaptive(x.adaptive, tap) } : x)),
    [update],
  );
  const heard = useCallback(
    (text: string) => {
      const said = classifySaid(text);
      if (said) update((x) => (x.adaptive && !x.adaptive.state.done ? { ...x, adaptive: heardAdaptive(x.adaptive, said) } : x));
    },
    [update],
  );
  const pause = useCallback(() => {
    unlockAudio();
    update((x) => ({ ...pauseW(x, Date.now()), autoPaused: false, autoCard: null }));
    speak(cueSpoken.paused(lang), true);
  }, [update, speak, lang]);
  const resume = useCallback(() => {
    unlockAudio();
    update((x) => ({
      ...(inVehicle(x) ? vehicleResumeNow(x, Date.now()) : resumeW(x, Date.now())),
      autoPaused: false,
      autoCard: null,
    }));
    speak(cueSpoken.resumed(lang), true);
  }, [update, speak, lang]);
  const acceptCard = useCallback(() => {
    unlockAudio();
    const card = wRef.current?.autoCard;
    if (!card) return;
    update((x) => acceptAutoCard(x, Date.now()));
    speak(card.kind === "pause" ? cueSpoken.paused(lang) : cueSpoken.resumed(lang), true);
  }, [update, speak, lang]);
  const dismissCard = useCallback(() => update(dismissAutoCard), [update]);
  const confirmRestore = useCallback(() => {
    setRestored(false);
    setGap(true);
  }, []);

  const clear = useCallback(() => {
    wRef.current = null;
    setW(null);
    setRestored(false);
    void kv?.del(WORKOUT_KEY);
  }, [kv]);

  const discard = useCallback(() => {
    hush();
    clear();
    setSummary(null);
  }, [clear]);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  const end = useCallback(() => {
    const cur = wRef.current;
    if (!cur) return;
    unlockAudio();
    const t = Date.now();
    const done = { ...pauseW(tick(cur, t), t), endedAt: t };
    const activeS = elapsedS(done, t);
    const hrSamples = done.samples.filter((s) => s.bpm !== undefined).length;
    const unit = prefs.units === "imperial" ? MILE_M : 1000;
    const splits = splitsOf(done.track.route, unit);
    const gpsUsed = usesGps(sportOf(done.sport));
    // Mostly a ride (build 58): saved for the journal, "Not counted: vehicle detected", never discarded as empty.
    const vehicle = vehicleOutcome(done, activeS, t);
    if (vehicle.verdict !== "vehicle" && emptyReason(activeS, done.track.metres, hrSamples)) {
      hush();
      clear();
      setSummary({ session: null, discarded: true, reply: null, uploading: false, queued: false, splits: [], gainM: 0 });
      return;
    }
    const built = buildSession(done, { now: t, deviceKey, heart, gps: gpsUsed, vehicle });
    // A planned session: the structure, what happened and the effort answers go up with it (the API checks them).
    const ad = done.adaptive && adaptiveOn(me) ? adaptiveUpload(done.adaptive, activeS) : null;
    const session = ad ? { ...built, ...ad } : built;
    // Scored minutes spend energy (what's left refills four times a day).
    if (session.energyUsed) setEnergy(spend(energy, session.energyUsed));
    const q = enqueue(queueRef.current, me.id, session);
    setQueue(q);
    clear();
    hush();
    if (workoutVoice !== "off") playCue(cueSpoken.done(lang, Math.floor(activeS / 60)));
    setSummary({
      session,
      discarded: false,
      reply: null,
      uploading: true,
      queued: true,
      splits,
      gainM: done.track.gainM,
      spot: gpsUsed ? spotOfRoute(done.track.route) : null,
      adaptive: ad?.adaptive ?? null,
    });
    void api
      .upload(session, localTz())
      .then((reply) => {
        setQueue(queueRef.current.filter((x) => x.session.id !== session.id));
        setSummary((s) => (s && s.session?.id === session.id ? { ...s, reply, uploading: false, queued: false } : s));
        const pts = reply.points?.total ?? reply.session?.points ?? 0;
        if (workoutVoice === "on") playCue(!hrSamples ? cueSpoken.noSensor(lang) : cueSpoken.points(lang, pts));
        void refresh();
      })
      .catch(() => setSummary((s) => (s && s.session?.id === session.id ? { ...s, uploading: false } : s)));
  }, [prefs.units, workoutVoice, deviceKey, heart, energy, setEnergy, me, setQueue, clear, lang, api, refresh]);

  const closeSummary = useCallback(() => setSummary(null), []);

  // Leaving the page mid-workout: the browser asks first (the snapshot is saved anyway).
  useEffect(() => {
    if (!w || summary) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [w, summary]);

  const value: WorkoutApi = {
    w,
    restored,
    now,
    gps: !w || !gpsOn ? "off" : typeof navigator !== "undefined" && !("geolocation" in navigator) ? "unsupported" : gps,
    accuracy: w?.track.accuracy ?? null,
    bars: gpsBars(w?.track.accuracy ?? null),
    zone,
    zoneSource,
    speedKmh: zoneSource === "speed" && speedKmh > 0 ? speedKmh : null,
    paceKind: paceKind(w?.sport ?? ""),
    rpe: !!heartZones?.rpe,
    roughGuide: !!w && hrIsRoughGuide(w.sport),
    heart,
    wakeLock,
    gap,
    vehicle: inVehicle(w),
    autoPaused: !!w?.pausedAt && !!w.autoPaused,
    autoCard: w?.autoCard ?? null,
    acceptAutoCard: acceptCard,
    dismissAutoCard: dismissCard,
    summary,
    adaptive:
      w?.adaptive && !summary
        ? {
            view: viewOf(w.adaptive, elapsedS(w, now), bpm !== null),
            asking: w.adaptive.askT !== null,
            ...(w.adaptive.structure.eased ? { eased: w.adaptive.structure.eased } : {}),
            fixed: w.adaptive.timing === "fixed" || !w.adaptive.structure.adaptive,
            hasHr: bpm !== null,
          }
        : null,
    answerEffort,
    heard,
    start,
    pause,
    resume,
    end,
    discard,
    confirmRestore,
    closeSummary,
    lastCue,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
