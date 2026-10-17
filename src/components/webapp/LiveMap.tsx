"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cityDark from "@/data/map/city-dark.json";
import cityLight from "@/data/map/city-light.json";
import type { LatLon, RoutePoint } from "@/lib/webapp/geo";

/**
 * The live map (the phone's MapLibre City look, apps/mobile lib/mapStyles.ts, exported to src/data/map): OpenFreeMap
 * vector tiles (free, no key, "© OpenMapTiles © OpenStreetMap contributors"), your route in volt and your VVaker on
 * it, the camera following you like a GPS (street level, you in the middle) until you drag the map; "Recenter on me"
 * picks the follow up again. MapLibre GL JS is BSD-3-Clause; its worker is served from /maplibre/ (same origin, so the
 * page's CSP needs no blob: worker), copied there by scripts/copy-maplibre.ts.
 */

const FOLLOW_ZOOM = 16.5;

function themeNow(): "dark" | "light" {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function LiveMap({
  here,
  route,
  avatar,
  recenterLabel,
  findingLabel,
  className,
}: {
  here: LatLon | null;
  route: readonly RoutePoint[];
  avatar: string;
  recenterLabel: string;
  findingLabel: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  const [failed, setFailed] = useState(false);
  const firstFix = useRef(true);

  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (gone || !box.current) return;
        ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const m = new ml.Map({
          container: box.current,
          style: (themeNow() === "light" ? cityLight : cityDark) as unknown as StyleSpecification,
          center: [0, 20],
          zoom: 1.5,
          attributionControl: { compact: true },
          pitchWithRotate: false,
          dragRotate: false,
        });
        map.current = m;
        m.on("dragstart", () => setFollow(false));
        m.on("load", () => {
          m.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
          });
          m.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            paint: { "line-color": "#0e1012", "line-width": 9, "line-opacity": 0.5 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          m.addLayer({
            id: "route",
            type: "line",
            source: "route",
            paint: { "line-color": "#ccff00", "line-width": 6 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          setReady(true);
        });
        m.on("error", (e) => console.warn("map:", e.error?.message ?? e));
      } catch {
        if (!gone) setFailed(true);
      }
    })();
    return () => {
      gone = true;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // The route.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("route") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: route.map((p) => [p.lon, p.lat]) },
    });
  }, [route, ready]);

  // You, and the camera following you.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !here) return;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (!marker.current) {
        const el = document.createElement("div");
        el.className = "vvake-me";
        const img = document.createElement("img");
        img.src = avatar;
        img.alt = "";
        img.width = 40;
        img.height = 64;
        img.style.objectFit = "contain";
        img.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,.5))";
        el.appendChild(img);
        marker.current = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([here.lon, here.lat]).addTo(m);
      } else marker.current.setLngLat([here.lon, here.lat]);
      if (firstFix.current) {
        firstFix.current = false;
        m.jumpTo({ center: [here.lon, here.lat], zoom: FOLLOW_ZOOM });
      } else if (follow) m.easeTo({ center: [here.lon, here.lat], duration: 900 });
    })();
  }, [here, ready, follow, avatar]);

  if (failed)
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center text-sm text-muted">{findingLabel}</div>
      </div>
    );

  return (
    <div className={className}>
      <div ref={box} className="h-full w-full" />
      {!here && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-night/80 px-3 py-1 text-sm text-text"
        >
          {findingLabel}
        </p>
      )}
      {!follow && here && (
        <button
          type="button"
          onClick={() => {
            setFollow(true);
            map.current?.easeTo({ center: [here.lon, here.lat], zoom: Math.max(map.current.getZoom(), FOLLOW_ZOOM - 1) });
          }}
          className="absolute right-3 bottom-3 h-11 rounded-full bg-night/90 px-4 text-sm font-semibold text-text shadow ring-1 ring-line"
        >
          {recenterLabel}
        </button>
      )}
    </div>
  );
}
