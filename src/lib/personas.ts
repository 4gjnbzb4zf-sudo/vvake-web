import type { VVakerSport } from "@/components/vvaker/traits";

/**
 * VVake Fit personas: photoreal animal athletes rendered with Grok Imagine from the master prompt in
 * VVFit/tools/imagine (style-prompt.md), cut out to transparent WebP in /public/personas.
 * One per sport; the persona generator builds the exact prompt for a player's own combination.
 */
export const PERSONAS: Record<VVakerSport, { animal: string; w: number; h: number }> = {
  runner: { animal: "cheetah", w: 427, h: 900 },
  walker: { animal: "golden retriever", w: 402, h: 900 },
  cyclist: { animal: "greyhound", w: 544, h: 900 },
  lifter: { animal: "gorilla", w: 518, h: 900 },
  boxer: { animal: "elephant", w: 599, h: 900 },
  yogi: { animal: "flamingo", w: 415, h: 900 },
  baller: { animal: "tabby cat", w: 427, h: 900 },
  coder: { animal: "raccoon", w: 506, h: 900 },
  martial: { animal: "giant panda", w: 592, h: 900 },
  paddler: { animal: "eagle", w: 687, h: 900 },
  meditator: { animal: "snowy owl", w: 605, h: 900 },
  roller: { animal: "red fox", w: 542, h: 900 },
  skater: { animal: "arctic fox", w: 564, h: 900 },
  swimmer: { animal: "otter", w: 385, h: 900 },
  hiker: { animal: "grizzly bear", w: 567, h: 900 },
  climber: { animal: "snow leopard", w: 513, h: 900 },
  racket: { animal: "hare", w: 540, h: 900 },
  dancer: { animal: "zebra", w: 674, h: 900 },
  skier: { animal: "husky", w: 610, h: 900 },
  footballer: { animal: "lion", w: 470, h: 900 },
};

export const personaSrc = (sport: VVakerSport) => `/personas/${sport}.webp`;

/** Characters that shine big in the hero (one is picked at each page load). */
export const HERO_PERSONAS: readonly VVakerSport[] = ["baller", "runner", "footballer", "racket", "roller", "walker", "coder", "lifter"];
