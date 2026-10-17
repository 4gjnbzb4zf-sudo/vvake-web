"use client";

import { useMemo, useState } from "react";
import {
  cleanSpeedSetting,
  defaultSpeedSetting,
  learnSpeedZones,
  parseSpeedInput,
  speedShownAsPace,
  speedThresholdsFrom,
  speedUnit,
  speedValue,
  speedZoneSports,
  validSpeedThresholds,
  zoneRanges,
  type SpeedThresholds,
  type SportSpeedSetting,
} from "@/lib/webapp/speedZones";
import { sportLabel } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { Btn, Card, Field, H1, H2, inputCls, Kicker, Note, Small } from "./ui";

/**
 * Speed zones (ADR-0044, the apps' "Speed zones" screen): per GPS sport, my easy and hard pace (or speed for the fast
 * sports) in this browser's units, the five zones they give, back to the default, your own five values, and "Learn
 * from my sessions" from the account's recent sessions of the sport. Saved with the account (prefs.speedZones, the
 * whole object, newest wins): the phone and watches use the same. Guidance only: points still need a heart rate.
 */
export function ZonesScreen() {
  const { t, lang, prefs, speedZones } = useApp();
  const list = useMemo(() => speedZoneSports(), []);
  const [sport, setSport] = useState(list[0]!);
  return (
    <div className="space-y-4">
      <H1>{t.zones.title}</H1>
      <Small>{t.zones.lead}</Small>
      <Note tone="butter">{t.zones.disclaimer}</Note>
      <Field label={t.zones.sport}>
        <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
          {list.map((k) => (
            <option key={k} value={k}>
              {sportLabel(k, lang)}
              {speedZones?.sports[k] ? " ✓" : ""}
            </option>
          ))}
        </select>
      </Field>
      {/* A fresh editor per sport, units and saved version: its fields start from what is saved. */}
      <SportEditor key={`${sport}|${prefs.units}|${speedZones?.at ?? ""}`} sport={sport} />
      <Small>{t.zones.synced}</Small>
    </div>
  );
}

