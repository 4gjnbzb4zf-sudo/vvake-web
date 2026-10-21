import { bigDigitSize, type CameraHeartStats } from "./cameraHeart";

/**
 * The web camera screen's heart and big numbers (the phone's camera-workout.tsx, build 36): the strap's heart rate
 * through cameraHeart.ts (copied from game-core), its zone's colour, the summary's heart effort and which points card
 * it shows; and the big digits sized to stay on one line. Pure: tested in webHeart.test.ts.
 */

/** Tailwind classes of a zone's chip on the camera picture (dark text on the zone's colour). */
export const ZONE_TONE: readonly string[] = [
  "bg-surface-2 text-white",
  "bg-sky text-ink",
  "bg-mint text-ink",
  "bg-butter text-ink",
  "bg-down text-ink",
  "bg-pulse text-ink",
];
export const zoneTone = (zone: number) => ZONE_TONE[Math.max(0, Math.min(5, Math.round(zone) || 0))]!;

/**
 * The font size (px) of a big number in a box `width` px wide: game-core's bigDigitSize (one line, ~0.8 em a digit),
 * the larger cap on a wide window. Before the box is measured: null (the CSS clamp() fallback applies).
 */
export function bigNumberPx(text: string, width: number, caps: { small: number; large: number }, min = 40): number | null {
  if (!(width > 0)) return null;
  return bigDigitSize(text, width, width >= 600 ? caps.large : caps.small, min);
}

/** The CSS fallback until the box is measured: as wide as the window allows, capped. */
export function bigNumberFallback(text: string, maxPx: number): string {
  const em = Math.max(
    1,
    [...text].reduce((a, ch) => a + (ch === ":" || ch === "." ? 0.4 : ch === "s" ? 0.7 : 0.8), 0),
  );
  return `clamp(40px, ${Math.floor((88 / em) * 10) / 10}vw, ${maxPx}px)`;
}

/** Heart samples enough for heart points (the upload's tier B, the server scores them): at least two readings. */
export const hasStrapHeart = (samples: readonly { bpm?: number }[]) => samples.filter((s) => s.bpm !== undefined).length >= 2;

/** Which points the summary's card is about: heart points with a strap's samples, else the small camera points. */
export const pointsKind = (samples: readonly { bpm?: number }[]): "heart" | "camera" => (hasStrapHeart(samples) ? "heart" : "camera");

/** The summary's zone bars: zones 1…5 with their seconds and share of the time in zones (resting left out). */
export function zoneBars(stats: CameraHeartStats | null): { zone: number; s: number; share: number }[] {
  if (!stats) return [];
  const z = stats.zoneS.slice(1);
  const total = z.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return z.map((s, i) => ({ zone: i + 1, s, share: s / total }));
}

/**
 * On a screen shorter than 760 px (a 320×640 phone, a phone in landscape) the camera screen's big number is at most
 * 17% of the height (never under 72 px), so the lines under it and the heart tile keep their room.
 */
export function shortScreenCap<T extends number | null>(px: T, viewportHeight: number): T {
  if (!px || !viewportHeight || viewportHeight >= 760) return px;
  return Math.min(px, Math.max(72, Math.round(viewportHeight * 0.17))) as T;
}

/**
 * The big number's size to fit the camera screen's middle (between the controls and the heart tile): its height less
 * the room its lines take (`reserved`), never under `min`. Null until the middle is measured.
 */
export function middleFitPx(middleHeight: number, reserved: number, min = 56): number | null {
  if (!(middleHeight > 0)) return null;
  return Math.max(min, Math.round(middleHeight - reserved));
}
