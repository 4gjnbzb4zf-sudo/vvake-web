"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/dictionaries";
import { getSportZonesDict, type SportZonesDict } from "@/i18n/sportZones";
import { cn } from "@/lib/cn";
import type { Units } from "@/lib/webapp/format";
import { validZones, type HeartProfile } from "@/lib/webapp/heart";
import {
  cleanHeartSetting,
  effectiveHeartZones,
  hasOwnZones,
  hrFamily,
  hrIsRoughGuide,
  learnSportMaxHr,
  pctOfMax,
  rpeLabel,
  rpeTalk,
  SPORT_MAX_MAX,
  SPORT_MAX_MIN,
  SPORT_MAX_OVER_REST,
  sportMaxHr,
  sportThresholds,
  thresholdsFromPct,
  withRpe,
  withSportHeart,
  type HeartZonesPrefs,
  type ZoneThresholds,
} from "@/lib/webapp/sportHeart";
import {
  cleanSpeedSetting,
  kindValue,
  learnSpeedZones,
  levelSpeedSetting,
  paceKind,
  paceKindUnit,
  parseKindInput,
  speedThresholdsFrom,
  stepKmh,
  validSpeedThresholds,
  zoneRanges,
  zoneSports,
  type PaceKind,
  type SpeedThresholds,
  type SpeedZonesPrefs,
  type SportSpeedSetting,
} from "@/lib/webapp/speedZones";
import { sportLabel } from "@/lib/webapp/workout";

/** A past session the editor can learn from (the web app passes the account's recent sessions; the account page none). */
export interface ZoneSession {
  sport: string;
  activeS: number;
  distanceM?: number | null;
  maxBpm?: number | null;
}

export interface SportZonesEditorProps {
  lang: Locale;
  units: Units;
  /** Your base heart numbers (age, resting, measured max, sex): heart.ts heartProfileOf without a sport. */
  base: HeartProfile;
  /** Age and resting heart rate were shared from the app (else the apps' stand-in profile is used, and said). */
  shared: boolean;
  heartZones: HeartZonesPrefs | null;
  /** The older per-sport zones shared from Health (GET /v1/athlete health.zones), filling the sports not set here. */
  legacyZones?: Record<string, number[]> | null;
  speedZones: SpeedZonesPrefs | null;
  /** Save the whole heart object (already stamped with a fresh `at`). */
  onHeart: (p: HeartZonesPrefs) => void | Promise<unknown>;
  /** Save the whole speed object (already stamped with a fresh `at`). */
  onSpeed: (p: SpeedZonesPrefs) => void | Promise<unknown>;
  sessions?: readonly ZoneSession[];
  /** Your level per sport from the app's survey (scales the automatic paces). */
  levels?: Readonly<Record<string, string | null | undefined>>;
  /** Shown under a save while it is being sent, failed or done (the account page; the web app saves offline-first). */
  status?: ReactNode;
}

const box = "min-w-0 rounded-2xl border border-line bg-surface/60 p-4 sm:p-5";
const btn = (primary = false) =>
  cn(
    "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    primary ? "bg-volt text-ink hover:brightness-95" : "border border-line bg-surface-2 text-text hover:border-muted/60",
  );
const input =
  "h-10 w-full rounded-lg border border-line bg-night px-2 text-center text-sm text-text tabular-nums outline-none focus:border-pulse-fg";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-volt" : "bg-surface-2 ring-1 ring-line")}
    >
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-night shadow transition-all", on ? "left-7" : "left-1")} />
    </button>
  );
}

function Badge({ own, t }: { own: boolean; t: { automatic: string; own: string } }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap",
        own ? "border-volt-fg/40 text-volt-fg" : "border-line text-muted",
      )}
    >
      {own ? t.own : t.automatic}
    </span>
  );
}

