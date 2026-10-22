import { describe, expect, it } from "vitest";
import golden from "../fixtures/stitch-golden.json";
import {
  absolute,
  loadPack,
  planPack,
  sameVoice,
  stitchIds,
  stitchLine,
  type KeptPack,
  type PackDeps,
  type StitchInfo,
} from "./stitchPack";
import { adpcmEncode, readPack, writePack } from "./voiceAudio";

const API = "https://api.example";

const info = (o: Partial<StitchInfo> = {}): StitchInfo => ({
  lang: "en",
  ready: true,
  version: "v2",
  voiceTag: "tagA",
  full: { url: "/v1/voice/stitch/en/v2/full.vvs", bytes: 100 },
  ...o,
});
const kept = (o: Partial<KeptPack> = {}): KeptPack => ({
  lang: "en",
  version: "v2",
  voiceTag: "tagA",
  url: `${API}/v1/voice/stitch/en/v2/full.vvs`,
  ...o,
});

describe("which pack to use", () => {
  it("nothing kept and the pack ready: download it (its URL is relative to the API)", () => {
    expect(planPack(info(), null, API)).toEqual({
      kind: "fetch",
      url: `${API}/v1/voice/stitch/en/v2/full.vvs`,
      version: "v2",
      voiceTag: "tagA",
    });
  });
  it("the kept pack is the current version: no download", () => {
    expect(planPack(info(), kept(), API)).toEqual({ kind: "kept" });
  });
  it("another version is ready: download it", () => {
    expect(planPack(info({ version: "v3", full: { url: "/v1/voice/stitch/en/v3/full.vvs", bytes: 1 } }), kept(), API).kind).toBe("fetch");
  });
  it("offline or the API can't be asked: the kept pack, else none", () => {
    expect(planPack(null, kept(), API)).toEqual({ kind: "kept" });
    expect(planPack(null, null, API)).toEqual({ kind: "none" });
  });
  it("still rendering: the kept pack, else none (asked again later)", () => {
    const rendering = info({ ready: false, version: null, full: null });
    expect(planPack(rendering, kept({ version: "v1" }), API)).toEqual({ kind: "kept" });
    expect(planPack(rendering, null, API)).toEqual({ kind: "none" });
  });
  it("the coach's voice changed: the kept pack is never used", () => {
    expect(planPack(info({ ready: false, full: null, voiceTag: "tagB" }), kept(), API)).toEqual({ kind: "none" });
    expect(planPack(info({ voiceTag: "tagB" }), kept(), API).kind).toBe("fetch");
  });
  it("absolute URLs", () => {
    expect(absolute("/v1/x", `${API}/`)).toBe(`${API}/v1/x`);
    expect(absolute("https://cdn.example/x", API)).toBe("https://cdn.example/x");
  });
});

/** A small real pack: the clips the golden line "3 kilometres. Time 15:32. Keep moving." needs, with the golden tables. */
function tinyPack(version = "v2", voiceTag = "tagA") {
  const line = golden.lines.en[0]!;
  const clips = new Map<string, { bytes: Uint8Array; samples: number }>();
  for (const id of line.ids ?? []) {
    if (id === "." || id === ",") continue;
    const pcm = new Int16Array(441).map((_, i) => Math.round(4000 * Math.sin(i / 7)));
    clips.set(id, { bytes: adpcmEncode(pcm), samples: pcm.length });
  }
  const tables = golden.tables.en;
  const bytes = writePack({ v: 1, lang: "en", version, kind: "full", rate: 22050, codec: "ima-adpcm", voiceTag, tables }, clips);
  return { bytes, line };
}

function deps(o: {
  info?: StitchInfo | null;
  kept?: KeptPack | null;
  stored?: Uint8Array | null;
  download?: Uint8Array | null;
  online?: boolean;
}) {
  const calls: string[] = [];
  const d: PackDeps = {
    apiUrl: API,
    online: () => o.online ?? true,
    info: async () => (calls.push("info"), o.info ?? null),
    download: async (url) => (calls.push(`download ${url}`), o.download ?? null),
    store: {
      kept: async () => o.kept ?? null,
      bytes: async () => (calls.push("read"), o.stored ?? null),
      keep: async (m) => void calls.push(`keep ${m.version}`),
      forget: async (m) => void calls.push(`forget ${m.version}`),
    },
  };
  return { d, calls };
}

describe("loading the pack", () => {
  it("first time: downloaded once and kept", async () => {
    const { bytes } = tinyPack();
    const { d, calls } = deps({ info: info(), download: bytes });
    const p = await loadPack("en", d);
    expect(p?.header.version).toBe("v2");
    expect(calls).toEqual(["info", `download ${API}/v1/voice/stitch/en/v2/full.vvs`, "keep v2"]);
  });
  it("next visit, same version: read from the cache, no download", async () => {
    const { bytes } = tinyPack();
    const { d, calls } = deps({ info: info(), kept: kept(), stored: bytes });
    expect((await loadPack("en", d))?.header.version).toBe("v2");
    expect(calls).toEqual(["info", "read"]);
  });
  it("offline: the kept pack, the API isn't asked", async () => {
    const { bytes } = tinyPack();
    const { d, calls } = deps({ kept: kept(), stored: bytes, online: false });
    expect(await loadPack("en", d)).not.toBeNull();
    expect(calls).toEqual(["read"]);
  });
  it("a download that isn't the pack asked for (cut short, another version) is not kept: the old one stays", async () => {
    const { bytes } = tinyPack("v1");
    const { bytes: other } = tinyPack("v9");
    const { d, calls } = deps({ info: info({ version: "v3" }), kept: kept({ version: "v1" }), stored: bytes, download: other });
    expect((await loadPack("en", d))?.header.version).toBe("v1");
    expect(calls).not.toContain("keep v9");
  });
  it("an unreadable kept pack is forgotten", async () => {
    const { d, calls } = deps({ kept: kept(), stored: new Uint8Array([1, 2, 3]), online: false });
    expect(await loadPack("en", d)).toBeNull();
    expect(calls).toContain("forget v2");
  });
});

describe("stitching with a loaded pack", () => {
  it("a line whose clips are all in the pack becomes one WAV", () => {
    const { bytes, line } = tinyPack();
    const p = readPack(bytes)!;
    expect(stitchIds(p, line.text)).toEqual(line.ids);
    const wav = stitchLine(p, line.text)!;
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe("RIFF");
  });
  it("a word without a clip: null (the browser voice says it)", () => {
    const p = readPack(tinyPack().bytes)!;
    expect(stitchIds(p, "4 kilometres. Time 15:32. Keep moving.")).toBeNull();
    expect(stitchIds(p, "Hello there")).toBeNull();
  });
  it("only in the coach's voice the recorded lines use", () => {
    const p = readPack(tinyPack().bytes)!;
    expect(sameVoice(p, null)).toBe(true);
    expect(sameVoice(p, "tagA")).toBe(true);
    expect(sameVoice(p, "tagB")).toBe(false);
  });
});
