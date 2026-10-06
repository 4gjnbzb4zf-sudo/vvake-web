import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import data from "@/data/voice-commands.json";
import { groupVoiceCommands, voiceCommands, voiceCommandsSchema, voiceTeaser } from "./voiceCommands";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = process.env.VVFIT_DIR
  ? resolve(process.env.VVFIT_DIR, "docs/05-tech/voice-commands.json")
  : resolve(ROOT, "../VVFit/docs/05-tech/voice-commands.json");

describe("voice commands export", () => {
  it("matches the schema", () => {
    expect(voiceCommandsSchema.safeParse(data).success).toBe(true);
  });

  it("puts every command in a known category and every category has commands", () => {
    const keys = voiceCommands.categories.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of voiceCommands.commands) expect(keys).toContain(c.category);
    for (const k of keys) expect(voiceCommands.commands.some((c) => c.category === k)).toBe(true);
    const intents = voiceCommands.commands.map((c) => c.intent);
    expect(new Set(intents).size).toBe(intents.length);
  });

  it("renders exactly the export's commands and examples, categories in order", () => {
    const groups = groupVoiceCommands();
    expect(groups.map((g) => g.category.key)).toEqual(voiceCommands.categories.map((c) => c.key));
    const rendered = groups.flatMap((g) => g.commands);
    expect(rendered.map((c) => c.intent).sort()).toEqual(voiceCommands.commands.map((c) => c.intent).sort());
    const examples = (list: typeof rendered) => list.flatMap((c) => [...c.examples.en, ...c.examples.fr]).sort();
    expect(examples(rendered)).toEqual(examples(voiceCommands.commands));
    for (const g of groups) for (const c of g.commands) expect(c.category).toBe(g.category.key);
  });

  it("finds the app page's example phrases in the export", () => {
    for (const lang of ["en", "fr"] as const) {
      const teaser = voiceTeaser(lang);
      expect(teaser).toHaveLength(2);
      for (const e of teaser) expect(voiceCommands.commands.some((c) => c.examples[lang].includes(e))).toBe(true);
    }
  });
});

describe.skipIf(!existsSync(SOURCE))(
  `voice commands match the VVFit export (${SOURCE}; skipped when absent: set VVFIT_DIR to the VVFit repo)`,
  () => {
    it("is an unedited copy of docs/05-tech/voice-commands.json", () => {
      expect(data).toEqual(JSON.parse(readFileSync(SOURCE, "utf8")));
    });
  },
);