/**
 * Sports & zones (ADR-0048): for every catalog sport, its heart-rate zones (automatic from the family's max offset, or
 * your own five thresholds in bpm or % of the sport's max, or your own max for it), effort by feel for everything, and
 * its pace or speed zones in the sport's unit (min/km or min/mi, km/h or mph, /100 m, /500 m) with easy and hard
 * steppers, or "Not used" where pace means nothing. Used by the account page and the web app's Zones screen.
 */
export function SportZonesEditor(props: SportZonesEditorProps) {
  const { lang, heartZones, legacyZones, onHeart, shared, base } = props;
  const t = getSportZonesDict(lang);
  const list = useMemo(() => zoneSports(), []);
  const [sport, setSport] = useState(list[0]!);
  const eff = useMemo(() => effectiveHeartZones(heartZones, legacyZones), [heartZones, legacyZones]);
  const rpe = !!heartZones?.rpe;
  const isSet = (k: string) => !!eff?.sports[k] || !!props.speedZones?.sports[k];

  return (
    <div className="space-y-4">
      <div className={box}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{t.rpe}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.rpeHint}</p>
          </div>
          <Switch on={rpe} label={t.rpe} onChange={(v) => void onHeart(withRpe(heartZones, v))} />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.sport}</span>
        <select
          className="h-12 w-full rounded-xl border border-line bg-night px-4 text-base text-text outline-none focus:border-pulse-fg"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          {list.map((k) => (
            <option key={k} value={k}>
              {sportLabel(k, lang)}
              {isSet(k) ? ` · ${t.isSet}` : ""}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs leading-relaxed text-faint">
        {shared ? t.baseNote : format(t.baseStandIn, { age: base.age, rest: base.restingHr })}
      </p>

      {/* Fresh editors per sport and saved version: their fields start from what is saved. */}
      <HeartCard key={`h|${sport}|${heartZones?.at ?? ""}`} {...props} t={t} sport={sport} eff={eff} rpe={rpe} />
      <PaceCard key={`p|${sport}|${props.units}|${props.speedZones?.at ?? ""}`} {...props} t={t} sport={sport} />
      {props.status}
      <p className="text-xs text-faint">{t.synced}</p>
      <p className="text-xs text-faint">{t.disclaimer}</p>
    </div>
  );
}

type CardProps = SportZonesEditorProps & { t: SportZonesDict; sport: string };

function HeartCard({
  t,
  sport,
  lang: locale,
  base,
  heartZones,
  onHeart,
  sessions,
  eff,
  rpe,
}: CardProps & { eff: HeartZonesPrefs | null; rpe: boolean }) {
  const h = t.heart;
  const max = sportMaxHr(base, sport, eff);
  const thresholds = sportThresholds(base, sport, eff);
  const ownMax = cleanHeartSetting(eff?.sports[sport])?.maxHr;
  const own = hasOwnZones(sport, eff) || ownMax !== undefined;
  const family = hrFamily(sport);
  const [mode, setMode] = useState<"bpm" | "pct">("bpm");
  const [vals, setVals] = useState<string[]>(() => thresholds.map(String));
  const [maxT, setMaxT] = useState(() => (ownMax ? String(ownMax) : ""));
  const [proposal, setProposal] = useState<number | null | undefined>(undefined);

  const nums = vals.map((v) => Number(v.trim()));
  const parsed: ZoneThresholds | undefined = nums.every((n) => Number.isFinite(n) && n > 0)
    ? mode === "pct"
      ? thresholdsFromPct(nums, max)
      : validZones(nums)
        ? (nums.map((n) => Math.round(n)) as ZoneThresholds)
        : undefined
    : undefined;
  const maxN = Number(maxT.trim());
  const maxOk =
    maxT.trim() !== "" &&
    Number.isFinite(maxN) &&
    maxN >= SPORT_MAX_MIN &&
    maxN <= SPORT_MAX_MAX &&
    maxN >= base.restingHr + SPORT_MAX_OVER_REST;

  const switchMode = (m: "bpm" | "pct") => {
    if (m === mode) return;
    const cur = parsed ?? thresholds;
    setVals(cur.map((b) => String(m === "pct" ? pctOfMax(b, max) : b)));
    setMode(m);
  };

  const learnable = (sessions ?? []).map((s) => ({ sport: s.sport, maxBpm: s.maxBpm ?? undefined, activeS: s.activeS }));
  const offsetText = ownMax !== undefined ? h.max : h.offset[family];

  return (
    <section className={box} aria-labelledby={`hz-${sport}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`hz-${sport}`} className="font-display text-base font-semibold">
          {h.title}
        </h3>
        <Badge own={own} t={h} />
      </div>
      <p className="mt-1 text-sm text-muted">{format(h.autoLead, { max, offset: offsetText })}</p>
      {hrIsRoughGuide(sport) && <p className="mt-2 text-sm text-butter-fg">{t.roughGuide}</p>}

      {rpe ? (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide text-faint uppercase">{h.rpeList}</p>
          <ol className="mt-2 space-y-1">
            {([1, 2, 3, 4, 5] as const).map((z) => (
              <li key={z} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-semibold">
                  {format(h.zoneN, { n: z })} · {rpeLabel(z, locale)}
                </span>
                <span className="text-muted">{rpeTalk(z, locale)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <ol className="mt-3 grid grid-cols-5 gap-1 text-center text-xs text-muted">
          {thresholds.map((b, i) => (
            <li key={i} className="rounded-lg bg-surface-2 px-1 py-2">
              <span className="block">{format(h.zoneN, { n: i + 1 })}</span>
              <span className="block font-semibold text-text tabular-nums">{b}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 border-t border-line/60 pt-4">
        <label className="block">
          <span className="block text-sm font-medium">{h.max}</span>
          <span className="mt-1 block text-xs text-faint">{h.maxHint}</span>
          <input
            className={cn(input, "mt-2 w-32")}
            inputMode="numeric"
            value={maxT}
            placeholder={String(max)}
            aria-invalid={maxT.trim() !== "" && !maxOk}
            onChange={(e) => setMaxT(e.target.value)}
          />
          <span className="ml-2 text-sm text-muted">bpm</span>
        </label>
        {maxT.trim() !== "" && !maxOk && (
          <p className="mt-2 text-sm text-down-fg" role="alert">
            {h.maxInvalid}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn(true)}
            disabled={!maxOk || maxN === ownMax}
            onClick={() => void onHeart(withSportHeart(heartZones, sport, { maxHr: Math.round(maxN) }))}
          >
            {h.saveMax}
          </button>
          {ownMax !== undefined && (
            <button type="button" className={btn()} onClick={() => void onHeart(withSportHeart(heartZones, sport, { maxHr: null }))}>
              {h.resetMax}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{h.thresholds}</p>
          <div role="radiogroup" aria-label={h.thresholds} className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
            {(["bpm", "pct"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "min-h-8 rounded-lg px-3 text-xs font-semibold",
                  mode === m ? "bg-volt text-ink" : "text-muted hover:text-text",
                )}
              >
                {m === "bpm" ? h.bpm : h.pct}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {vals.map((v, i) => (
            <label key={i} className="block min-w-0">
              <span className="mb-1 block text-xs text-muted">{format(h.zoneN, { n: i + 1 })}</span>
              <input
                className={input}
                inputMode="numeric"
                value={v}
                aria-invalid={!parsed}
                onChange={(e) => setVals((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
              />
            </label>
          ))}
        </div>
        {!parsed && (
          <p className="mt-2 text-sm text-down-fg" role="alert">
            {h.invalid}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn(true)}
            disabled={!parsed}
            onClick={() => parsed && void onHeart(withSportHeart(heartZones, sport, { zones: parsed }))}
          >
            {h.save}
          </button>
          {own && (
            <button
              type="button"
              className={btn()}
              onClick={() => void onHeart(withSportHeart(heartZones, sport, { zones: null, maxHr: null }))}
            >
              {h.reset}
            </button>
          )}
        </div>
      </div>

      {sessions && (
        <div className="mt-4 border-t border-line/60 pt-4">
          {proposal === undefined ? (
            <button type="button" className={btn()} onClick={() => setProposal(learnSportMaxHr(learnable, sport, base, eff) ?? null)}>
              {h.learn}
            </button>
          ) : proposal === null ? (
            <p className="text-sm text-muted">{h.learnNone}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">{format(h.learnProposal, { bpm: proposal })}</p>
              <button
                type="button"
                className={btn(true)}
                onClick={() => void onHeart(withSportHeart(heartZones, sport, { maxHr: proposal }))}
              >
                {h.apply}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PaceCard({ t, sport, lang: locale, units, speedZones, onSpeed, sessions, levels }: CardProps) {
  const p = t.pace;
  const kind: PaceKind = paceKind(sport);
  const name = sportLabel(sport, locale);
  if (kind === "none")
    return (
      <section className={box}>
        <h3 className="font-display text-base font-semibold">{p.titlePace}</h3>
        <p className="mt-2 text-sm font-semibold text-text">{format(p.notUsed, { sport: name })}</p>
        <p className="mt-1 text-sm text-muted">{p.notUsedHint}</p>
      </section>
    );
  return (
    <PaceEditor
      t={t}
      sport={sport}
      kind={kind}
      locale={locale}
      units={units}
      speedZones={speedZones}
      onSpeed={onSpeed}
      sessions={sessions}
      level={levels?.[sport] ?? null}
    />
  );
}

function PaceEditor({
  t,
  sport,
  kind,
  locale,
  units,
  speedZones,
  onSpeed,
  sessions,
  level,
}: {
  t: SportZonesDict;
  sport: string;
  kind: Exclude<PaceKind, "none">;
  locale: Locale;
  units: Units;
  speedZones: SpeedZonesPrefs | null;
  onSpeed: (p: SpeedZonesPrefs) => void | Promise<unknown>;
  sessions?: readonly ZoneSession[];
  level: string | null;
}) {
  const p = t.pace;
  const unit = paceKindUnit(kind, units);
  const saved = cleanSpeedSetting(speedZones?.sports[sport]);
  const def = levelSpeedSetting(sport, level)!;
  const start = saved ?? def;
  const [easy, setEasy] = useState(start.easy);
  const [hard, setHard] = useState(start.hard);
  const show = (kmh: number) => kindValue(kmh, kind, units, locale);
  const changed = show(easy) !== show(start.easy) || show(hard) !== show(start.hard);
  const fromPair = speedThresholdsFrom(easy, hard);
  const preview: SpeedThresholds = saved?.custom && !changed ? saved.custom : fromPair;

  const [customT, setCustomT] = useState<string[]>(() => (saved?.custom ?? speedThresholdsFrom(start.easy, start.hard)).map(show));
  const customKmh = customT.map((x) => parseKindInput(x, kind, units));
  const custom = validSpeedThresholds(customKmh) ? (customKmh as SpeedThresholds) : null;
  const [proposal, setProposal] = useState<{ easy: number; hard: number } | null | undefined>(undefined);

  const save = (s: SportSpeedSetting | undefined) => {
    const sports = { ...(speedZones?.sports ?? {}) };
    if (s) sports[sport] = s;
    else delete sports[sport];
    void onSpeed({ at: new Date().toISOString(), sports });
  };
  const mine = (sessions ?? [])
    .filter((s) => s.sport === sport && s.distanceM && s.activeS)
    .map((s) => ({ distanceM: s.distanceM ?? 0, durationS: s.activeS }));
  const rangeLabel = (from: number, to: number | null) =>
    to === null ? format(p.fasterThan, { a: show(from) }) : format(p.range, { a: show(from), b: show(to) });

  const stepper = (label: string, hint: string, v: number, set: (x: number) => void) => (
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-faint">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={btn()} aria-label={`${label}: ${p.slower}`} onClick={() => set(stepKmh(v, kind, units, -1))}>
          −
        </button>
        <span className="min-w-20 text-center font-display text-lg font-semibold tabular-nums" aria-live="polite">
          {show(v)} <span className="text-xs text-muted">{unit}</span>
        </span>
        <button type="button" className={btn()} aria-label={`${label}: ${p.faster}`} onClick={() => set(stepKmh(v, kind, units, 1))}>
          +
        </button>
      </div>
    </div>
  );

  return (
    <section className={box} aria-labelledby={`pz-${sport}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`pz-${sport}`} className="font-display text-base font-semibold">
          {kind === "speed" ? p.titleSpeed : p.titlePace} <span className="text-sm font-normal text-muted">({unit})</span>
        </h3>
        <Badge own={!!saved} t={p} />
      </div>
      <p className="mt-1 text-xs text-faint">{p.noHeart}</p>
      {!saved && level && <p className="mt-1 text-xs text-faint">{p.levelNote}</p>}
      <p className="mt-1 text-xs text-faint">{`− ${p.slower} · + ${p.faster}`}</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {stepper(p.easy, p.easyHint, easy, setEasy)}
        {stepper(p.hard, p.hardHint, hard, setHard)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn(true)}
          disabled={!!saved && !saved.custom && !changed}
          onClick={() => save(cleanSpeedSetting({ easy, hard }))}
        >
          {p.save}
        </button>
        {saved && (
          <button type="button" className={btn()} onClick={() => save(undefined)}>
            {p.reset}
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-line/60 pt-4">
        <p className="text-sm font-medium">{p.preview}</p>
        <ol className="mt-2 space-y-1">
          {zoneRanges(preview).map((r) => (
            <li key={r.zone} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="font-semibold">{format(t.heart.zoneN, { n: r.zone })}</span>
              <span className="tabular-nums">
                {rangeLabel(r.from, r.to)} <span className="text-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-faint">{p.belowZone1}</p>
      </div>

      {sessions && (
        <div className="mt-4 border-t border-line/60 pt-4">
          {proposal === undefined ? (
            <button type="button" className={btn()} onClick={() => setProposal(learnSpeedZones(mine, sport) ?? null)}>
              {p.learn}
            </button>
          ) : proposal === null ? (
            <p className="text-sm text-muted">{p.learnNone}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                {format(p.learnProposal, { easy: `${show(proposal.easy)} ${unit}`, hard: `${show(proposal.hard)} ${unit}` })}
              </p>
              <button type="button" className={btn(true)} onClick={() => save(cleanSpeedSetting(proposal))}>
                {p.apply}
              </button>
            </div>
          )}
        </div>
      )}

      <details className="mt-4 border-t border-line/60 pt-4">
        <summary className="cursor-pointer text-sm font-medium">{p.advanced}</summary>
        <p className="mt-2 text-xs text-faint">{p.advancedHint}</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {customT.map((v, i) => (
            <label key={i} className="block min-w-0">
              <span className="mb-1 block text-xs text-muted">{format(t.heart.zoneN, { n: i + 1 })}</span>
              <input
                className={input}
                inputMode={kind === "speed" ? "decimal" : "text"}
                value={v}
                aria-invalid={customKmh[i] === null}
                onChange={(e) => setCustomT((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
              />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{unit}</p>
        {!custom && (
          <p className="mt-2 text-sm text-down-fg" role="alert">
            {p.invalidCustom}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn(true)}
            disabled={!custom}
            onClick={() => custom && save(cleanSpeedSetting({ easy, hard, custom }))}
          >
            {p.useCustom}
          </button>
          {saved?.custom && (
            <button type="button" className={btn()} onClick={() => save({ easy: saved.easy, hard: saved.hard })}>
              {p.dropCustom}
            </button>
          )}
        </div>
      </details>
    </section>
  );
}
