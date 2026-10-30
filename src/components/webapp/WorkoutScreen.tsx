"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { bleSupport } from "@/lib/webapp/ble";
import { clock, distanceNumber, distanceUnit, elevation, pace, speed } from "@/lib/webapp/format";
import { paceOf } from "@/lib/webapp/geo";
import { sessionTimes, showsPaused } from "@/lib/webapp/moving";
import { getSportZonesDict } from "@/i18n/sportZones";
import { RPE_ZONES } from "@/lib/webapp/sportHeart";
import { kindValue, paceKindText, paceKindUnit, showsSpeed, toggleWorkoutVoice, WORKOUT_VOICE_MODES } from "@/lib/webapp/speedZones";
import { vehicleLine } from "@/lib/webapp/vehicle/journal";
import { elapsedS, isPaused, quickSportsFor, sportLabel, sportOf, usesGps, WEB_SPORTS } from "@/lib/webapp/workout";
import { sports as catalog } from "@/lib/sports";
import {
  cameraSport,
  defaultEntry,
  loadEntryChoices,
  saveEntryChoices,
  withEntryChoice,
  type EntryMode,
} from "@/lib/webapp/camera/webSetup";
import { useApp } from "./AppContext";
import { useVVakerSrc } from "./MyVVaker";
import { useWorkout } from "./WorkoutContext";
import { AdaptivePanel, AdaptiveSummaryCard } from "./AdaptiveLive";
import { Btn, Card, Kicker, Note, Small } from "./ui";
import { TalkButton } from "./TalkSheet";
import { FeelAfter } from "./Suggest";
import { NextStepsRow, Tour, useHasPlan } from "./NextSteps";
import { SessionCelebration, useLiving, usePrimeMilestones } from "./Journey";
import { gpsMoment, sessionsLast7 } from "@/lib/webapp/suggest/steps";
import type { SessionFeel } from "@/lib/webapp/api";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false });

/**
 * The workout (apps/mobile app/workout.tsx): pick a sport, then the live screen (the map with your VVaker following
 * you outdoors, your VVaker indoors; time, distance, pace or speed, heart rate and zone, climb; Pause, Resume, End with
 * a confirm), then the summary with the points from the server. The honest banner: keep the page open and the screen
 * on, tracking stops if the phone locks.
 */
export function WorkoutScreen() {
  const wk = useWorkout();
  // The milestones as they are before this session: the summary celebrates what it crossed (one per session).
  usePrimeMilestones(wk.w && !wk.summary ? wk.w.id : null);
  if (wk.summary) return <SummaryView />;
  if (wk.w && wk.restored) return <RestoreView />;
  if (wk.w) return <LiveView />;
  return <PickView />;
}

function SensorChip() {
  const { t, go, sensorState, bpm, fmt } = useApp();
  const [support] = useState(() => (typeof window === "undefined" ? null : bleSupport()));
  if (support !== "ok") return null;
  return (
    <button
      type="button"
      data-tour="workout-sensor"
      onClick={() => go({ name: "sensor" })}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
        sensorState === "connected" ? "border-pulse-fg/50 text-pulse-fg" : "border-line text-muted",
      )}
    >
      <span aria-hidden>♥</span>
      {sensorState === "connected" && bpm
        ? fmt(t.sensor.bpm, { n: bpm })
        : sensorState === "idle"
          ? t.sensor.connect
          : t.sensor[sensorState]}
    </button>
  );
}

/**
 * "With the camera" or "Heart only" for the sports the camera counts (strength, core, HIIT, yoga, mobility…), the
 * phone's choice (apps/mobile lib/cameraEntry.ts): the last pick per sport is highlighted, remembered in this browser.
 */
