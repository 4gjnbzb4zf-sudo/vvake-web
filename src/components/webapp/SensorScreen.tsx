"use client";

import { useEffect, useState } from "react";
import { bleSupport, forgetSensor, rememberedSensor, type BleSupport } from "@/lib/webapp/ble";
import { heartProfileOf, zoneOf, zoneThresholds } from "@/lib/webapp/heart";
import { useApp } from "./AppContext";
import { Btn, Card, H1, Kicker, Note, Small } from "./ui";

/**
 * The heart-rate sensor (Web Bluetooth, standard Heart Rate Service): connect, the live reading and your zone, the
 * battery when the sensor says it, reconnect after a drop, forget. On iPhone and Firefox: why it can't work there.
 */
export function SensorScreen() {
  const { t, sensor, sensorState, bpm, battery, athlete, fmt } = useApp();
  const [support, setSupport] = useState<BleSupport | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSupport(bleSupport());
      setSaved(rememberedSensor());
    }, 0);
    return () => window.clearTimeout(id);
  }, [sensorState]);
  const heart = heartProfileOf(athlete?.health ?? null);
  const zones = zoneThresholds(heart);
  const zone = bpm ? zoneOf(bpm, heart) : 0;

  const connect = async () => {
    setError(false);
    try {
      await sensor.pair();
    } catch (e) {
      // Closing the picker isn't an error worth a message.
      if (!(e instanceof DOMException && e.name === "NotFoundError")) setError(true);
    }
  };

  return (
    <div className="space-y-4">
      <H1>{t.sensor.title}</H1>
      <Small>{t.sensor.lead}</Small>
      {support && support !== "ok" && (
        <Note tone="butter">
          {support === "ios" ? t.sensor.unsupportedIos : support === "insecure" ? t.sensor.insecure : t.sensor.unsupported}
        </Note>
      )}
      {support === "ok" && (
        <Card tone={sensorState === "connected" ? undefined : sensorState === "lost" ? "butter" : undefined}>
          <Kicker tone={sensorState === "connected" ? "mint" : sensorState === "lost" ? "butter" : "faint"}>
            {sensorState === "connected"
              ? fmt(t.sensor.connected, { name: sensor.name || "♥" })
              : sensorState === "idle"
                ? saved?.name || t.sensor.title
                : t.sensor[sensorState]}
          </Kicker>
          {sensorState === "connected" && (
            <div className="mt-3 flex items-end gap-3">
              <p className="font-display text-5xl font-bold text-pulse-fg" aria-live="polite">
                {bpm ?? "–"}
              </p>
              <div className="pb-1">
                <Small>bpm</Small>
                <p className="text-sm font-semibold">{zone > 0 ? fmt(t.workout.zone, { n: zone }) : t.workout.noZone}</p>
              </div>
              {battery !== null && <Small className="ml-auto pb-1">{fmt(t.sensor.battery, { n: battery })}</Small>}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(sensorState === "idle" || sensorState === "lost") && (
              <Btn onClick={() => void (sensorState === "lost" ? sensor.retryNow() : connect())}>
                {sensorState === "lost" ? t.sensor.reconnect : t.sensor.connect}
              </Btn>
            )}
            {sensorState === "connected" && (
              <Btn variant="ghost" onClick={() => sensor.disconnect()}>
                {t.sensor.disconnect}
              </Btn>
            )}
            {saved && sensorState === "idle" && (
              <Btn
                variant="ghost"
                onClick={() => {
                  forgetSensor();
                  setSaved(null);
                }}
              >
                {t.sensor.forget}
              </Btn>
            )}
          </div>
          {sensorState === "lost" && <Small className="mt-2">{t.sensor.lost}</Small>}
          {error && <p className="mt-2 text-sm text-down-fg">{t.common.error}</p>}
        </Card>
      )}
      <Card>
        <Kicker tone="mint">{t.sensor.zonesFrom}</Kicker>
        <ol className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
          {zones.map((z, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-2">
              <span className="block font-semibold">{fmt(t.workout.zone, { n: i + 1 })}</span>
              {z}+
            </li>
          ))}
        </ol>
      </Card>
      <Note>{t.sensor.privacy}</Note>
      <Note tone="butter">{t.workout.webRule}</Note>
    </div>
  );
}
