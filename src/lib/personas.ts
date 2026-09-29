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

/** Characters that shine big in the hero (one is picked at each page load). */
export const HERO_PERSONAS: readonly VVakerSport[] = ["baller", "runner", "footballer", "racket", "roller", "walker", "coder", "lifter"];