export function EntryChoice({ sport, onClose, onHeart }: { sport: string; onClose: () => void; onHeart: () => void }) {
  const { t, lang, go } = useApp();
  const c = t.camera;
  const [choices] = useState(() => loadEntryChoices());
  const def = defaultEntry(choices, sport);
  const pick = (m: EntryMode) => {
    saveEntryChoices(withEntryChoice(choices, sport, m));
    onClose();
    if (m === "camera") go({ name: "camera", sport });
    else onHeart();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.howTitle}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-night-2 p-5 ring-1 ring-line">
        <Kicker tone="volt">{sportLabel(sport, lang)}</Kicker>
        <p className="font-display text-xl font-semibold">{c.howTitle}</p>
        {(["camera", "heart"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pick(m)}
            className={cn("w-full rounded-2xl border bg-surface px-4 py-3 text-left", def === m ? "border-volt-fg" : "border-line")}
          >
            <span className="block font-display font-semibold">{m === "camera" ? c.withCamera : c.heartOnly}</span>
            <span className="block text-sm text-muted">{m === "camera" ? c.withCameraDetail : c.heartOnlyDetail}</span>
          </button>
        ))}
        <Small>{c.remembers}</Small>
        <Btn variant="ghost" className="w-full" onClick={onClose}>
          {t.common.cancel}
        </Btn>
      </div>
    </div>
  );
}

