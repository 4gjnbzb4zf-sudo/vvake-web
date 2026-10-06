import { z } from "zod";
import data from "@/data/sports.json";
import type { Locale } from "@/i18n/config";

/**
 * The app's sport catalog, as exported by the VVFit monorepo (packages/game-core/scripts/export-voice-commands.ts
 * --site rewrites src/data/sports.json; never edit it by hand): every Apple Fitness workout, EN/FR names, the
 * category each sits in. Checked here so a bad export fails the build.
 */
const text = z.object({ en: z.string().min(1), fr: z.string().min(1) });

export const sportsSchema = z
  .object({
    count: z.number().int().positive(),
    categories: z.array(z.object({ key: z.string().min(1), name: text })).min(1),
    sports: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
          name: text,
          icon: z.string().min(1),
          category: z.string().min(1),
          gps: z.boolean(),
          distance: z.boolean(),
        }),
      )
      .min(1),
    custom: z.object({ max: z.number().int().positive(), tracking: z.array(z.enum(["hr", "gps"])).min(1) }),
  })
  .refine((d) => d.count === d.sports.length, "count must match the list");

export type Sports = z.infer<typeof sportsSchema>;
export type Sport = Sports["sports"][number];

export const sports: Sports = sportsSchema.parse(data);

/** Sport names grouped by category, categories in the export's order, names in the visitor's language. */
export function sportGroups(locale: Locale, list: Sports = sports): { key: string; title: string; names: string[] }[] {
  return list.categories
    .map((c) => ({
      key: c.key,
      title: c.name[locale],
      names: list.sports.filter((s) => s.category === c.key).map((s) => s.name[locale]),
    }))
    .filter((g) => g.names.length > 0);
}
