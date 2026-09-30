import type { VVakerSport } from "@/components/vvaker/traits";

/**
 * VVake Fit personas: photoreal animal athletes rendered with Grok Imagine from the master prompt in
 * VVFit/tools/imagine (style-prompt.md), cut out to transparent WebP in /public/personas.
 * One per sport; the persona generator builds the exact prompt for a player's own combination.
 */
export const PERSONAS: Record<VVakerSport, { animal: string; w: number; h: number }> = {
  runner: { animal: "cheetah", w: 411, h: 900 },
  walker: { animal: "golden retriever", w: 405, h: 900 },
  cyclist: { animal: "greyhound", w: 542, h: 900 },
  lifter: { animal: "gorilla", w: 521, h: 900 },
  boxer: { animal: "elephant", w: 501, h: 900 },
  yogi: { animal: "flamingo", w: 415, h: 900 },
  baller: { animal: "tabby cat", w: 472, h: 900 },
  coder: { animal: "raccoon", w: 512, h: 900 },
  martial: { animal: "giant panda", w: 559, h: 900 },
  paddler: { animal: "eagle", w: 686, h: 900 },
  meditator: { animal: "snowy owl", w: 647, h: 900 },
  roller: { animal: "red fox", w: 545, h: 900 },
  skater: { animal: "arctic fox", w: 566, h: 900 },
  swimmer: { animal: "otter", w: 384, h: 900 },
  hiker: { animal: "grizzly bear", w: 503, h: 900 },
  climber: { animal: "snow leopard", w: 515, h: 900 },
  racket: { animal: "hare", w: 475, h: 900 },
  dancer: { animal: "zebra", w: 673, h: 900 },
  skier: { animal: "husky", w: 618, h: 900 },
  footballer: { animal: "lion", w: 447, h: 900 },
};

export const personaSrc = (sport: VVakerSport) => `/personas/${sport}.webp`;

/** Women of the cast (same pipeline, VVFit/tools/imagine personas.json ids ending in "-f"). */
export const FEMALE_PERSONAS = {
  "runner-f": { sport: "runner", animal: "cheetah", w: 472, h: 900 },
  "boxer-f": { sport: "boxer", animal: "tigress", w: 537, h: 900 },
  "climber-f": { sport: "climber", animal: "snow leopard", w: 397, h: 900 },
  "footballer-f": { sport: "footballer", animal: "lioness", w: 389, h: 900 },
  "lifter-f": { sport: "lifter", animal: "wolf", w: 501, h: 900 },
  "skater-f": { sport: "skater", animal: "arctic fox", w: 622, h: 900 },
  "baller-f": { sport: "baller", animal: "kangaroo", w: 435, h: 900 },
  "hiker-f": { sport: "hiker", animal: "grizzly bear", w: 482, h: 900 },
  "walker-f": { sport: "walker", animal: "golden retriever", w: 377, h: 900 },
} as const satisfies Record<string, { sport: VVakerSport; animal: string; w: number; h: number }>;
export type FemalePersona = keyof typeof FEMALE_PERSONAS;

/** Expressive men (faces visible, no sunglasses): same pipeline, ids ending in "-m". */
export const EXTRA_MEN = {
  "runner-m": { sport: "runner", animal: "grey wolf", w: 480, h: 900 },
  "dancer-m": { sport: "dancer", animal: "husky", w: 457, h: 900 },
  "coder-m": { sport: "coder", animal: "penguin", w: 460, h: 900 },
  "boxer-m": { sport: "boxer", animal: "giant panda", w: 609, h: 900 },
} as const satisfies Record<string, { sport: VVakerSport; animal: string; w: number; h: number }>;
export type ExtraMan = keyof typeof EXTRA_MEN;

/** Any cast image: a sport (the men's cast) or a woman's id. */
export type CastId = VVakerSport | FemalePersona | ExtraMan;
export function castImage(id: CastId): { src: string; w: number; h: number; animal: string } {
  const f = ({ ...FEMALE_PERSONAS, ...EXTRA_MEN } as Record<string, { animal: string; w: number; h: number }>)[id];
  const p = f ?? PERSONAS[id as VVakerSport];
  return { src: `/personas/${id}.webp`, w: p.w, h: p.h, animal: p.animal };
}

/** The hero shows a woman and a man side by side, each drawn independently from these at each visit. */
export const HERO_WOMEN = Object.keys(FEMALE_PERSONAS) as FemalePersona[];
export const HERO_MEN: readonly CastId[] = [
  "runner-m",
  "dancer-m",
  "coder-m",
  "boxer-m",
  "baller",
  "footballer",
  "racket",
  "walker",
  "lifter",
  "hiker",
  "roller",
];
