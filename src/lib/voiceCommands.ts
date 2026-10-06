import { z } from "zod";
import data from "@/data/voice-commands.json";
import type { Locale } from "@/i18n/config";

/**
 * The app's voice commands, as exported by the VVFit monorepo (packages/game-core/scripts/export-voice-commands.ts
 * rewrites src/data/voice-commands.json; never edit it by hand). Checked here so a bad export fails the build.
 */
const text = z.object({ en: z.string().min(1), fr: z.string().min(1) });

export const voiceCommandsSchema = z.object({
  version: z.number().int().positive(),
  categories: z.array(z.object({ key: z.string().min(1), title: text })).min(1),
  commands: z
    .array(
      z.object({
        intent: z.string().min(1),
        category: z.string().min(1),
        title: text,
        detail: text,
        examples: z.object({ en: z.array(z.string().min(1)).min(1), fr: z.array(z.string().min(1)).min(1) }),
        confirm: z.boolean(),
        phone: z.boolean(),
        watch: z.boolean(),
        inWorkout: z.boolean().optional(),
      }),
    )
    .min(1),
  /** Ways of speaking that work with every command (say the name or not, chain several commands). Required. */
  tips: z
    .array(
      z.object({
        key: z.string().min(1),
        title: text,
        detail: text,
        examples: z.object({ en: z.array(z.string().min(1)).min(1), fr: z.array(z.string().min(1)).min(1) }),
      }),
    )
    .min(1),
});

export type VoiceCommands = z.infer<typeof voiceCommandsSchema>;
export type VoiceCommand = VoiceCommands["commands"][number];
export type VoiceCategory = VoiceCommands["categories"][number];
export type VoiceTip = VoiceCommands["tips"][number];
export interface VoiceGroup {
  category: VoiceCategory;
  commands: VoiceCommand[];
}

export const voiceCommands: VoiceCommands = voiceCommandsSchema.parse(data);

/** Commands grouped by category, categories in the export's order, commands in the export's order within each. */
export function groupVoiceCommands(list: VoiceCommands = voiceCommands): VoiceGroup[] {
  return list.categories
    .map((category) => ({ category, commands: list.commands.filter((c) => c.category === category.key) }))
    .filter((g) => g.commands.length > 0);
}

/** The speaking tips, in the export's order. */
export function voiceTips(list: VoiceCommands = voiceCommands): VoiceTip[] {
  return list.tips;
}

/** The other language, for the secondary example phrases. */
export const otherLocale = (locale: Locale): Locale => (locale === "en" ? "fr" : "en");

/** A spoken phrase in the language's quotation marks. */
export const quote = (phrase: string, locale: Locale) => (locale === "fr" ? `«\u00a0${phrase}\u00a0»` : `“${phrase}”`);

/** The first example phrase of a few commands, for the short voice block on the app page. */
export function voiceTeaser(locale: Locale, intents: readonly string[] = ["workout.start", "music.next"]): string[] {
  return intents.flatMap((i) => voiceCommands.commands.find((c) => c.intent === i)?.examples[locale].slice(0, 1) ?? []);
}
