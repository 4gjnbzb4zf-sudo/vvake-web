import type { Locale } from "@/i18n/config";
import { framingReport, type FramingReport, type PoseFrame } from "./cameraPose";
import { routineForPlan } from "./cameraSession";

/**
 * How a camera workout is reached and set up in the browser (the phone's lib/cameraEntry.ts and lib/cameraOutline.ts,
 * monorepo apps/mobile): which sports offer "With the camera" next to "Heart only", the last choice per sport, the
 * camera step's state (never a blank screen: unsupported browser, not https, no camera, the permission to ask,
 * denied with how to allow it in this browser, an error, ready), the hint over the preview when nobody is seen, and
 * when the body outline shows (35 s, then it fades). Pure: tested in webSetup.test.ts.
 */

// ── Which sports, and the choice ────────────────────────────────────────────────────────────────────────────────

/** Indoor sports the camera counts (routineForPlan has a routine for each). Mind-body (meditation) stays out. */
export const CAMERA_SPORTS: readonly string[] = [
  "strength",
  "functional-strength",
  "cross-training",
  "core",
  "pilates",
  "hiit",
  "mixed-cardio",
  "yoga",
  "flexibility",
  "cooldown",
  "recovery",
];

/** A sport key → itself when the camera can run it, else null. */
export function cameraSport(key: string | null | undefined): string | null {
  if (!key) return null;
  return CAMERA_SPORTS.includes(key) && routineForPlan(key, 20, true) ? key : null;
}

export type EntryMode = "camera" | "heart";
export type EntryChoices = Record<string, EntryMode>;

/** The stored choices (bad or old JSON → none). */
export function parseEntryChoices(json: string | null | undefined): EntryChoices {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: EntryChoices = {};
    for (const [k, m] of Object.entries(v as Record<string, unknown>)) if (m === "camera" || m === "heart") out[k] = m;
    return out;
  } catch {
    return {};
  }
}

export const withEntryChoice = (all: EntryChoices, sport: string, mode: EntryMode): EntryChoices => ({ ...all, [sport]: mode });

/** The highlighted choice: the last one for this sport, else the camera (nothing to wear in a browser). */
export const defaultEntry = (all: EntryChoices, sport: string): EntryMode => all[sport] ?? "camera";

const ENTRY_KEY = "vvake.camera.entry.v1";
const OUTLINE_KEY = "vvake.camera.outline.v1";

/** This browser's choices (every access wrapped: private windows and blocked storage work, they just forget). */
export function loadEntryChoices(): EntryChoices {
  try {
    return parseEntryChoices(localStorage.getItem(ENTRY_KEY));
  } catch {
    return {};
  }
}
export function saveEntryChoices(c: EntryChoices) {
  try {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(c));
  } catch {
    // forgotten next time
  }
}

/** "Show my body outline": on unless turned off in this browser. */
export const parseOutlinePref = (v: string | null | undefined): boolean => v !== "0";
export function loadOutlinePref(): boolean {
  try {
    return parseOutlinePref(localStorage.getItem(OUTLINE_KEY));
  } catch {
    return true;
  }
}
export function saveOutlinePref(on: boolean) {
  try {
    localStorage.setItem(OUTLINE_KEY, on ? "1" : "0");
  } catch {
    // forgotten next time
  }
}

// ── The camera step ─────────────────────────────────────────────────────────────────────────────────────────────

export type CameraSetupState = "unsupported" | "insecure" | "no_camera" | "checking" | "ask" | "denied" | "error" | "ready";

/** What this browser can do: getUserMedia and WebAssembly, on https (or localhost). */
export function browserSupport(x: { secure: boolean; mediaDevices: boolean; wasm: boolean }): "ok" | "insecure" | "unsupported" {
  if (!x.secure) return "insecure";
  if (!x.mediaDevices || !x.wasm) return "unsupported";
  return "ok";
}

/** Before asking: the Permissions API's answer when there is one ("granted", "denied", "prompt"), and the cameras seen. */
export function initialState(x: {
  support: "ok" | "insecure" | "unsupported";
  permission: string | null;
  cameras: number | null;
}): CameraSetupState {
  if (x.support !== "ok") return x.support;
  if (x.cameras === 0) return "no_camera";
  if (x.permission === "denied") return "denied";
  if (x.permission === "granted") return "ready";
  return "ask";
}

/** A getUserMedia (or start) failure → the state to show. */
export function errorState(err: unknown): "denied" | "no_camera" | "error" {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no_camera";
  return "error";
}

export type BrowserKind = "chrome" | "edge" | "safari" | "ios" | "firefox" | "samsung" | "other";

