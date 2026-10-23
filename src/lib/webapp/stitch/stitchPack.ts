import { stitchWith, type StitchLang, type StitchTables } from "./stitchCore";
import { readPack, stitchedWav, type Pack } from "./voiceAudio";

/**
 * The stitched coach voice in the browser (VVFit ADR-0054): the full pack of small clips recorded once in the coach's
 * voice (`GET /v1/voice/stitch` says which; the pack itself is immutable per version, ~3–5 MB), kept in Cache Storage
 * under its own URL and read once per visit, so a workout line with numbers ("3 kilometres. Time 15:32.") plays in
 * the coach's voice with no network, stitched from its clips (stitchCore.ts `stitchWith` with the pack's own tables,
 * voiceAudio.ts `stitchedWav`).
 *
 * The decisions are pure (stitchPack.test.ts); the loader takes its fetch and cache so the tests can drive it.
 */

/**
 * GET /v1/voice/stitch?lang=&voice= (public): the packs of the language in the chosen coach voice (ADR-0056: urls
 * /v1/voice/stitch/<lang>-<gender>/<version>.vvs, never built here), null while they are being rendered.
 */
export interface StitchInfo {
  lang: StitchLang;
  ready: boolean;
  version: string | null;
  voiceTag: string | null;
  full: { url: string; bytes: number; clips?: number } | null;
}

/** What this browser keeps about the pack it has (a small JSON next to the pack in Cache Storage). */
export interface KeptPack {
  lang: StitchLang;
  version: string;
  voiceTag: string;
  /** The pack's URL (absolute): its Cache Storage key. */
  url: string;
}

export type PackPlan = { kind: "kept" } | { kind: "fetch"; url: string; version: string; voiceTag: string } | { kind: "none" };

/**
 * Which pack to use: the kept one when the API says it is still the current version (or can't be asked: offline,
 * error, rendering), a new download when the API has another version ready, none otherwise. A kept pack in another
 * voice than the API's is never used (one coach voice).
 */
export function planPack(info: StitchInfo | null, kept: KeptPack | null, apiUrl: string): PackPlan {
  if (!info) return kept ? { kind: "kept" } : { kind: "none" };
  if (kept && info.voiceTag && kept.voiceTag !== info.voiceTag) {
    return info.ready && info.full && info.version
      ? { kind: "fetch", url: absolute(info.full.url, apiUrl), version: info.version, voiceTag: info.voiceTag }
      : { kind: "none" };
  }
  if (!info.ready || !info.full || !info.version) return kept ? { kind: "kept" } : { kind: "none" };
  if (kept && kept.version === info.version) return { kind: "kept" };
  return { kind: "fetch", url: absolute(info.full.url, apiUrl), version: info.version, voiceTag: info.voiceTag ?? "" };
}

/** The pack's URL is relative to the API base. */
export function absolute(url: string, apiUrl: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${apiUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

/** A pack that is the one asked for: the language, the full kind, the version (when known), tables to stitch with. */
export function validPack(p: Pack | null, lang: StitchLang, version?: string): p is Pack {
  if (!p) return false;
  const h = p.header;
  if (h.v !== 1 || h.lang !== lang || h.kind !== "full" || h.codec !== "ima-adpcm" || !(h.rate > 0)) return false;
  if (version && h.version !== version) return false;
  return !!tablesOf(p);
}

export function tablesOf(p: Pack): StitchTables | null {
  const t = p.header.tables as Partial<StitchTables> | undefined;
  if (!t || typeof t !== "object" || !t.phrases || typeof t.maxLen !== "number" || !t.abbr || !t.per || !t.units || !Array.isArray(t.fem))
    return null;
  return t as StitchTables;
}

/**
 * The pack may be played next to the coach's other recorded lines: same voice (`coachTag`: the voiceTag of the
 * recorded sets the API gave this browser, unknown before they load).
 */
export const sameVoice = (pack: Pack, coachTag: string | null | undefined) => !coachTag || pack.header.voiceTag === coachTag;

/** A line's stitched clip ids from a loaded pack, or null (a word without a clip). */
export function stitchIds(pack: Pack, text: string): string[] | null {
  const t = tablesOf(pack);
  if (!t || !text) return null;
  const ids = stitchWith(text, pack.header.lang, t);
  if (!ids) return null;
  // Every clip must be in this pack (numbers are built by rule).
  return ids.every((id) => id === "." || id === "," || pack.header.clips[id]) ? ids : null;
}

/** A line as one WAV from a loaded pack, or null. */
export function stitchLine(pack: Pack, text: string): Uint8Array | null {
  const ids = stitchIds(pack, text);
  return ids ? stitchedWav(pack, ids) : null;
}

// ── The loader ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface PackStore {
  /** The kept pack's description for `lang` in the chosen voice (kept per voice slot), or null. */
  kept(lang: StitchLang): Promise<KeptPack | null>;
  /** The kept pack's bytes (by its URL), or null. */
  bytes(url: string): Promise<Uint8Array | null>;
  /** Keeps a new pack (and its description), dropping the language's older one. */
  keep(meta: KeptPack, bytes: Uint8Array, old: KeptPack | null): Promise<void>;
  /** Forgets the language's pack (unreadable, or in another voice). */
  forget(meta: KeptPack): Promise<void>;
}

export interface PackDeps {
  apiUrl: string;
  /** GET /v1/voice/stitch?lang=&voice= (the chosen voice) or null (offline, error). */
  info(lang: StitchLang): Promise<StitchInfo | null>;
  /** The pack's bytes from the network, or null. */
  download(url: string): Promise<Uint8Array | null>;
  store: PackStore;
  online(): boolean;
}

/**
 * The pack for `lang`: the kept one (read from Cache Storage) unless the API has a newer version, which is downloaded
 * and kept. Null when there is none yet (still rendering, offline with nothing kept).
 */
export async function loadPack(lang: StitchLang, d: PackDeps): Promise<Pack | null> {
  const kept = await d.store.kept(lang).catch(() => null);
  const info = d.online() ? await d.info(lang).catch(() => null) : null;
  const plan = planPack(info, kept, d.apiUrl);
  const readKept = async () => {
    if (!kept) return null;
    const p = readPack((await d.store.bytes(kept.url).catch(() => null)) ?? new Uint8Array());
    if (validPack(p, lang, kept.version)) return p;
    await d.store.forget(kept).catch(() => undefined);
    return null;
  };
  if (plan.kind === "kept") return readKept();
  if (plan.kind === "none") {
    // Another voice now: the kept pack is dropped.
    if (kept && info?.voiceTag && kept.voiceTag !== info.voiceTag) await d.store.forget(kept).catch(() => undefined);
    return null;
  }
  const bytes = await d.download(plan.url).catch(() => null);
  const p = bytes ? readPack(bytes) : null;
  if (!bytes || !validPack(p, lang, plan.version)) return readKept();
  await d.store
    .keep({ lang, version: plan.version, voiceTag: p.header.voiceTag || plan.voiceTag, url: plan.url }, bytes, kept)
    .catch(() => undefined);
  return p;
}

/** How long a failed (or not yet rendered) load waits before the next try this visit. */
export const RETRY_MS = 10 * 60_000;
