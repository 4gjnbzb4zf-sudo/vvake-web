import "server-only";
import { geoContains, geoNaturalEarth1 } from "d3-geo";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110m from "world-atlas/land-110m.json";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 470;
const STEP = 9;

export interface MapPoint {
  x: number;
  y: number;
}

/**
 * Voxel world: a grid of land dots, computed once at build time (static export), so visitors
 * download a few kilobytes of coordinates instead of a map library. Antarctica is cropped.
 */
export function worldDotMap(places: readonly { id: string; lat: number; lon: number }[]): {
  dots: MapPoint[];
  places: (MapPoint & { id: string })[];
  /** Drawing height after cropping Antarctica. */
  height: number;
} {
  const topology = land110m as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topology, topology.objects.land) as FeatureCollection<Polygon | MultiPolygon>;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [0, 0],
      [MAP_WIDTH, MAP_HEIGHT],
    ],
    { type: "Sphere" },
  );
  const cropBottom = projection([0, -58])?.[1] ?? MAP_HEIGHT;
  const dots: MapPoint[] = [];
  for (let y = STEP / 2; y < Math.min(MAP_HEIGHT, cropBottom); y += STEP) {
    for (let x = STEP / 2; x < MAP_WIDTH; x += STEP) {
      const lonLat = projection.invert?.([x, y]);
      if (lonLat && land.features.some((f) => geoContains(f, lonLat))) dots.push({ x, y });
    }
  }
  const projected = places.flatMap((p) => {
    const xy = projection([p.lon, p.lat]);
    return xy ? [{ id: p.id, x: xy[0], y: xy[1] }] : [];
  });
  return { dots, places: projected, height: Math.ceil(Math.min(MAP_HEIGHT, cropBottom)) };
}