function SportEditor({ sport }: { sport: string }) {
  const { t, lang, prefs, speedZones, setSpeedZones, sessions, fmt } = useApp();
  const units = prefs.units;
  const pace = speedShownAsPace(sport);
  const unit = speedUnit(pace, units);
  const saved = cleanSpeedSetting(speedZones?.sports[sport]);
  const def = defaultSpeedSetting(sport)!;
  const base = saved ?? def;
  const show = (kmh: number) => speedValue(kmh, pace, units, lang);

  const [easyT, setEasyT] = useState(() => show(base.easy));
  const [hardT, setHardT] = useState(() => show(base.hard));
  const easy = parseSpeedInput(easyT, pace, units);
  const hard = parseSpeedInput(hardT, pace, units);
  const fromPair = easy !== null && hard !== null ? speedThresholdsFrom(easy, hard) : null;

  const [customT, setCustomT] = useState<string[]>(() => (saved?.custom ?? speedThresholdsFrom(base.easy, base.hard)).map(show));
  const customKmh = customT.map((x) => parseSpeedInput(x, pace, units));
  const custom = validSpeedThresholds(customKmh) ? (customKmh as SpeedThresholds) : null;
  const [proposal, setProposal] = useState<{ easy: number; hard: number } | null | undefined>(undefined);

  // Your own five values show until easy or hard is edited; then the preview follows the two fields.
  const changed = easyT !== show(base.easy) || hardT !== show(base.hard);
  const preview: SpeedThresholds | null = saved?.custom && !changed ? saved.custom : fromPair;

  const save = (s: SportSpeedSetting | undefined) => {
    const sports = { ...(speedZones?.sports ?? {}) };
    if (s) sports[sport] = s;
    else delete sports[sport];
    setSpeedZones(sports);
  };
  const saveEasyHard = () => {
    if (easy === null || hard === null) return;
    const c = cleanSpeedSetting({ easy, hard });
    if (c) save(c);
  };

  const mine = sessions
    .filter((s) => s.sport === sport && s.distanceM && s.activeS)
    .map((s) => ({ distanceM: s.distanceM ?? 0, durationS: s.activeS }));

  const rangeLabel = (from: number, to: number | null) =>
    to === null ? fmt(t.zones.fasterThan, { a: show(from) }) : fmt(t.zones.range, { a: show(from), b: show(to) });

  return (
    <>
      <Card>
        <Kicker tone={saved ? "volt" : "faint"}>{saved ? t.zones.isMine : t.zones.isDefault}</Kicker>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={`${pace ? t.zones.easyPace : t.zones.easySpeed} (${unit})`} hint={t.zones.easyHint}>
            <input
              className={inputCls}
              inputMode={pace ? "text" : "decimal"}
              value={easyT}
              placeholder={pace ? t.zones.paceExample : undefined}
              aria-invalid={easy === null}
              onChange={(e) => setEasyT(e.target.value)}
            />
          </Field>
          <Field label={`${pace ? t.zones.hardPace : t.zones.hardSpeed} (${unit})`} hint={t.zones.hardHint}>
            <input
              className={inputCls}
              inputMode={pace ? "text" : "decimal"}
              value={hardT}
              placeholder={pace ? t.zones.paceExample : undefined}
              aria-invalid={hard === null}
              onChange={(e) => setHardT(e.target.value)}
            />
          </Field>
        </div>
        {(easy === null || hard === null) && (
          <p className="mt-2 text-sm text-down-fg" role="alert">
            {pace ? t.zones.invalidPace : t.zones.invalidSpeed}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="volt" disabled={easy === null || hard === null || (!!saved && !saved.custom && !changed)} onClick={saveEasyHard}>
            {t.common.save}
          </Btn>
          {saved && (
            <Btn variant="ghost" onClick={() => save(undefined)}>
              {t.zones.reset}
            </Btn>
          )}
        </div>
      </Card>

      <Card>
        <H2>{t.zones.preview}</H2>
        {preview ? (
          <ol className="mt-2 space-y-1">
            {zoneRanges(preview).map((r) => (
              <li key={r.zone} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-semibold">{fmt(t.zones.zoneN, { n: r.zone })}</span>
                <span className="tabular-nums">
                  {rangeLabel(r.from, r.to)} <span className="text-muted">{unit}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Small className="mt-2">–</Small>
        )}
        <Small className="mt-2">{t.zones.belowZone1}</Small>
      </Card>

      <Card>
        <H2>{t.zones.learn}</H2>
        {proposal === undefined ? (
          <Btn variant="ghost" className="mt-2" onClick={() => setProposal(learnSpeedZones(mine, sport) ?? null)}>
            {t.zones.learn}
          </Btn>
        ) : proposal === null ? (
          <Small className="mt-2">{t.zones.learnNone}</Small>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm">
              {fmt(t.zones.learnProposal, { easy: `${show(proposal.easy)} ${unit}`, hard: `${show(proposal.hard)} ${unit}` })}
            </p>
            <Btn variant="volt" onClick={() => save(cleanSpeedSetting(proposal))}>
              {t.zones.apply}
            </Btn>
          </div>
        )}
      </Card>

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-display font-semibold">{t.zones.advanced}</summary>
        <Small className="mt-2">{t.zones.advancedHint}</Small>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {customT.map((v, i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-xs text-muted">{fmt(t.zones.zoneN, { n: i + 1 })}</span>
              <input
                className="h-11 w-full rounded-lg border border-line bg-night px-2 text-center text-sm tabular-nums"
                inputMode={pace ? "text" : "decimal"}
                value={v}
                aria-invalid={customKmh[i] === null}
                onChange={(e) => setCustomT((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
              />
            </label>
          ))}
        </div>
        <Small className="mt-1">{unit}</Small>
        {!custom && (
          <p className="mt-2 text-sm text-down-fg" role="alert">
            {t.zones.invalidCustom}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            variant="volt"
            disabled={!custom || easy === null || hard === null}
            onClick={() => custom && easy !== null && hard !== null && save(cleanSpeedSetting({ easy, hard, custom }))}
          >
            {t.zones.useCustom}
          </Btn>
          {saved?.custom && (
            <Btn variant="ghost" onClick={() => save({ easy: saved.easy, hard: saved.hard })}>
              {t.zones.dropCustom}
            </Btn>
          )}
        </div>
      </details>
    </>
  );
}