/** Which browser, only to say where its camera switch is. */
export function browserKind(ua: string): BrowserKind {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox|FxiOS/.test(ua)) return "firefox";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Chrome|CriOS|Chromium/.test(ua)) return "chrome";
  if (/Safari/.test(ua)) return "safari";
  return "other";
}

const HELP: Record<Locale, Record<BrowserKind, string>> = {
  en: {
    chrome:
      "In Chrome: click the camera (or site settings) icon at the left of the address bar, set Camera to Allow, then reload the page.",
    edge: "In Edge: click the lock or camera icon at the left of the address bar, set Camera to Allow, then reload the page.",
    safari: "In Safari: Safari menu > Settings for vvake.com (or Settings > Websites > Camera), choose Allow, then reload the page.",
    ios: "On iPhone or iPad: tap “aA” in the address bar > Website Settings > Camera > Allow (or Settings > Safari > Camera), then reload the page.",
    firefox: "In Firefox: click the camera icon with a line through it in the address bar, remove the block, then reload the page.",
    samsung: "In Samsung Internet: tap the lock icon in the address bar > Permissions > Camera > Allow, then reload the page.",
    other:
      "Allow the camera for vvake.com in your browser's site settings (usually the icon at the left of the address bar), then reload the page.",
  },
  fr: {
    chrome:
      "Dans Chrome : clique sur l’icône de caméra (ou des réglages du site) à gauche de la barre d’adresse, mets Caméra sur Autoriser, puis recharge la page.",
    edge: "Dans Edge : clique sur le cadenas ou la caméra à gauche de la barre d’adresse, mets Caméra sur Autoriser, puis recharge la page.",
    safari:
      "Dans Safari : menu Safari > Réglages pour vvake.com (ou Réglages > Sites web > Caméra), choisis Autoriser, puis recharge la page.",
    ios: "Sur iPhone ou iPad : touche « aA » dans la barre d’adresse > Réglages du site web > Caméra > Autoriser (ou Réglages > Safari > Caméra), puis recharge la page.",
    firefox: "Dans Firefox : clique sur l’icône de caméra barrée dans la barre d’adresse, retire le blocage, puis recharge la page.",
    samsung:
      "Dans Samsung Internet : touche le cadenas dans la barre d’adresse > Autorisations > Caméra > Autoriser, puis recharge la page.",
    other:
      "Autorise la caméra pour vvake.com dans les réglages du site de ton navigateur (souvent l’icône à gauche de la barre d’adresse), puis recharge la page.",
  },
};

/** Where this browser's camera switch is, in a sentence. */
export const deniedHelp = (kind: BrowserKind, lang: Locale) => HELP[lang][kind];

/** Nobody seen this long after the camera started: say why (too dark, out of frame). */
export const NOBODY_HINT_MS = 4000;
/** No frame at all this long after the camera started: the camera isn't delivering. */
export const NO_FRAMES_MS = 6000;

export type PreviewHint = { kind: "starting" | "no_frames" | "nobody" } | { kind: "framing"; report: FramingReport };

/**
 * What the setup preview says now: starting until the camera runs, no_frames when it runs but nothing is analysed,
 * nobody when no one has been seen for a while (too dark, or out of the picture), else the framing guide (the parts
 * VVake can't see and the tips).
 */
export function previewHint(x: {
  startedAt: number | null;
  lastFrameAt: number | null;
  lastPersonAt: number | null;
  frame: PoseFrame | null;
  now: number;
}): PreviewHint {
  if (x.startedAt == null) return { kind: "starting" };
  if (x.lastFrameAt == null) return { kind: x.now - x.startedAt >= NO_FRAMES_MS ? "no_frames" : "starting" };
  if (x.frame) return { kind: "framing", report: framingReport(x.frame) };
  const since = x.lastPersonAt ?? x.startedAt;
  return x.now - since >= NOBODY_HINT_MS ? { kind: "nobody" } : { kind: "framing", report: framingReport(null) };
}

/** A value that changes once its new key held `ms` (a joint flickering doesn't flash the line): the phone's useSteady. */
export class Steady<T> {
  private shown: { key: string; value: T } | null = null;
  private pending: { key: string; since: number } | null = null;
  constructor(private readonly ms = 1000) {}
  next(value: T, key: string, now: number): T {
    if (!this.shown || key === this.shown.key) {
      this.shown = { key, value };
      this.pending = null;
    } else {
      if (!this.pending || this.pending.key !== key) this.pending = { key, since: now };
      if (now - this.pending.since >= this.ms) {
        this.shown = { key, value };
        this.pending = null;
      }
    }
    return this.shown.value;
  }
}

