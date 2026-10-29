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
import { useApp } from "./AppContext";

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
  summary: Summary | null;
  start: (sport: string) => void;
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
  const { workoutVoice, speedZones, heartZones } = app;
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
      const r = afterReload(saved);
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
      // A zone settled for 15 s is said once.
      if (zone !== z.zone) {
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
  }, [w, summary, restored, update, zone, prefs.chattiness, prefs.units, gpsOn, lang, speak, speedOn, thresholds, speedZone, workoutVoice]);

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

  // ── GPS ──────────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!w || !gpsOn || summary || restored || !("geolocation" in navigator)) return;
    const cap = sport?.capKmh ?? null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps("live");
        const t = Date.now();
        update((x) => {
          const r = addFix(
            x.track,
            { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, at: p.timestamp || t },
            { t: elapsedS(x, t), now: t, capKmh: cap, paused: isPaused(x) },
          );
          return { ...x, track: r.state };
        });
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
    (sportKey: string) => {
      if (wRef.current) return;
      // The Start tap: the one audio element and the browser voice are unlocked here (iOS Safari autoplay).
      unlockAudio();
      void warmVoice();
      const t = Date.now();
      const fresh = newWorkout({ id: uuid(), userId: me.id, sport: sportKey, now: t, energy: Math.floor(energy.current) });
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
    [me.id, me.name, energy, kv, lang, speak],
  );
  const pause = useCallback(() => {
    unlockAudio();
    update((x) => pauseW(x, Date.now()));
    speak(cueSpoken.paused(lang), true);
  }, [update, speak, lang]);
  const resume = useCallback(() => {
    unlockAudio();
    update((x) => resumeW(x, Date.now()));
    speak(cueSpoken.resumed(lang), true);
  }, [update, speak, lang]);
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
    if (emptyReason(activeS, done.track.metres, hrSamples)) {
      hush();
      clear();
      setSummary({ session: null, discarded: true, reply: null, uploading: false, queued: false, splits: [], gainM: 0 });
      return;
    }
    const session = buildSession(done, { now: t, deviceKey, heart, gps: gpsUsed });
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
  }, [prefs.units, workoutVoice, deviceKey, heart, energy, setEnergy, me.id, setQueue, clear, lang, api, refresh]);

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
    summary,
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
