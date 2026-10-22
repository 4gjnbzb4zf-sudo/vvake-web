"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { fmt, type WebAppDict } from "@/i18n/webapp";
import { ApiError, RewardsSession, browserDeviceId } from "@/lib/rewardsApi";
import { localTz, webApi, type ApiSession, type AppAthlete, type AppMe, type Stats, type Streak, type WebApi } from "@/lib/webapp/api";
import { HeartSensor, type SensorState } from "@/lib/webapp/ble";
import type { Units } from "@/lib/webapp/format";
import { parseGoals, type WebGoal } from "@/lib/webapp/goals";
import { afterUpload, openKV, QUEUE_KEY, type KV, type Queued } from "@/lib/webapp/store";
import { configureVoice, hush, warmVoice } from "@/lib/webapp/coachAudio";
import type { Chattiness } from "@/lib/webapp/voice";
import type { SportSpeedSetting, SpeedZonesPrefs, WorkoutVoiceMode, WorkoutVoicePref } from "@/lib/webapp/speedZones";
import type { HeartZonesPrefs } from "@/lib/webapp/sportHeart";
import {
  heartKey,
  parseHeartZones,
  parseSpeedZones,
  parseWorkoutVoice,
  readStored,
  reconcile,
  voiceKey,
  writeStored,
  zonesKey,
} from "@/lib/webapp/workoutPrefs";
import { voiceMode } from "@/lib/webapp/voicePick";
import { maxEnergy, refill, type EnergyState, type WebSession } from "@/lib/webapp/workout";
import { useNow } from "./useNow";

/**
 * Everything the web app's screens share: the signed-in session and the API, the account (me, athlete, stats,
 * streak, recent sessions), this browser's settings (units, voice), goals and energy, the upload queue, the route
 * (hash), and the heart-rate sensor (one connection for the whole visit, so it survives moving between tabs).
 */

export type Route =
  | { name: "today" | "plan" | "crew" | "coach" | "you" | "goals" | "rhythm" | "vvaker" | "sensor" | "workout" | "zones" }
  /** You, scrolled to the VV points card (Today's points pill). */
  | { name: "points" }
  | { name: "session"; id: string }
  /** The camera workout (CameraScreen.tsx), with the sport whose routine it suggests (#/camera/strength). */
  | { name: "camera"; sport?: string }
  /** Where to train near me (PlacesScreen.tsx), for a sport (#/places/swim). */
  | { name: "places"; sport?: string }
  /**
   * Custom trainings (ADR-0047, TrainingsScreen.tsx). `ref` is a share code (8 letters) or a training id (t_…):
   * #/train/<ref>(/<challenge>) runs it with the webcam, #/training/<ref>(/<challenge>) shows it.
   */
  | { name: "trainings" | "teach" | "coach-profile" }
  | { name: "train" | "training"; ref: string; challenge?: string }
  | { name: "build"; id?: string }
  | { name: "creator"; handle: string }
  /** Season plans (ADR-0050): the season, a goal (new without id), the weekly sports, the health context, the history. */
  | { name: "season" | "season-sports" | "season-health" | "season-history" }
  | { name: "season-goal"; id?: string };

export const TABS = ["today", "plan", "trainings", "crew", "coach", "you"] as const;

