"use client";

import { useMemo } from "react";
import { SportZonesEditor } from "@/components/zones/SportZonesEditor";
import { getSportZonesDict } from "@/i18n/sportZones";
import { heartProfileOf } from "@/lib/webapp/heart";
import { useApp } from "./AppContext";
import { H1, Small } from "./ui";

/**
 * Sports & zones (ADR-0044, ADR-0048; the apps' "Sports & zones" screen): for every sport, its heart-rate zones
 * (automatic from the sport family's max, your own max or five thresholds, in bpm or %), effort by feel, and its pace
 * or speed zones in the sport's unit, with "Learn from my sessions" from the account's recent sessions. Kept with the
 * account (prefs.heartZones and prefs.speedZones, each sent whole, newest wins): the phone and watches use the same.
 * Guidance only: points still need a heart rate, and prizes are unchanged.
 */
export function ZonesScreen() {
  const { lang, prefs, athlete, sessions, speedZones, setSpeedZones, heartZones, setHeartZones } = useApp();
  const t = getSportZonesDict(lang);
  const health = athlete?.health ?? null;
  const base = useMemo(() => heartProfileOf(health), [health]);
  const shared = !!(health?.age && health?.restingHr);
  const levels = useMemo(() => Object.fromEntries((athlete?.survey?.sports ?? []).map((s) => [s.sport, s.experience ?? null])), [athlete]);
  const legacy = health?.zones ?? null;
  return (
    <div className="space-y-4">
      <H1>{t.title}</H1>
      <Small>{t.lead}</Small>
      <SportZonesEditor
        lang={lang}
        units={prefs.units}
        base={base}
        shared={shared}
        heartZones={heartZones}
        legacyZones={legacy}
        speedZones={speedZones}
        onHeart={setHeartZones}
        onSpeed={(p) => setSpeedZones(p.sports)}
        sessions={sessions}
        levels={levels}
      />
    </div>
  );
}
