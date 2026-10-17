"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { bleSupport } from "@/lib/webapp/ble";
import { clock, distanceNumber, distanceUnit, elevation, pace, speed, SPEED_SPORTS } from "@/lib/webapp/format";
import { paceOf } from "@/lib/webapp/geo";
import { elapsedS, isPaused, QUICK_SPORTS, sportLabel, sportOf, usesGps, WEB_SPORTS } from "@/lib/webapp/workout";
import { sports as catalog } from "@/lib/sports";
import { useApp } from "./AppContext";
import { useVVakerSrc } from "./MyVVaker";
import { useWorkout } from "./WorkoutContext";
import { Btn, Card, Kicker, Note, Small } from "./ui";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false });

/**
 * The workout (apps/mobile app/workout.tsx): pick a sport, then the live screen (the map with your VVaker following
 * you outdoors, your VVaker indoors; time, distance, pace or speed, heart rate and zone, climb; Pause, Resume, End with
 * a confirm), then the summary with the points from the server. The honest banner: keep the page open and the screen
 * on, tracking stops if the phone locks.
 */
export function WorkoutScreen() {
  const wk = useWorkout();
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

function PickView() {
  const { t, lang, go } = useApp();
  const wk = useWorkout();
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
    <div className="mx-auto min-h-dvh w-full max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
      <div className="flex items-center justify-between">
        <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "today" })}>
          ‹ {t.common.back}
        </button>
        <SensorChip />
      </div>
      <h1 className="mt-2 font-display text-2xl font-bold">{t.workout.pick}</h1>
      {support === "ios" && <Small className="mt-2">{t.sensor.unsupportedIos}</Small>}
      {support === "unsupported" && <Small className="mt-2">{t.sensor.unsupported}</Small>}
      <Kicker className="mt-5">{t.workout.quick}</Kicker>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {QUICK_SPORTS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => wk.start(k)}
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
                  onClick={() => wk.start(s.key)}
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
  const { t, lang, go, prefs, setPrefs, bpm, fmt } = useApp();
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
  const useSpeed = SPEED_SPORTS.has(w.sport);
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
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <button
            type="button"
            onClick={() => go({ name: "today" })}
            className="pointer-events-auto h-11 rounded-full bg-night/85 px-4 text-sm font-semibold ring-1 ring-line"
            aria-label={t.workout.minimize}
          >
            ⌄ {sportLabel(w.sport, lang)}
          </button>
          <button
            type="button"
            onClick={() => setPrefs({ voice: !prefs.voice })}
            aria-pressed={prefs.voice}
            className="pointer-events-auto h-11 rounded-full bg-night/85 px-4 text-sm font-semibold ring-1 ring-line"
          >
            {prefs.voice ? `🔊 ${t.workout.voiceOn}` : `🔇 ${t.workout.voiceOff}`}
          </button>
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
      <div className="border-t border-line bg-night-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
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
                value={useSpeed ? speed(p, prefs.units, lang) : pace(p, prefs.units)}
              />
            )}
            {gps && w.track.gainM > 0 && <Metric label={t.workout.elevation} value={elevation(w.track.gainM, prefs.units, lang)} />}
            <Metric
              label={t.workout.heart}
              value={bpm ? String(bpm) : "–"}
              unit={bpm ? (wk.zone > 0 ? fmt(t.workout.zone, { n: wk.zone }) : "bpm") : undefined}
              tone={bpm ? "pulse" : undefined}
            />
          </dl>
          {gps ? <Small className="mt-2">{gpsLine}</Small> : <Small className="mt-2">{t.workout.noGpsIndoor}</Small>}

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

function Metric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "pulse" }) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={cn("font-display text-xl leading-tight font-bold tabular-nums", tone === "pulse" && "text-pulse-fg")}>
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

function SummaryView() {
  const { t, lang, prefs, go, fmt, streak } = useApp();
  const wk = useWorkout();
  const sm = wk.summary!;
  const s = sm.session;
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
  const p = s.distanceM ? paceOf(s.activeS, s.distanceM) : null;
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-16">
      <Kicker tone="volt">{t.workout.summary}</Kicker>
      <h1 className="font-display text-3xl font-bold">{sportLabel(s.sport, lang)}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <Metric label={t.workout.elapsed} value={clock(s.activeS)} />
          {s.distanceM ? (
            <Metric label={t.workout.distance} value={distanceNumber(s.distanceM, prefs.units, lang)} unit={distanceUnit(prefs.units)} />
          ) : null}
          {p ? (
            <Metric
              label={SPEED_SPORTS.has(s.sport) ? t.workout.speed : t.workout.pace}
              value={SPEED_SPORTS.has(s.sport) ? speed(p, prefs.units, lang) : pace(p, prefs.units)}
            />
          ) : null}
          {s.avgBpm ? <Metric label={t.workout.heart} value={`${s.avgBpm}`} unit={`/ ${s.maxBpm} bpm`} tone="pulse" /> : null}
          {sm.gainM > 0 ? <Metric label={t.workout.elevation} value={elevation(sm.gainM, prefs.units, lang)} /> : null}
        </dl>
      </Card>
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
        {!hasHr && <p className="mt-2 text-sm">{t.workout.noPoints}</p>}
        {streak && <Small className="mt-2">{fmt(t.workout.streakNow, { n: streak.days })}</Small>}
      </Card>
      <Note tone="butter">{t.workout.webRule}</Note>
      <Btn big variant="volt" className="w-full" onClick={close}>
        {t.workout.done}
      </Btn>
    </div>
  );
}
