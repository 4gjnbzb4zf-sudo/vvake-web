import type { VVakerSport } from "@/components/vvaker/traits";

/**
 * VVake Fit personas: photoreal animal athletes rendered with Grok Imagine from the master prompt in
 * VVFit/tools/imagine (style-prompt.md), cut out to transparent WebP in /public/personas.
 * One per sport; the persona generator builds the exact prompt for a player's own combination.
 */
export const PERSONAS: Record<VVakerSport, { animal: string; w: number; h: number }> = {
  runner: { animal: "cheetah", w: 410, h: 900 },
  walker: { animal: "golden retriever", w: 406, h: 900 },
  cyclist: { animal: "greyhound", w: 543, h: 900 },
  lifter: { animal: "gorilla", w: 521, h: 900 },
  boxer: { animal: "elephant", w: 501, h: 900 },
  yogi: { animal: "flamingo", w: 416, h: 900 },
  baller: { animal: "tabby cat", w: 473, h: 900 },
  coder: { animal: "raccoon", w: 512, h: 900 },
  martial: { animal: "giant panda", w: 558, h: 900 },
  paddler: { animal: "eagle", w: 684, h: 900 },
  meditator: { animal: "snowy owl", w: 649, h: 900 },
  roller: { animal: "red fox", w: 547, h: 900 },
  skater: { animal: "arctic fox", w: 568, h: 900 },
  swimmer: { animal: "otter", w: 385, h: 900 },
  hiker: { animal: "grizzly bear", w: 503, h: 900 },
  climber: { animal: "snow leopard", w: 515, h: 900 },
  racket: { animal: "hare", w: 475, h: 900 },
  dancer: { animal: "zebra", w: 674, h: 900 },
  skier: { animal: "husky", w: 619, h: 900 },
  footballer: { animal: "lion", w: 449, h: 900 },
};

export const personaSrc = (sport: VVakerSport) => `/personas/${sport}.webp`;

/** Women of the cast (same pipeline, VVFit/tools/imagine personas.json ids ending in "-f"). */
export const FEMALE_PERSONAS = {
  "runner-f": { sport: "runner", animal: "cheetah", w: 472, h: 900 },
  "boxer-f": { sport: "boxer", animal: "tigress", w: 537, h: 900 },
  "climber-f": { sport: "climber", animal: "snow leopard", w: 397, h: 900 },
  "footballer-f": { sport: "footballer", animal: "lioness", w: 389, h: 900 },
  "lifter-f": { sport: "lifter", animal: "wolf", w: 500, h: 900 },
} as const satisfies Record<string, { sport: VVakerSport; animal: string; w: number; h: number }>;
export type FemalePersona = keyof typeof FEMALE_PERSONAS;

/** Any cast image: a sport (the men's cast) or a woman's id. */
export type CastId = VVakerSport | FemalePersona;
export function castImage(id: CastId): { src: string; w: number; h: number; animal: string } {
  const f = (FEMALE_PERSONAS as Record<string, { animal: string; w: number; h: number }>)[id];
  const p = f ?? PERSONAS[id as VVakerSport];
  return { src: `/personas/${id}.webp`, w: p.w, h: p.h, animal: p.animal };
}

/** The hero shows a woman and a man side by side; one pair is picked at each page load. */
export const HERO_PAIRS: readonly (readonly [FemalePersona, VVakerSport])[] = [
  ["runner-f", "baller"],
  ["footballer-f", "footballer"],
  ["boxer-f", "runner"],
  ["lifter-f", "walker"],
  ["climber-f", "racket"],
];
