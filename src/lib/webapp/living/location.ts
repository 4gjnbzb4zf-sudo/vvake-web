// Copied from VVFit packages/game-core/src/location.ts (ddd4e03a 2026-09-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Location features, privacy first (docs/02-product/crew-sessions.md, C9, C24).
 * - Live location: mutual opt-in, per crew session, time-boxed, revocable.
 * - Route cards: paths trimmed around start/finish and privacy zones, simplified, drawn without a map.
 */
export interface LatLon {
  lat: number;
  lon: number;
}

// ── Live location (mutual consent) ───────────────────────────────────────────

export interface LiveShareContext {
  /** A agreed to share with B for this session. */
  aConsents: boolean;
  /** B agreed to share with A for this session. */
  bConsents: boolean;
  /** Either side can stop at any time. */
  revoked: boolean;
  sessionStartMs: number;
  sessionEndMs: number;
  nowMs: number;
}

/** Live location flows only when both said yes, nobody revoked, and it's within [start − 60 min, end + 30 min]. */
export function canShareLiveLocation(c: LiveShareContext): boolean {
  if (!c.aConsents || !c.bConsents || c.revoked) return false;
  return c.nowMs >= c.sessionStartMs - 60 * 60_000 && c.nowMs <= c.sessionEndMs + 30 * 60_000;
}

// ── Route cards ───────────────────────────────────────────────────────────────

const EARTH_M = 6_371_000;

export function distanceM(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export interface PrivacyZone {
  center: LatLon;
  radiusM: number;
}

/**
 * Hides where a route starts and ends (default 200 m each way) and every point inside a privacy zone.
 * Points are removed, not blurred, so the shared shape never leads back to a home or workplace.
 */
export function trimForPrivacy(path: readonly LatLon[], zones: readonly PrivacyZone[] = [], trimM = 200): LatLon[] {
  if (path.length < 2) return [];
  const start = path[0]!;
  const end = path[path.length - 1]!;
  return path.filter(
    (p) => distanceM(p, start) > trimM && distanceM(p, end) > trimM && zones.every((z) => distanceM(p, z.center) > z.radiusM),
  );
}

/** Ramer–Douglas–Peucker simplification in degrees space (fine for card-sized drawings). */
export function simplifyPath(path: readonly LatLon[], tolerance = 0.00005): LatLon[] {
  if (path.length <= 2) return [...path];
  const first = path[0]!;
  const last = path[path.length - 1]!;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i]!;
    const dx = last.lon - first.lon;
    const dy = last.lat - first.lat;
    const len = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs(dy * p.lon - dx * p.lat + last.lon * first.lat - last.lat * first.lon) / len;
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  return [...simplifyPath(path.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyPath(path.slice(index), tolerance)];
}

/**
 * SVG path data for a card of `width × height` (with padding), keeping the route's aspect ratio.
 * Longitude is scaled by cos(latitude) so shapes aren't stretched away from the equator.
 */
export function routeToSvgPath(path: readonly LatLon[], width: number, height: number, padding = 12): string {
  if (path.length < 2) return "";
  const k = Math.cos((path[0]!.lat * Math.PI) / 180);
  const xs = path.map((p) => p.lon * k);
  const ys = path.map((p) => p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((width - 2 * padding) / (maxX - minX || 1e-9), (height - 2 * padding) / (maxY - minY || 1e-9));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  return path
    .map((_, i) => {
      const x = offX + (xs[i]! - minX) * scale;
      const y = height - (offY + (ys[i]! - minY) * scale);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