function PickView() {
  const { t, lang, go, profile } = useApp();
  // Your sports first, main first (build 56), then the usual ones.
  const quick = useMemo(() => quickSportsFor(profile?.sports), [profile?.sports]);
  const wk = useWorkout();
  const [asking, setAsking] = useState<string | null>(null);
  /** A sport the camera counts asks first; any other starts at once. */
  const pickSport = (k: string) => (cameraSport(k) ? setAsking(k) : wk.start(k));
  const [q, setQ] = useState("");
  const [support] = useState(() => (typeof window === "undefined" ? null : bleSupport()));
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? WEB_SPORTS.filter((s) => s.name[lang].toLowerCase().includes(n) || s.key.includes(n)) : WEB_SPORTS;
  }, [q, lang]);
  const groups = catalog.categories
    .map((c) => ({ key: c.key, title: c.name[lang], items: list.filter((s) => s.category === c.key) }))
    .filter((g) => g.items.length);
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]">
      <div className="flex items-center justify-between">
        <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "today" })}>
          ‹ {t.common.back}
        </button>
        <SensorChip />
      </div>
      <h1 className="mt-2 font-display text-2xl font-bold">{t.workout.pick}</h1>
      {support === "ios" && <Small className="mt-2">{t.sensor.unsupportedIos}</Small>}
      {support === "unsupported" && <Small className="mt-2">{t.sensor.unsupported}</Small>}
      <button
        type="button"
        data-tour="workout-camera"
        onClick={() => go({ name: "camera" })}
        className="mt-4 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-volt-fg/60 bg-surface px-4 text-left hover:border-volt-fg"
      >
        <span aria-hidden className="text-2xl">
          ◎
        </span>
        <span className="flex-1">
          <span className="block font-display font-semibold">{t.camera.tile}</span>
          <span className="block text-sm text-muted">{t.camera.tileDetail}</span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </button>
      <button
        type="button"
        onClick={() => go({ name: "places" })}
        className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left hover:border-mint-fg"
      >
        <span aria-hidden className="text-xl text-mint-fg">
          ⌖
        </span>
        <span className="flex-1">
          <span className="block font-display font-semibold">{t.places.entry}</span>
          <span className="block text-sm text-muted">{t.places.entryDetail}</span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </button>
      <Kicker className="mt-5">{t.workout.quick}</Kicker>
      <div className="mt-2 grid grid-cols-2 gap-2" data-tour="workout-sports">
        {quick.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickSport(k)}
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left font-display font-semibold hover:border-volt-fg"
          >
            {sportLabel(k, lang)}
            {usesGps(sportOf(k)) && (
              <span aria-hidden className="ml-auto text-xs text-faint">
                GPS
              </span>
            )}
          </button>
        ))}
      </div>
      <Kicker className="mt-6">{t.workout.all}</Kicker>
      <input
        className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-4"
        placeholder={t.workout.search}
        aria-label={t.workout.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-3 space-y-4">
        {groups.map((g) => (
          <section key={g.key}>
            <Small>{g.title}</Small>
            <div className="mt-1 flex flex-wrap gap-2">
              {g.items.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pickSport(s.key)}
                  className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
                >
                  {s.name[lang]}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6">
        <Note tone="butter">{t.workout.webRule}</Note>
      </div>
      {asking && <EntryChoice sport={asking} onClose={() => setAsking(null)} onHeart={() => wk.start(asking)} />}
      {/* The first time: a short tour of the picker's controls, before any start (ADR-0062 §14 A). */}
      <Tour id="gps" cards={t.tours.gps} />
    </div>
  );
}

function RestoreView() {
  const { t, lang, fmt } = useApp();
  const wk = useWorkout();
  const w = wk.w!;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4">
      <Kicker tone="pulse">{t.workout.resumeTitle}</Kicker>
      <p className="font-display text-xl font-semibold">
        {fmt(t.workout.resumeLead, { sport: sportLabel(w.sport, lang), time: clock(elapsedS(w, wk.now)) })}
      </p>
      <Btn big onClick={wk.confirmRestore}>
        {t.workout.resume}
      </Btn>
      <Btn big variant="ghost" onClick={wk.end}>
        {t.workout.endSave}
      </Btn>
      <Btn variant="danger" onClick={wk.discard}>
        {t.workout.discard}
      </Btn>
    </div>
  );
}

function LiveView() {
  const { t, lang, go, prefs, bpm, fmt } = useApp();
  const wk = useWorkout();
  const avatar = useVVakerSrc();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const w = wk.w!;
  const sport = sportOf(w.sport);
  const gps = usesGps(sport);
  const s = elapsedS(w, wk.now);
  const paused = isPaused(w);
  const m = w.track.metres;
  const p = gps ? paceOf(s, m) : null;
  const useSpeed = showsSpeed(w.sport);
  const gpsLine =
    wk.gps === "denied"
      ? t.workout.gps.denied
      : wk.gps === "unsupported"
        ? t.workout.gps.unsupported
        : wk.gps === "searching" || wk.accuracy === null
          ? t.workout.gps.searching
          : fmt(wk.bars >= 3 ? t.workout.gps.strong : wk.bars === 2 ? t.workout.gps.fair : t.workout.gps.weak, {
              n: Math.round(wk.accuracy),
            });

  const askEnd = () => setConfirmEnd(true);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night">
      {/* The map (outdoors) or your VVaker (indoors), under everything. */}
      <div className="relative min-h-0 flex-1">
        {gps ? (
          <LiveMap
            here={w.track.here}
            route={w.track.route}
            avatar={avatar.src}
            recenterLabel={t.workout.recenter}
            findingLabel={t.workout.finding}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-night-2 to-night">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.src} alt="" className={cn("h-3/4 max-h-96 w-auto object-contain", !paused && "animate-float")} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)]">
          <button
            type="button"
            onClick={() => go({ name: "today" })}
            className="pointer-events-auto h-11 rounded-full bg-night/85 px-4 text-sm font-semibold ring-1 ring-line"
            aria-label={t.workout.minimize}
          >
            ⌄ {sportLabel(w.sport, lang)}
          </button>
          <VoiceSwitch />
        </div>
        {wk.lastCue && (
          <p
            role="status"
            className="absolute inset-x-4 bottom-4 mx-auto max-w-md rounded-2xl bg-night/90 px-4 py-3 text-center text-sm font-semibold text-volt-fg ring-1 ring-line"
          >
            {wk.lastCue}
          </p>
        )}
      </div>

      {/* The numbers and the controls. */}
      <div className="border-t border-line bg-night-2 pt-3 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)]">
        <div className="mx-auto max-w-xl">
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium",
              wk.wakeLock === false ? "bg-butter/15 text-butter-fg" : "bg-surface text-muted",
            )}
            role="note"
          >
            {t.workout.keepOpen}{" "}
            {wk.wakeLock === true ? `· ${t.workout.wakeLockOn}` : wk.wakeLock === false ? `· ${t.workout.wakeLockOff}` : ""}
          </p>
          {wk.gap && <p className="mt-1 text-xs text-butter-fg">{t.workout.backgroundGap}</p>}
          <div className="mt-3 flex items-end justify-between">
            <div>
              <Kicker tone={paused ? "butter" : "pulse"}>{paused ? t.workout.paused : t.workout.elapsed}</Kicker>
              <p className="font-display text-5xl leading-none font-bold tabular-nums" aria-live="off">
                {clock(s)}
              </p>
            </div>
            <SensorChip />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {gps && <Metric label={t.workout.distance} value={distanceNumber(m, prefs.units, lang)} unit={distanceUnit(prefs.units)} />}
            {gps && (
              <Metric
                label={useSpeed ? t.workout.speed : t.workout.pace}
                // Swimming reads per 100 m (or yd), rowing per 500 m; the rest per km / mile or as a speed.
                value={
                  (wk.paceKind === "swim" || wk.paceKind === "row") && p
                    ? kindValue(3600 / p, wk.paceKind, prefs.units, lang)
                    : useSpeed
                      ? speed(p, prefs.units, lang)
                      : pace(p, prefs.units)
                }
                unit={(wk.paceKind === "swim" || wk.paceKind === "row") && p ? paceKindUnit(wk.paceKind, prefs.units) : undefined}
              />
            )}
            {gps && w.track.gainM > 0 && <Metric label={t.workout.elevation} value={elevation(w.track.gainM, prefs.units, lang)} />}
            {wk.zoneSource === "speed" ? (
              // No heart rate: the zone from speed (your speed zones for the sport), marked as such.
              <Metric
                label={`⏲ ${t.workout.speedZone}`}
                value={wk.zone > 0 ? (wk.rpe ? zoneWord(wk.zone, lang) : fmt(t.workout.zoneSpeed, { n: wk.zone })) : t.workout.noZone}
                // The speed it comes from, in the sport's unit (6:40 /km, 2:30 /100 m, 2:10 /500 m, 18 km/h).
                unit={wk.speedKmh ? paceKindText(wk.speedKmh, wk.paceKind, prefs.units) : undefined}
                small={wk.zone === 0}
              />
            ) : (
              <Metric
                label={t.workout.heart}
                value={bpm ? String(bpm) : "–"}
                // Effort by feel: the zone as an effort word, never a bpm target.
                unit={bpm ? (wk.zone > 0 ? (wk.rpe ? zoneWord(wk.zone, lang) : fmt(t.workout.zone, { n: wk.zone })) : "bpm") : undefined}
                tone={bpm ? "pulse" : undefined}
              />
            )}
          </dl>
          {wk.adaptive && <AdaptivePanel live={wk.adaptive} />}
          {gps ? <Small className="mt-2">{gpsLine}</Small> : <Small className="mt-2">{t.workout.noGpsIndoor}</Small>}
          {wk.zoneSource === "speed" && <Small className="mt-1">{t.zones.disclaimer}</Small>}
          {wk.roughGuide && bpm !== null && <Small className="mt-1">{getSportZonesDict(lang).roughGuide}</Small>}

          {wk.vehicle && (
            // The vehicle guard (build 58): calm, no accusation; it resumes by itself on foot (no need to touch the phone).
            <div className="mt-3 rounded-xl bg-butter/15 px-3 py-2 text-butter-fg" role="status" aria-live="polite">
              <p className="text-sm font-semibold">{t.workout.vehicleBanner}</p>
              <p className="text-xs">{t.workout.vehicleBannerHint}</p>
            </div>
          )}
          {wk.autoPaused && !wk.vehicle && (
            <p className="mt-3 text-sm text-butter-fg" role="status" aria-live="polite">
              {t.workout.autoPausedLine}
            </p>
          )}
          {wk.autoCard && !wk.vehicle && (
            // Auto-pause, Suggest mode (build 59): "Stopped? Pause" pauses from where the stop began; "Moving again? Resume".
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-volt/15 px-3 py-2" role="status" aria-live="polite">
              <p className="flex-1 text-sm font-semibold">{wk.autoCard.kind === "pause" ? t.workout.autoStopped : t.workout.autoMoving}</p>
              <Btn variant="volt" onClick={wk.acceptAutoCard}>
                {wk.autoCard.kind === "pause" ? t.workout.pause : t.workout.resume}
              </Btn>
              <Btn variant="ghost" onClick={wk.dismissAutoCard} aria-label={t.workout.autoNotNow}>
                ×
              </Btn>
            </div>
          )}
          {!confirmEnd ? (
            <div className="mt-3 flex gap-3">
              {paused ? (
                <Btn big variant="volt" className="flex-1" onClick={wk.resume}>
                  ▶ {t.workout.resume}
                </Btn>
              ) : (
                <Btn big variant="ghost" className="flex-1" onClick={wk.pause}>
                  ❚❚ {t.workout.pause}
                </Btn>
              )}
              <Btn big className="flex-1" onClick={askEnd}>
                ■ {t.workout.end}
              </Btn>
              {/* The coach, one tap, in the controls' own row (ADR-0068): pause, how am I doing, end it. */}
              <TalkButton compact className="h-14 shrink-0" />
            </div>
          ) : (
            <Card className="mt-3">
              <p className="font-display font-semibold">{t.workout.endConfirm}</p>
              <p className="text-sm text-muted">
                {gps && m >= 10 ? `${clock(s)} · ${distanceNumber(m, prefs.units, lang)} ${distanceUnit(prefs.units)}` : clock(s)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn
                  onClick={() => {
                    setConfirmEnd(false);
                    wk.end();
                  }}
                >
                  {t.workout.endSave}
                </Btn>
                <Btn variant="ghost" onClick={() => setConfirmEnd(false)}>
                  {t.workout.keepGoing}
                </Btn>
                {!confirmDiscard ? (
                  <Btn variant="danger" onClick={() => setConfirmDiscard(true)}>
                    {t.workout.discard}
                  </Btn>
                ) : (
                  <Btn variant="danger" onClick={wk.discard} aria-label={t.workout.discardConfirm}>
                    {t.workout.discardConfirm}
                  </Btn>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The workout voice switch (ADR-0044): one tap mutes the coach at once (the line speaking stops, nothing queued is
 * said) and one tap turns it back on; "Essential only" from the menu next to it, or a long press. Remembered with the
 * account for the next session on every device (AppContext). Taps and the cue text on screen stay when muted.
 */
function VoiceSwitch() {
  const { t, workoutVoice, setWorkoutVoice } = useApp();
  const [menu, setMenu] = useState(false);
  const timer = useRef<number | null>(null);
  const long = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const off = workoutVoice === "off";
  const label = off ? t.workout.voiceOff : workoutVoice === "essential" ? t.workout.voiceEssential : t.workout.voiceOn;
  const icon = off ? "🔇" : workoutVoice === "essential" ? "🔉" : "🔊";
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);
  return (
    <div ref={box} className="pointer-events-auto relative flex rounded-full bg-night/85 ring-1 ring-line">
      <button
        type="button"
        aria-label={off ? t.workout.voiceUnmute : t.workout.voiceMute}
        className={cn("h-11 rounded-l-full pr-3 pl-4 text-sm font-semibold select-none", off && "text-butter-fg")}
        onPointerDown={() => {
          long.current = false;
          cancel();
          timer.current = window.setTimeout(() => {
            long.current = true;
            setMenu(true);
          }, 550);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(true);
        }}
        onClick={() => {
          if (long.current) return void (long.current = false);
          setMenu(false);
          setWorkoutVoice(toggleWorkoutVoice(workoutVoice));
        }}
      >
        <span aria-hidden>{icon}</span> {label}
      </button>
      <button
        type="button"
        aria-label={t.workout.voiceMore}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="h-11 w-9 rounded-r-full border-l border-line text-sm text-muted"
      >
        ▾
      </button>
      {menu && (
        <div role="menu" className="absolute top-12 right-0 z-10 w-56 rounded-2xl bg-night-2 p-1 shadow-lg ring-1 ring-line">
          {WORKOUT_VOICE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={m === workoutVoice}
              onClick={() => {
                setMenu(false);
                if (m !== workoutVoice) setWorkoutVoice(m);
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm",
                m === workoutVoice ? "bg-surface font-semibold text-volt-fg" : "hover:bg-surface",
              )}
            >
              <span aria-hidden className="w-4">
                {m === workoutVoice ? "✓" : ""}
              </span>
              {t.you.workoutVoice[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A zone as effort by feel ("Easy", "Steady"…), for effort-by-feel mode. */
const zoneWord = (zone: number, lang: "en" | "fr") => {
  const r = RPE_ZONES[Math.min(5, Math.max(1, zone)) as 1 | 2 | 3 | 4 | 5];
  return lang === "fr" ? r.fr : r.en;
};

function Metric({ label, value, unit, tone, small }: { label: string; value: string; unit?: string; tone?: "pulse"; small?: boolean }) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className={cn(
          "font-display leading-tight font-bold tabular-nums",
          small ? "text-sm" : "text-xl",
          tone === "pulse" && "text-pulse-fg",
        )}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

function SummaryView() {
  const { t, lang, prefs, go, fmt, streak, sessions, setLastMoment, featureOn, me } = useApp();
  const wk = useWorkout();
  const sm = wk.summary!;
  const s = sm.session;
  const [feel, setFeel] = useState<SessionFeel | null>(null);
  const hasPlan = useHasPlan();
  const [now] = useState(() => Date.now());
  const saved = !!s && !sm.discarded && !sm.uploading;
  const spot = useSessionSpot(saved && featureOn("outdoor") && !me.guest ? (sm.spot ?? null) : null, s?.sport ?? "");
  // What the coach hears as "just finished" (context.where.last) for the rest of the visit.
  const lastSport = s && !sm.discarded ? s.sport : null;
  const lastMinutes = s ? Math.round(s.activeS / 60) : 0;
  useEffect(() => {
    if (lastSport) setLastMoment({ kind: "gps_end", sport: lastSport, minutes: lastMinutes, ...(feel ? { feel } : {}) });
  }, [lastSport, lastMinutes, feel, setLastMoment]);
  const close = () => {
    wk.closeSummary();
    go({ name: "today" });
  };
  if (sm.discarded || !s)
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4">
        <p className="font-display text-xl font-semibold">{t.workout.discarded}</p>
        <Btn big onClick={close}>
          {t.workout.done}
        </Btn>
      </div>
    );
  const hasHr = s.tier === "B";
  const points = sm.reply?.points;
  const vehicleNote = vehicleLine(s, t.workout, fmt);
  // Moving time (lib/webapp/moving.ts): the pace and the time shown; the time in all on its own line.
  const p = s.distanceM ? paceOf(s.activeS, s.distanceM) : null;
  const times = s.endedAt ? sessionTimes(s) : null;
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl space-y-4 pt-[max(env(safe-area-inset-top),1.5rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]">
      <Kicker tone="volt">{t.workout.summary}</Kicker>
      <h1 className="font-display text-3xl font-bold">{sportLabel(s.sport, lang)}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <Metric label={times && showsPaused(times) ? t.workout.movingTime : t.workout.elapsed} value={clock(s.activeS)} />
          {s.distanceM ? (
            <Metric label={t.workout.distance} value={distanceNumber(s.distanceM, prefs.units, lang)} unit={distanceUnit(prefs.units)} />
          ) : null}
          {p ? (
            <Metric
              label={showsSpeed(s.sport) ? t.workout.speed : t.workout.pace}
              value={showsSpeed(s.sport) ? speed(p, prefs.units, lang) : pace(p, prefs.units)}
            />
          ) : null}
          {s.avgBpm ? <Metric label={t.workout.heart} value={`${s.avgBpm}`} unit={`/ ${s.maxBpm} bpm`} tone="pulse" /> : null}
          {sm.gainM > 0 ? <Metric label={t.workout.elevation} value={elevation(sm.gainM, prefs.units, lang)} /> : null}
        </dl>
        {times && showsPaused(times) ? (
          <p className="mt-3 text-sm text-muted">
            {fmt(t.workout.inAllPaused, { total: clock(times.elapsedS), paused: clock(times.pausedS) })}
          </p>
        ) : null}
      </Card>
      {sm.adaptive && <AdaptiveSummaryCard summary={sm.adaptive.summary} />}
      {sm.splits.length > 0 && (
        <Card>
          <Kicker>{t.workout.splits}</Kicker>
          <ol className="mt-2 grid grid-cols-3 gap-2 text-sm">
            {sm.splits.map((x, i) => (
              <li key={i} className="rounded-lg bg-surface-2 px-2 py-1">
                <span className="text-muted">{fmt(t.workout.splitN, { unit: distanceUnit(prefs.units), n: i + 1 })}</span>{" "}
                <span className="font-semibold tabular-nums">{clock(x)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Card>
        {sm.uploading ? (
          <p className="text-muted">{t.common.saving}</p>
        ) : points && (hasHr || points.total > 0) ? (
          <>
            <p className="font-display text-2xl font-bold text-volt-fg">{fmt(t.workout.points, { n: points.total })}</p>
            {points.streakBonus > 0 && <Small>{fmt(t.workout.pointsDetail, { base: points.base, bonus: points.streakBonus })}</Small>}
          </>
        ) : sm.queued ? (
          <p className="text-sm text-butter-fg">{t.workout.summaryLocal}</p>
        ) : null}
        {vehicleNote ? <p className="mt-2 text-sm font-semibold text-butter-fg">{vehicleNote}</p> : null}
        {!hasHr && !s.flags.includes("vehicle") && !((points?.total ?? 0) > 0) && <p className="mt-2 text-sm">{t.workout.noPoints}</p>}
        {streak && !s.flags.includes("vehicle") && <Small className="mt-2">{fmt(t.workout.streakNow, { n: streak.days })}</Small>}
      </Card>
      <Note tone="butter">{t.workout.webRule}</Note>
      {/* "How did it feel?" (a result, every level) then the next steps (the engine: Quiet shows none). */}
      {saved && (
        <Card>
          <FeelAfter
            sport={s.sport}
            minutes={s.activeS / 60}
            onFeel={setFeel}
            where={{ screen: "workout_summary", last: { kind: "gps_end", sport: s.sport, minutes: lastMinutes } }}
          />
        </Card>
      )}
      {saved && (
        <NextStepsRow
          moment={
            spot.done
              ? gpsMoment({
                  sport: s.sport,
                  activeS: s.activeS,
                  feel,
                  last7: sessionsLast7(sessions, now, s.id),
                  ...(streak ? { streak: streak.days } : {}),
                  ...(hasPlan !== undefined ? { hasPlan } : {}),
                  ...(spot.placeNew !== undefined ? { placeNew: spot.placeNew } : {}),
                  ...(spot.placeNotes !== undefined ? { placeNotes: spot.placeNotes } : {}),
                })
              : null
          }
          target={spot.place ? { place: spot.place } : undefined}
          onLeave={() => wk.closeSummary()}
        />
      )}
      {s && !sm.discarded && <SessionCelebration sessionId={s.id} ready={!!sm.reply} />}
      <Btn big variant="volt" className="w-full" onClick={close}>
        {t.workout.done}
      </Btn>
    </div>
  );
}

interface SessionSpot {
  /** The answer came (or 4 s passed): the next steps can be picked. */
  done: boolean;
  placeNew?: boolean;
  placeNotes?: number;
  place?: { key: string; sport: string; fresh?: boolean };
}

/**
 * Is the session's spot new, or barely rated? (living app §6.1) GET /v1/places/near-new with the busiest point of the
 * route rounded to 3 decimals, once; neither kept nor logged by the API. The next steps wait for it at most 4 s.
 */
function useSessionSpot(at: { lat: number; lon: number } | null, sport: string): SessionSpot {
  const { la } = useLiving();
  const [spot, setSpot] = useState<SessionSpot>({ done: false });
  const lat = at?.lat;
  const lon = at?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined || !sport) return;
    let live = true;
    const timer = window.setTimeout(() => live && setSpot((x) => (x.done ? x : { done: true })), 4000);
    la.nearNew(sport, lat, lon)
      .then((r) => {
        if (!live) return;
        if (r.undocumented && r.key) setSpot({ done: true, placeNew: true, place: { key: r.key, sport, fresh: true } });
        else if (r.spot) setSpot({ done: true, placeNotes: r.spot.notes?.count ?? 0, place: { key: r.spot.key, sport } });
        else setSpot({ done: true });
      })
      .catch(() => live && setSpot({ done: true }));
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [la, lat, lon, sport]);
  return lat === undefined ? { done: true } : spot;
}
