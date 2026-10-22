"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SportZonesEditor } from "@/components/zones/SportZonesEditor";
import { Section } from "@/components/ui/Section";
import { getSportZonesDict } from "@/i18n/sportZones";
import type { Athlete } from "@/lib/accountApi";
import { heartProfileOf } from "@/lib/webapp/heart";
import type { HeartZonesPrefs } from "@/lib/webapp/sportHeart";
import type { SpeedZonesPrefs } from "@/lib/webapp/speedZones";
import { heartKey, parseHeartZones, parseSpeedZones, readStored, reconcile, writeStored, zonesKey } from "@/lib/webapp/workoutPrefs";
import { useAction } from "./AccountUi";
import { sectionIndex, type PanelProps } from "./shared";

/** The newer of this browser's copy and the account's (newest `at` wins, as on the server). */
function newest<T extends { at: string }>(local: T | null, account: T | null): T | null {
  const r = reconcile(local, account);
  return r.adopt ?? local ?? account;
}

/**
 * Sports & zones on the account page (ADR-0048): the same editor as the web app's Zones screen. Each change is sent
 * whole with a fresh `at` (PATCH /v1/me prefs.heartZones / prefs.speedZones; newest wins). This browser keeps a copy
 * too (the web app's keys), so an API that doesn't keep heartZones yet still shows what was set here.
 */
export function ZonesSection(p: PanelProps) {
  const { api, me, setMe, lang, errorMsg } = p;
  const t = getSportZonesDict(lang);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  useEffect(() => {
    let live = true;
    api
      .athlete()
      .then((a) => live && setAthlete(a))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api]);

  const accountHeart = useMemo(() => parseHeartZones(me.prefs?.heartZones), [me.prefs?.heartZones]);
  const accountSpeed = useMemo(() => parseSpeedZones(me.prefs?.speedZones), [me.prefs?.speedZones]);
  const [heart, setHeart] = useState<HeartZonesPrefs | null>(() => newest(readStored(heartKey(me.id), parseHeartZones), accountHeart));
  const [speed, setSpeed] = useState<SpeedZonesPrefs | null>(() => newest(readStored(zonesKey(me.id), parseSpeedZones), accountSpeed));
  // Changed on another device and reloaded here: the account's copy wins when newer.
  const [seen, setSeen] = useState({ accountHeart, accountSpeed });
  if (seen.accountHeart !== accountHeart || seen.accountSpeed !== accountSpeed) {
    setSeen({ accountHeart, accountSpeed });
    setHeart((h) => newest(h, accountHeart));
    setSpeed((s) => newest(s, accountSpeed));
  }

  const { run, status } = useAction(errorMsg);
  const onHeart = useCallback(
    (h: HeartZonesPrefs) => {
      setHeart(h);
      writeStored(heartKey(me.id), h);
      return run(async () => setMe(await api.patchMe({ prefs: { heartZones: h } })), t.saved);
    },
    [api, me.id, run, setMe, t.saved],
  );
  const onSpeed = useCallback(
    (s: SpeedZonesPrefs) => {
      setSpeed(s);
      writeStored(zonesKey(me.id), s);
      return run(async () => setMe(await api.patchMe({ prefs: { speedZones: s } })), t.saved);
    },
    [api, me.id, run, setMe, t.saved],
  );

  const health = athlete?.health ?? null;
  const base = useMemo(() => heartProfileOf(health), [health]);
  const levels = useMemo(() => Object.fromEntries((athlete?.survey?.sports ?? []).map((s) => [s.sport, s.experience ?? null])), [athlete]);
  const units = me.coach?.units === "imperial" ? "imperial" : "metric";

  return (
    <Section id="zones" index={sectionIndex("zones")} kicker={t.title} title={t.title} lead={t.lead}>
      <div className="mt-8 max-w-3xl">
        <SportZonesEditor
          lang={lang}
          units={units}
          base={base}
          shared={!!(health?.age && health?.restingHr)}
          heartZones={heart}
          legacyZones={health?.zones ?? null}
          speedZones={speed}
          onHeart={onHeart}
          onSpeed={onSpeed}
          levels={levels}
          status={status}
        />
      </div>
    </Section>
  );
}
