"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cityDark from "@/data/map/city-dark.json";
import cityLight from "@/data/map/city-light.json";
import type { LatLon } from "@/lib/webapp/geo";
import { PLACES_ATTRIBUTION, PLACES_LICENSE_URL, type NearPlace } from "@/lib/webapp/places";

/**
 * The map of places near you (the live map's setup, LiveMap.tsx: MapLibre GL JS with the app's City style on
 * OpenFreeMap tiles, worker served from /maplibre/): the places as volt dots (the one picked in pulse), your position
 * as a small dot drawn only on this page (never sent). Tapping a dot picks its card in the list.
 */

function themeNow(): "dark" | "light" {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const asGeo = (places: readonly NearPlace[], selected: string | null): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: places.map((p) => ({
    type: "Feature",
    properties: { id: p.id, picked: p.id === selected ? 1 : 0 },
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
  })),
});

export function PlacesMap({
  here,
  places,
  selected,
  onSelect,
  youLabel,
  creditLabel,
  className,
}: {
  here: LatLon | null;
  places: readonly NearPlace[];
  selected: string | null;
  onSelect: (id: string) => void;
  youLabel: string;
  creditLabel: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const me = useRef<Marker | null>(null);
  const pick = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

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
        m.on("load", () => {
          m.addSource("places", { type: "geojson", data: asGeo([], null) });
          m.addLayer({
            id: "places",
            type: "circle",
            source: "places",
            paint: {
              "circle-radius": ["case", ["==", ["get", "picked"], 1], 10, 7],
              "circle-color": ["case", ["==", ["get", "picked"], 1], "#ff3d6e", "#ccff00"],
              "circle-stroke-color": "#0e1012",
              "circle-stroke-width": 2,
            },
          });
          m.on("click", "places", (e: MapLayerMouseEvent) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") pick.current(id);
          });
          m.on("mouseenter", "places", () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", "places", () => (m.getCanvas().style.cursor = ""));
          setReady(true);
        });
        m.on("error", (e) => console.warn("map:", e.error?.message ?? e));
      } catch {
        if (!gone) setFailed(true);
      }
    })();
    return () => {
      gone = true;
      me.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // The places, and the camera on you and the nearest few.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("places") as GeoJSONSource | undefined)?.setData(asGeo(places, selected));
  }, [places, selected, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !here) return;
    const pts = [here, ...places.slice(0, 8)];
    let [w, s, e, n] = [here.lon, here.lat, here.lon, here.lat];
    for (const p of pts) {
      w = Math.min(w, p.lon);
      e = Math.max(e, p.lon);
      s = Math.min(s, p.lat);
      n = Math.max(n, p.lat);
    }
    if (pts.length === 1) m.jumpTo({ center: [here.lon, here.lat], zoom: 14 });
    else
      m.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 48, maxZoom: 16, duration: 600 },
      );
  }, [here, places, ready]);

  // The picked place in view.
  useEffect(() => {
    const m = map.current;
    const p = places.find((x) => x.id === selected);
    if (!m || !ready || !p) return;
    if (!m.getBounds().contains([p.lon, p.lat])) m.easeTo({ center: [p.lon, p.lat], duration: 500 });
  }, [selected, places, ready]);

  // You: a dot on this page only.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !here) return;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (!me.current) {
        const el = document.createElement("div");
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", youLabel);
        el.style.cssText =
          "width:16px;height:16px;border-radius:9999px;background:#7fb6f5;border:3px solid #fff;box-shadow:0 0 0 6px rgba(127,182,245,.3)";
        me.current = new ml.Marker({ element: el }).setLngLat([here.lon, here.lat]).addTo(m);
      } else me.current.setLngLat([here.lon, here.lat]);
    })();
  }, [here, ready, youLabel]);

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-surface">
        {failed ? null : <div ref={box} className="h-full w-full" />}
        <p className="pointer-events-auto absolute bottom-1 left-1 rounded bg-night/80 px-1.5 py-0.5 text-[10px] text-muted">
          {creditLabel}{" "}
          <a className="underline" href={PLACES_LICENSE_URL} target="_blank" rel="noopener noreferrer">
            {PLACES_ATTRIBUTION}
          </a>
        </p>
      </div>
    </div>
  );
}