// ── The body outline (apps/mobile lib/cameraOutline.ts) ─────────────────────────────────────────────────────────

/** How long the outline shows each time (ms). */
export const OUTLINE_SHOW_MS = 35_000;
/** Lost this long (nobody seen), the outline comes back when you're found again (ms). */
export const OUTLINE_LOST_MS = 5_000;
/** The fade at the end (ms). */
export const OUTLINE_FADE_MS = 1_200;

/**
 * When the outline (the stick figure over the picture) shows: with "Show my body outline" on, 35 s once the camera
 * sees you, then it fades out (you step away from the screen to train and are still counted); again for 35 s on
 * "Show outline" (also with the setting off: you asked) or when VVake lost you for 5 s and finds you again.
 */
export class OutlineClock {
  private until = 0;
  private lostSince: number | null = null;
  private wasLost = true;

  constructor(private auto: boolean) {}

  /** The setting changed: on shows it now (you just asked for it); off hides it now. */
  setAuto(on: boolean, now: number) {
    this.auto = on;
    this.until = on ? now + OUTLINE_SHOW_MS : 0;
  }

  /** "Show outline": 35 s from now, whatever the setting. */
  show(now: number) {
    this.until = now + OUTLINE_SHOW_MS;
  }

  /** Each frame: whether someone is seen. */
  track(now: number, seen: boolean) {
    if (!seen) {
      if (this.lostSince === null) this.lostSince = now;
      if (now - this.lostSince >= OUTLINE_LOST_MS) this.wasLost = true;
      return;
    }
    this.lostSince = null;
    if (this.wasLost) {
      this.wasLost = false;
      if (this.auto) this.until = Math.max(this.until, now + OUTLINE_SHOW_MS);
    }
  }

  visible(now: number): boolean {
    return now < this.until;
  }

  leftS(now: number): number {
    return Math.max(0, Math.ceil((this.until - now) / 1000));
  }
}

/**
 * game-core's framing lines talk about "the phone"; in the browser the camera may be a webcam: the same line about
 * "the camera" ("Tilt the phone down…" → "Tilt the camera down…", « le téléphone » → « la caméra »).
 */
export function forCamera(text: string, lang: Locale): string {
  if (lang === "fr")
    return text
      .replace(/\bdu téléphone\b/g, "de la caméra")
      .replace(/\bau téléphone\b/g, "à la caméra")
      .replace(/\ble téléphone\b/g, "la caméra")
      .replace(/\bLe téléphone\b/g, "La caméra");
  return text.replace(/\bthe phone\b/g, "the camera").replace(/\bThe phone\b/g, "The camera");
}

// ── Hands-free (ADR-0046 amendment 2026-10-21): the last load per move, the summary's auto-save ────────────────────

const LOADS_KEY = "vvake.cameraLoads.v1";

/** The last load used per move (kg), as stored in this browser; anything odd is dropped. */
export function parseLoads(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>))
      if (/^[a-z0-9-]{2,40}$/.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 500) out[k] = Math.round(v * 10) / 10;
    return out;
  } catch {
    return {};
  }
}

/** This workout's loads over the stored ones; a cleared one (0 or none) is forgotten. */
export function mergeLoads(
  old: Readonly<Record<string, number>>,
  now: Readonly<Record<string, number | undefined>>,
): Record<string, number> {
  const out: Record<string, number> = { ...old };
  for (const [k, v] of Object.entries(now)) {
    if (v && v > 0) out[k] = Math.round(v * 10) / 10;
    else delete out[k];
  }
  return parseLoads(JSON.stringify(out));
}

export function loadCameraLoads(): Record<string, number> {
  try {
    return parseLoads(localStorage.getItem(LOADS_KEY));
  } catch {
    return {};
  }
}

export function saveCameraLoads(now: Readonly<Record<string, number | undefined>>) {
  try {
    localStorage.setItem(LOADS_KEY, JSON.stringify(mergeLoads(loadCameraLoads(), now)));
  } catch {
    // forgotten next time
  }
}

/** The summary saves itself after this long unless you touch the page (hands-free to the end). */
export const AUTO_SAVE_S = 20;

/** Seconds left before the auto-save (null once you touched the page: you save yourself). */
export function autoSaveLeft(shownAtMs: number, nowMs: number, touched: boolean): number | null {
  if (touched) return null;
  return Math.max(0, AUTO_SAVE_S - Math.floor((nowMs - shownAtMs) / 1000));
}