const TRAINING_REF = /^([A-HJ-NP-Z2-9]{8}|t_[a-z0-9]{10})$/;
const CHALLENGE_REF = /^[A-HJ-NP-Z2-9]{8}$/;

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [name, arg] = h.split("/");
  if (name === "session" && arg) return { name: "session", id: decodeURIComponent(arg) };
  if (name === "camera") return arg && /^[a-z-]{2,30}$/.test(arg) ? { name: "camera", sport: arg } : { name: "camera" };
  if (name === "places") return arg && /^[a-z-]{2,30}$/.test(arg) ? { name: "places", sport: arg } : { name: "places" };
  if (name === "train" || name === "training") {
    const parts = h.split("/");
    const ref = /^t_/i.test(parts[1] ?? "") ? (parts[1] ?? "").toLowerCase() : (parts[1] ?? "").toUpperCase();
    const ch = (parts[2] ?? "").toUpperCase();
    if (!TRAINING_REF.test(ref)) return { name: "trainings" };
    return CHALLENGE_REF.test(ch) ? { name, ref, challenge: ch } : { name, ref };
  }
  if (name === "build") return arg && /^t_[a-z0-9]{10}$/.test(arg) ? { name: "build", id: arg } : { name: "build" };
  if (name === "creator")
    return arg && /^[a-z0-9_]{3,20}$/i.test(arg) ? { name: "creator", handle: arg.toLowerCase() } : { name: "trainings" };
  if (name === "trainings" || name === "teach" || name === "coach-profile") return { name };
  if (name === "season-goal") return arg && /^sg[a-z0-9]{4,24}$/.test(arg) ? { name, id: arg } : { name };
  if (name === "season" || name === "season-sports" || name === "season-health" || name === "season-history") return { name };
  const known = ["today", "plan", "crew", "coach", "you", "points", "goals", "rhythm", "vvaker", "sensor", "workout", "zones"] as const;
  return { name: (known as readonly string[]).includes(name ?? "") ? (name as (typeof known)[number]) : "today" };
}

export const routeHash = (r: Route) =>
  r.name === "session"
    ? `#/session/${encodeURIComponent(r.id)}`
    : r.name === "camera" || r.name === "places"
      ? `#/${r.name}${r.sport ? `/${r.sport}` : ""}`
      : r.name === "train" || r.name === "training"
        ? `#/${r.name}/${r.ref}${r.challenge ? `/${r.challenge}` : ""}`
        : r.name === "build"
          ? `#/build${r.id ? `/${r.id}` : ""}`
          : r.name === "creator"
            ? `#/creator/${r.handle}`
            : r.name === "season-goal"
              ? `#/season-goal${r.id ? `/${r.id}` : ""}`
              : `#/${r.name}`;

export interface Prefs {
  units: Units;
  chattiness: Chattiness;
  speakReplies: boolean;
}

const PREFS_KEY = "vvake-app-prefs";
const DEFAULT_PREFS: Prefs = { units: "metric", chattiness: "normal", speakReplies: false };

/** Before ADR-0044 this browser kept an on/off voice in its prefs: the starting point until a choice is made. */
const legacyVoiceOff = () =>
  readLocal(PREFS_KEY, (raw) => {
    try {
      return raw ? (JSON.parse(raw) as { voice?: unknown }).voice === false : false;
    } catch {
      return false;
    }
  });

function readLocal<T>(key: string, parse: (raw: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: kept for this visit only
  }
}

export interface AppState {
  lang: Locale;
  t: WebAppDict;
  apiUrl: string;
  session: RewardsSession;
  api: WebApi;
  deviceKey: string;
  me: AppMe;
  setMe: (m: AppMe) => void;
  athlete: AppAthlete | null;
  setAthlete: (a: AppAthlete | null) => void;
  stats: Stats | null;
  streak: Streak | null;
  sessions: ApiSession[];
  refresh: () => Promise<void>;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  /** The workout voice switch (ADR-0044): this browser's choice, synced with the account (newest wins). */
  workoutVoice: WorkoutVoiceMode;
  setWorkoutVoice: (m: WorkoutVoiceMode) => void;
  /** Speed zones per sport (ADR-0044), null until set on any device. */
  speedZones: SpeedZonesPrefs | null;
  setSpeedZones: (sports: Record<string, SportSpeedSetting>) => void;
  /** Heart zones per sport and effort by feel (ADR-0048), null until set on any device. */
  heartZones: HeartZonesPrefs | null;
  /** Saves the whole object (stamp it with withSportHeart / withRpe): kept here and sent to the account. */
  setHeartZones: (p: HeartZonesPrefs) => void;
  goals: WebGoal[];
  setGoals: (g: WebGoal[]) => void;
  energy: EnergyState;
  setEnergy: (e: EnergyState) => void;
  energyMax: number;
  kv: KV | null;
  queue: Queued<WebSession>[];
  setQueue: (q: Queued<WebSession>[]) => void;
  flush: () => Promise<void>;
  online: boolean;
  route: Route;
  go: (r: Route) => void;
  sensor: HeartSensor;
  sensorState: SensorState;
  bpm: number | null;
  battery: number | null;
  signOut: () => void;
  fmt: typeof fmt;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside the web app");
  return v;
}

