import { describe, expect, it } from "vitest";
import { clipKey, metaKey } from "@/lib/webapp/coachAudio";
import { voiceQ } from "@/lib/webapp/api";
import {
  COACH_VOICE_SLOTS,
  coachVoiceGender,
  coachVoiceProfile,
  coachVoiceSlot,
  coachVoicesSchema,
  DEFAULT_COACH_VOICE_GENDER,
  previewPath,
} from "./coachVoices";

describe("coach voices (ADR-0056, game-core coachVoices.ts)", () => {
  it("anything stored reads as woman or man, a woman's voice when never chosen", () => {
    expect(DEFAULT_COACH_VOICE_GENDER).toBe("woman");
    expect(coachVoiceGender("man")).toBe("man");
    expect(coachVoiceGender("woman")).toBe("woman");
    expect(coachVoiceGender(undefined)).toBe("woman");
    expect(coachVoiceGender(null)).toBe("woman");
    expect(coachVoiceGender("male")).toBe("woman");
  });

  it("the language and the choice give the slot, as the API and the phone name them", () => {
    expect(coachVoiceSlot("fr", "man")).toBe("fr-man");
    expect(coachVoiceSlot("en", undefined)).toBe("en-woman");
    expect(coachVoiceSlot("de", "man")).toBe("en-man");
    expect(new Set(COACH_VOICE_SLOTS).size).toBe(4);
  });

  it("the browser voice standing in prefers the chosen gender", () => {
    expect(coachVoiceProfile("man").gender).toBe("male");
    expect(coachVoiceProfile("woman").gender).toBe("female");
    expect(coachVoiceProfile(undefined)).toEqual({ gender: "female", locale: { en: "en-US", fr: "fr-FR" } });
  });

  it("every voice fetch names the language and the voice", () => {
    expect(voiceQ("fr", "man")).toBe("lang=fr&voice=man");
    expect(voiceQ("en", undefined)).toBe("lang=en&voice=woman");
  });

  it("what this browser keeps is per voice: a switch never plays the other voice's clips", () => {
    const api = "https://api.example";
    const p = "/v1/voice/0123456789abcdef0123456789abcdef.mp3";
    expect(clipKey(api, "en-woman", p)).not.toBe(clipKey(api, "en-man", p));
    expect(clipKey(api, "fr-man", p)).toBe(`${api}/v1/voice/__clip/fr-man${p}`);
    expect(metaKey(api, "fr-man")).not.toBe(metaKey(api, "fr-woman"));
  });

  it("'Hear it' takes each voice's preview path (relative or absolute), none when the API has none", () => {
    const list = coachVoicesSchema.parse({
      lang: "fr",
      voices: [
        { lang: "fr", gender: "woman", slot: "fr-woman", tag: "aaaaaaaaaaaa", preview: { text: "Salut", url: "/v1/voice/a.mp3" } },
        {
          lang: "fr",
          gender: "man",
          slot: "fr-man",
          tag: "bbbbbbbbbbbb",
          preview: { text: "Salut", url: "https://api.example/v1/voice/b.mp3" },
        },
      ],
    });
    expect(previewPath(list, "woman")).toBe("/v1/voice/a.mp3");
    expect(previewPath(list, "man")).toBe("/v1/voice/b.mp3");
    expect(previewPath({ voices: [{ gender: "man", preview: null }] }, "man")).toBeNull();
    expect(previewPath(null, "woman")).toBeNull();
  });
});
