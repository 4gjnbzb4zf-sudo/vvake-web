"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addFix, gpsBars, splitsOf } from "@/lib/webapp/geo";
import { heartProfileOf, zoneOf, type HeartProfile } from "@/lib/webapp/heart";
import { localTz, type UploadReply } from "@/lib/webapp/api";
import { MILE_M } from "@/lib/webapp/format";
import { enqueue, WORKOUT_KEY } from "@/lib/webapp/store";
import { cueAllowed, cueText, hush, say, spokenClock } from "@/lib/webapp/voice";
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

  const heart = useMemo(() => heartProfileOf(athlete?.health ?? null, w?.sport), [athlete, w?.sport]);
  const zone = bpm !== null ? zoneOf(bpm, heart) : 0;
  const sport = w ? sportOf(w.sport) : null;
  const gpsOn = !!sport && usesGps(sport);

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
  const speak = useCallback(
    (text: string) => {
      setLastCue(text);
      window.setTimeout(() => setLastCue((x) => (x === text ? null : x)), 4000);
      if (prefs.voice) say(text, lang);
    },
    [prefs.voice, lang],
  );

  // ── The clock: a tick a second (samples every 10 s, cues) ─────────────────────────────────────────────────────
  const zoneRef = useRef({ zone: -1, since: 0, spoken: -1 });
  const splitCount = useRef(0);
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
      const z = zoneRef.current;
      const level = prefs.chattiness;
      // A zone settled for 15 s is said once.
      if (zone !== z.zone) {
        z.zone = zone;
        z.since = s;
      } else if (s - z.since === 15 && zone > 0 && zone !== z.spoken) {
        z.spoken = zone;
        if (cueAllowed(level, "zone", zone)) speak(cueText.zone(lang, zone));
      }
      // Each full km (or mile) outdoors, with its split; every 5 minutes indoors.
      const unit = prefs.units === "imperial" ? MILE_M : 1000;
      const full = Math.floor(cur.track.metres / unit);
      if (gpsOn && full > splitCount.current) {
        splitCount.current = full;
        if (cueAllowed(level, "split")) speak(cueText.split(lang, full, spokenClock(s), prefs.units === "imperial"));
      } else if (s > 0 && s % 300 === 0 && (!gpsOn ? cueAllowed(level, "minutes") : level === "chatty")) {
        speak(cueText.minutes(lang, s / 60, zone));
      }
      // Energy used up (heart rate only: without it nothing is scored anyway).
      const cap = cur.energyAtStart * MINUTES_PER_ENERGY * 60;
      if (!energyCueSaid.current && cur.bpm && s >= cap && cap >= 0) {
        energyCueSaid.current = true;
        speak(cueText.energy(lang));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [w, summary, restored, update, zone, prefs.chattiness, prefs.units, gpsOn, lang, speak]);

  // ── Heart rate from the sensor ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bpm === null || !wRef.current || summary) return;
    update((x) => withHeart(x, bpm, Date.now()));
  }, [bpm, summary, update]);
  const prevSensor = useRef(sensorState);
  useEffect(() => {
    if (wRef.current && !summary) {
      if (prevSensor.current === "connected" && sensorState === "reconnecting") speak(cueText.sensorLost(lang));
      if (prevSensor.current === "reconnecting" && sensorState === "connected") speak(cueText.sensorBack(lang));
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
      const t = Date.now();
      const fresh = newWorkout({ id: uuid(), userId: me.id, sport: sportKey, now: t, energy: Math.floor(energy.current) });
      wRef.current = fresh;
      setW(fresh);
      setSummary(null);
      setGap(false);
      setGps("searching");
      setNow(t);
      zoneRef.current = { zone: -1, since: 0, spoken: -1 };
      splitCount.current = 0;
      energyCueSaid.current = false;
      void kv?.set(WORKOUT_KEY, fresh);
      speak(cueText.start(lang, me.name ?? "", sportLabel(sportKey, lang)));
    },
    [me.id, me.name, energy, kv, lang, speak],
  );
  const pause = useCallback(() => {
    update((x) => pauseW(x, Date.now()));
    speak(cueText.paused(lang));
  }, [update, speak, lang]);
  const resume = useCallback(() => {
    update((x) => resumeW(x, Date.now()));
    speak(cueText.resumed(lang));
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
    if (prefs.voice) say(cueText.done(lang, Math.floor(activeS / 60)), lang);
    setSummary({ session, discarded: false, reply: null, uploading: true, queued: true, splits, gainM: done.track.gainM });
    void api
      .upload(session, localTz())
      .then((reply) => {
        setQueue(queueRef.current.filter((x) => x.session.id !== session.id));
        setSummary((s) => (s && s.session?.id === session.id ? { ...s, reply, uploading: false, queued: false } : s));
        const pts = reply.points?.total ?? reply.session?.points ?? 0;
        if (prefs.voice) say(!hrSamples ? cueText.noSensor(lang) : cueText.points(lang, pts), lang);
        void refresh();
      })
      .catch(() => setSummary((s) => (s && s.session?.id === session.id ? { ...s, uploading: false } : s)));
  }, [prefs.units, prefs.voice, deviceKey, heart, energy, setEnergy, me.id, setQueue, clear, lang, api, refresh]);

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