export function AppProvider({
  lang,
  t,
  apiUrl,
  session,
  me: initialMe,
  onSignedOut,
  children,
}: {
  lang: Locale;
  t: WebAppDict;
  apiUrl: string;
  session: RewardsSession;
  me: AppMe;
  onSignedOut: () => void;
  children: ReactNode;
}) {
  const api = useMemo(() => webApi(session), [session]);
  const [me, setMe] = useState<AppMe>(initialMe);
  const [athlete, setAthlete] = useState<AppAthlete | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(() =>
    readLocal(PREFS_KEY, (raw) => ({ ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) })),
  );
  const goalsKey = `vvake-app-goals:${me.id}`;
  const energyKey = `vvake-app-energy:${me.id}`;
  const [goals, setGoalsState] = useState<WebGoal[]>(() => readLocal(goalsKey, parseGoals));
  const energyMax = maxEnergy(streak?.days ?? 0);
  const [energyRaw, setEnergyRaw] = useState<EnergyState | null>(() =>
    readLocal(energyKey, (raw) => {
      try {
        return raw ? (JSON.parse(raw) as EnergyState) : null;
      } catch {
        return null;
      }
    }),
  );
  const clockNow = useNow(60_000);
  const energy = useMemo(
    () => refill(energyRaw, clockNow, energyMax, -new Date(clockNow).getTimezoneOffset()),
    [energyRaw, energyMax, clockNow],
  );
  const [kv, setKv] = useState<KV | null>(null);
  const [queue, setQueueState] = useState<Queued<WebSession>[]>([]);
  const [online, setOnline] = useState(true);
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [sensorState, setSensorState] = useState<SensorState>("idle");
  const [bpm, setBpm] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [sensor] = useState(
    () =>
      new HeartSensor({
        onState: (s) => {
          setSensorState(s);
          if (s !== "connected") setBpm(null);
        },
        onReading: (b) => setBpm(b),
        onBattery: (p) => setBattery(p),
      }),
  );
  const deviceKey = useMemo(() => browserDeviceId(), []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((old) => {
      const next = { ...old, ...p };
      writeLocal(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const setGoals = useCallback(
    (g: WebGoal[]) => {
      setGoalsState(g);
      writeLocal(goalsKey, JSON.stringify(g));
    },
    [goalsKey],
  );
  const setEnergy = useCallback(
    (e: EnergyState) => {
      setEnergyRaw(e);
      writeLocal(energyKey, JSON.stringify(e));
    },
    [energyKey],
  );

  // ── The two workout settings kept with the account (ADR-0044): ours per account, the account's adopted when newer ──
  const [voicePref, setVoicePref] = useState<WorkoutVoicePref | null>(() => readStored(voiceKey(me.id), parseWorkoutVoice));
  const [legacyOff] = useState(legacyVoiceOff);
  const workoutVoice: WorkoutVoiceMode = voicePref?.mode ?? (legacyOff ? "off" : "on");
  const [speedZones, setSpeedZonesState] = useState<SpeedZonesPrefs | null>(() => readStored(zonesKey(me.id), parseSpeedZones));
  const [heartZones, setHeartZonesState] = useState<HeartZonesPrefs | null>(() => readStored(heartKey(me.id), parseHeartZones));
  const voiceRef = useRef(voicePref);
  const zonesRef = useRef(speedZones);
  const heartRef = useRef(heartZones);
  /** The heart zones last sent: an API that doesn't keep them yet never answers with them, so each is sent once a visit. */
  const heartSentAt = useRef<string | null>(null);
  const pushPrefs = useCallback(
    (p: { workoutVoice?: WorkoutVoicePref; speedZones?: SpeedZonesPrefs; heartZones?: HeartZonesPrefs }) =>
      void api
        .patchMe({ prefs: p })
        .then(setMe)
        .catch(() => undefined), // offline: ours is newer, sent on the next load
    [api],
  );
  const adoptVoice = useCallback(
    (p: WorkoutVoicePref) => {
      voiceRef.current = p;
      setVoicePref(p);
      writeStored(voiceKey(me.id), p);
      // Muted from here or from another device: the line speaking now stops and nothing queued is said.
      if (p.mode === "off") hush();
    },
    [me.id],
  );
  const adoptZones = useCallback(
    (p: SpeedZonesPrefs) => {
      zonesRef.current = p;
      setSpeedZonesState(p);
      writeStored(zonesKey(me.id), p);
    },
    [me.id],
  );
  const adoptHeart = useCallback(
    (p: HeartZonesPrefs) => {
      heartRef.current = p;
      setHeartZonesState(p);
      writeStored(heartKey(me.id), p);
    },
    [me.id],
  );
  const setHeartZones = useCallback(
    (p: HeartZonesPrefs) => {
      adoptHeart(p);
      heartSentAt.current = p.at;
      pushPrefs({ heartZones: p });
    },
    [adoptHeart, pushPrefs],
  );
  const setWorkoutVoice = useCallback(
    (mode: WorkoutVoiceMode) => {
      const p = { mode, at: new Date().toISOString() };
      adoptVoice(p);
      pushPrefs({ workoutVoice: p });
    },
    [adoptVoice, pushPrefs],
  );
  const setSpeedZones = useCallback(
    (sports: Record<string, SportSpeedSetting>) => {
      const p = { at: new Date().toISOString(), sports };
      adoptZones(p);
      pushPrefs({ speedZones: p });
    },
    [adoptZones, pushPrefs],
  );
  const accountVoiceRaw = me.prefs?.workoutVoice;
  const accountZonesRaw = me.prefs?.speedZones;
  const accountHeartRaw = me.prefs?.heartZones;
  useEffect(() => {
    const v = reconcile(voiceRef.current, parseWorkoutVoice(accountVoiceRaw));
    const z = reconcile(zonesRef.current, parseSpeedZones(accountZonesRaw));
    const h = reconcile(heartRef.current, parseHeartZones(accountHeartRaw));
    const id = window.setTimeout(() => {
      if (v.adopt) adoptVoice(v.adopt);
      if (z.adopt) adoptZones(z.adopt);
      if (h.adopt) adoptHeart(h.adopt);
    }, 0);
    const heartPush = h.push && h.push.at !== heartSentAt.current ? h.push : undefined;
    if (heartPush) heartSentAt.current = heartPush.at;
    if (v.push || z.push || heartPush)
      pushPrefs({
        ...(v.push ? { workoutVoice: v.push } : {}),
        ...(z.push ? { speedZones: z.push } : {}),
        ...(heartPush ? { heartZones: heartPush } : {}),
      });
    return () => window.clearTimeout(id);
  }, [accountVoiceRaw, accountZonesRaw, accountHeartRaw, adoptVoice, adoptZones, adoptHeart, pushPrefs]);

  const tz = useMemo(() => localTz(), []);
  const refresh = useCallback(async () => {
    const [st, sk, ss, at] = await Promise.allSettled([api.stats(tz), api.streak(tz), api.sessions(), api.athlete()]);
    if (st.status === "fulfilled") setStats(st.value);
    if (sk.status === "fulfilled") setStreak(sk.value);
    if (ss.status === "fulfilled") setSessions(ss.value.sessions);
    if (at.status === "fulfilled") setAthlete(at.value);
    const failed = [st, sk, ss].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed && failed.reason instanceof ApiError && failed.reason.status === 401) onSignedOut();
  }, [api, tz, onSignedOut]);

  // The queue lives in IndexedDB; only this account's sessions are sent with this account's sign-in.
  const queueRef = useRef(queue);
  const setQueue = useCallback(
    (q: Queued<WebSession>[]) => {
      queueRef.current = q;
      setQueueState(q);
      void kv?.set(QUEUE_KEY, q);
    },
    [kv],
  );
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    const mine = queueRef.current.filter((x) => x.userId === me.id).slice(0, 20);
    if (!mine.length) return;
    flushing.current = true;
    try {
      const r = await api.uploadBatch(
        mine.map((x) => x.session),
        tz,
      );
      setQueue(afterUpload(queueRef.current, r.results));
      void refresh();
    } catch {
      // offline or refused for now: the queue stays, the next try is on reconnect or the next launch
    } finally {
      flushing.current = false;
    }
  }, [api, me.id, tz, setQueue, refresh]);

  useEffect(() => {
    let alive = true;
    void openKV().then(async (store) => {
      if (!alive) return;
      setKv(store);
      const q = ((await store.get<Queued<WebSession>[]>(QUEUE_KEY)) ?? []).filter((x) => x && x.session && typeof x.userId === "string");
      queueRef.current = q;
      setQueueState(q);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (kv && navigator.onLine) void flush();
  }, [kv, flush]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const on = () => {
      setOnline(true);
      void flush();
      void refresh();
    };
    const off = () => setOnline(false);
    const id = window.setTimeout(() => setOnline(navigator.onLine), 0);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(id);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh, flush]);

  // Hash routing: the back button and links work as in any page.
  useEffect(() => {
    const read = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((r: Route) => {
    const h = routeHash(r);
    if (window.location.hash !== h) window.location.hash = h;
    else setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  // The coach's voice: the account's choice (the app's Coach voice), language and units (the workout's voice toggle
  // and "Read replies aloud" decide what is said: WorkoutContext, CoachScreen).
  // The voice pack is fetched into this browser a few seconds after the app opens, so the first cue plays at once.
  const accountVoice = me.coach?.voice;
  useEffect(() => {
    configureVoice({ api, session, apiUrl, lang, imperial: prefs.units === "imperial", mode: voiceMode(true, accountVoice) });
    const id = window.setTimeout(() => void warmVoice(), 4000);
    return () => window.clearTimeout(id);
  }, [api, session, apiUrl, lang, prefs.units, accountVoice]);

  // The sensor paired on an earlier visit, without the picker where the browser allows it.
  useEffect(() => {
    void sensor.reconnectRemembered();
    return () => sensor.disconnect();
  }, [sensor]);

  const signOut = useCallback(() => {
    hush();
    sensor.disconnect();
    void session.signOut().then(onSignedOut);
  }, [session, sensor, onSignedOut]);

  const value: AppState = {
    lang,
    t,
    apiUrl,
    session,
    api,
    deviceKey,
    me,
    setMe,
    athlete,
    setAthlete,
    stats,
    streak,
    sessions,
    refresh,
    prefs,
    setPrefs,
    workoutVoice,
    setWorkoutVoice,
    speedZones,
    setSpeedZones,
    heartZones,
    setHeartZones,
    goals,
    setGoals,
    energy,
    setEnergy,
    energyMax,
    kv,
    queue,
    setQueue,
    flush,
    online,
    route,
    go,
    sensor,
    sensorState,
    bpm,
    battery,
    signOut,
    fmt,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
