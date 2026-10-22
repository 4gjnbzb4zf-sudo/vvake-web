import { describe, expect, it } from "vitest";
import golden from "../fixtures/stitch-golden.json";
import { numberIds, stitchWith, type StitchLang, type StitchTables } from "./stitchCore";
import { adpcmDecode, joinClips, readPack, stitchedWav, wavBytes, type JoinPart } from "./voiceAudio";

/**
 * The web stitches what the phone and the watches stitch: the golden cases game-core writes for the watches
 * (VVFit packages/game-core/test/fixtures/stitch-golden.json, copied by scripts/sync-stitch-core.ts). The lines' ids
 * were computed with the full pack's tables; the golden `tables` are the watch pack's, so a line whose clips aren't
 * all in it gives null (the monorepo's stitchVoice.test.ts "stitchWith a pack's tables").
 */
const LANGS: StitchLang[] = ["en", "fr"];
const tables = (lang: StitchLang) => golden.tables[lang] as unknown as StitchTables;
/** Number clips are built by rule (stitchCore numId), not looked up in the tables. */
const byRule = (id: string) => /^(n|h|hx|k|hr)\./.test(id) || id === "oh" || id === "pt" || id === "." || id === ",";

describe("stitch parity with game-core", () => {
  it("numbers give the same clip ids", () => {
    for (const lang of LANGS)
      for (const c of golden.numbers[lang]) expect(numberIds(c.n, lang, c.final, c.fem), `${lang} ${c.n}`).toEqual(c.ids);
  });

  it("lines give the golden ids with the watch pack's tables, or null when a clip isn't in it", () => {
    let whole = 0;
    for (const lang of LANGS) {
      const t = tables(lang);
      const inPack = new Set(Object.values(t.phrases));
      for (const { text, ids } of golden.lines[lang]) {
        const got = stitchWith(text, lang, t);
        const reachable = !!ids && ids.every((id) => byRule(id) || inPack.has(id));
        expect(got, `${lang}: ${text}`).toEqual(reachable ? ids : null);
        if (reachable) whole++;
      }
    }
    // The watch pack covers the workout lines: most golden lines stitch whole.
    expect(whole).toBeGreaterThan(10);
  });

  it("decodes the ADPCM vector sample for sample", () => {
    const bytes = Uint8Array.from(Buffer.from(golden.adpcm.bytes, "base64"));
    expect(Array.from(adpcmDecode(bytes, golden.adpcm.samples))).toEqual(golden.adpcm.decoded);
  });

  it("joins clips with the same crossfade and pause", () => {
    const a = Int16Array.from(golden.adpcm.decoded);
    const part = (p: string): JoinPart => {
      if (p === "." || p === ",") return p;
      const [from, to] = p.split("-").map(Number);
      return a.subarray(from, to);
    };
    const joined = joinClips(golden.join.parts.map(part), golden.join.rate);
    expect(joined.length).toBe(golden.join.length);
    expect(Array.from(joined.subarray(190, 215))).toEqual(golden.join.head);
    expect(Array.from(joined.subarray(joined.length - 20))).toEqual(golden.join.tail);
  });

  it("a WAV is RIFF PCM at the pack's rate; a pack that isn't one reads as null", () => {
    const w = wavBytes(new Int16Array(10), 22050);
    expect(String.fromCharCode(...w.subarray(0, 4))).toBe("RIFF");
    expect(new DataView(w.buffer).getUint32(24, true)).toBe(22050);
    expect(readPack(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readPack(new TextEncoder().encode("VVS1xxxx"))).toBeNull();
    const fake = {
      header: { v: 1, lang: "en", version: "x", kind: "full", rate: 22050, codec: "ima-adpcm", voiceTag: "t", clips: {} },
      data: new Uint8Array(),
    } as const;
    expect(stitchedWav(fake as never, ["n.3.m"])).toBeNull();
  });
});
