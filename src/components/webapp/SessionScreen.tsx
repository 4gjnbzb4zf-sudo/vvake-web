"use client";

import { useEffect, useState } from "react";
import type { ApiSession } from "@/lib/webapp/api";
import { showsSpeed } from "@/lib/webapp/speedZones";
import { clock, dayLabel, distance, pace, speed, timeLabel } from "@/lib/webapp/format";
import { paceOf } from "@/lib/webapp/geo";
import { sessionTimes, showsPaused } from "@/lib/webapp/moving";
import { sourcesLine, vehicleLine } from "@/lib/webapp/vehicle/journal";
import { sportLabel } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { Btn, Card, H1, Kicker, Note, Small } from "./ui";

/**
 * One session (apps/mobile app/session/[id].tsx, GET /v1/sessions/:id): time, distance, pace, heart rate, zones, the
 * points and why (no heart sensor, a web workout), discard.
 */
export function SessionScreen({ id }: { id: string }) {
  const { t, lang, api, prefs, go, refresh, fmt } = useApp();
  const [s, setS] = useState<ApiSession | null>(null);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void api
      .session(id)
      .then(setS)
      .catch(() => setError(true));
  }, [api, id]);
  if (error) return <p className="text-muted">{t.common.error}</p>;
  if (!s) return <p className="text-muted">{t.common.loading}</p>;
  // Moving time (lib/webapp/moving.ts): the pace and the time shown; the time in all on its own line.
  const p = s.distanceM ? paceOf(s.activeS, s.distanceM) : null;
  const times = s.endedAt ? sessionTimes(s) : null;
  const hr = (s.samples ?? []).filter((x) => typeof x.bpm === "number") as { t: number; bpm: number }[];
  const noHr = !s.avgBpm && hr.length < 2;
  const zones = s.zoneS ?? null;
  const zoneTotal = zones ? zones.reduce((a, b) => a + b, 0) : 0;
  // Build 58: "Not counted: vehicle detected" / the stretch left out, and a workout in parts with its sources.
  const vehicle = vehicleLine(s, t.workout, fmt);
  const sources = sourcesLine(s, t.workout, fmt);
  return (
    <div className="space-y-4">
      <button type="button" className="h-11 text-sm text-muted" onClick={() => history.back()}>
        ‹ {t.common.back}
      </button>
      <div>
        <Kicker>{`${dayLabel(s.startedAt, lang)} · ${timeLabel(s.startedAt, lang)}`}</Kicker>
        <H1>{sportLabel(s.sport, lang)}</H1>
        {sources && <Small className="mt-1">{sources}</Small>}
      </div>
      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <Stat label={times && showsPaused(times) ? t.workout.movingTime : t.workout.elapsed} value={clock(s.activeS)} />
          {s.distanceM ? <Stat label={t.workout.distance} value={distance(s.distanceM, prefs.units, lang)} /> : null}
          {p ? (
            <Stat
              label={showsSpeed(s.sport) ? t.workout.speed : t.workout.pace}
              value={showsSpeed(s.sport) ? speed(p, prefs.units, lang) : pace(p, prefs.units)}
            />
          ) : null}
          {s.avgBpm ? <Stat label={t.workout.heart} value={`${s.avgBpm} / ${s.maxBpm ?? "–"} bpm`} /> : null}
        </dl>
        {times && showsPaused(times) ? (
          <p className="mt-3 text-sm text-muted">
            {fmt(t.workout.inAllPaused, { total: clock(times.elapsedS), paused: clock(times.pausedS) })}
          </p>
        ) : null}
      </Card>
      {hr.length > 1 && <HeartChart samples={hr} />}
      {zones && zoneTotal > 0 && (
        <Card>
          <div className="space-y-1.5">
            {zones.map((z, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-14">{fmt(t.workout.zone, { n: i + 1 })}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-pulse" style={{ width: `${(z / zoneTotal) * 100}%` }} />
                </div>
                <span className="w-12 text-right">{clock(z)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <Kicker tone="volt">{typeof s.points === "number" ? fmt(t.workout.points, { n: s.points }) : t.workout.pointsPending}</Kicker>
        {s.pointsDetail && s.pointsDetail.streakBonus > 0 && (
          <Small className="mt-1">{fmt(t.workout.pointsDetail, { base: s.pointsDetail.base, bonus: s.pointsDetail.streakBonus })}</Small>
        )}
        {vehicle && <p className="mt-2 text-sm font-semibold text-butter-fg">{vehicle}</p>}
        {noHr && !s.flags?.includes("vehicle") && <p className="mt-2 text-sm">{t.workout.noPoints}</p>}
      </Card>
      {s.source === "web" && <Note tone="butter">{t.workout.webRule}</Note>}
      {!confirm ? (
        <Btn variant="danger" className="w-full" onClick={() => setConfirm(true)}>
          {t.workout.discard}
        </Btn>
      ) : (
        <Card tone="butter">
          <p className="text-sm">{t.workout.discardConfirm}</p>
          <div className="mt-3 flex gap-2">
            <Btn
              variant="danger"
              onClick={() =>
                void api
                  .deleteSession(s.id)
                  .then(refresh)
                  .then(() => go({ name: "you" }))
                  .catch(() => setError(true))
              }
            >
              {t.workout.discard}
            </Btn>
            <Btn variant="ghost" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-xl font-bold">{value}</dd>
    </div>
  );
}

/** The heart over the session, as a line (no library: a small SVG). */
function HeartChart({ samples }: { samples: { t: number; bpm: number }[] }) {
  const w = 320;
  const h = 100;
  const tMax = samples[samples.length - 1]!.t || 1;
  const lo = Math.min(...samples.map((s) => s.bpm)) - 5;
  const hi = Math.max(...samples.map((s) => s.bpm)) + 5;
  const pts = samples
    .map((s) => `${((s.t / tMax) * w).toFixed(1)},${(h - ((s.bpm - lo) / Math.max(1, hi - lo)) * h).toFixed(1)}`)
    .join(" ");
  return (
    <Card>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label={`${Math.round(lo + 5)}–${Math.round(hi - 5)} bpm`}>
        <polyline points={pts} fill="none" stroke="var(--color-pulse)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </Card>
  );
}
