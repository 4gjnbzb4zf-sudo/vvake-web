export const VVAKER_COLORS = {
  candy: "#f7a8c8",
  lilac: "#b9a7f5",
  butter: "#f5e27a",
  mint: "#7fe0c8",
  sky: "#7fb6f5",
  olive: "#b8b07a",
} as const;

export type VVakerColor = keyof typeof VVAKER_COLORS;
export const VVAKER_SPORTS = ["runner", "lifter", "coder", "baller", "walker"] as const;
export type VVakerSport = (typeof VVAKER_SPORTS)[number];
export const VVAKER_HEADGEARS = ["none", "cap", "beanie", "headphones"] as const;
export type VVakerHeadgear = (typeof VVAKER_HEADGEARS)[number];
export const VVAKER_MOODS = ["fresh", "fired", "sleepy", "zen"] as const;
export type VVakerMood = (typeof VVAKER_MOODS)[number];

export interface VVakerTraits {
  color: VVakerColor;
  sport: VVakerSport;
  headgear: VVakerHeadgear;
  mood: VVakerMood;
  /** Filled segments of the energy bar, 0–4. */
  energy: number;
}

export const DEFAULT_TRAITS: VVakerTraits = { color: "candy", sport: "runner", headgear: "none", mood: "fresh", energy: 3 };

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function randomTraits(random: () => number = Math.random): VVakerTraits {
  return {
    color: pick(Object.keys(VVAKER_COLORS) as VVakerColor[], random),
    sport: pick(VVAKER_SPORTS, random),
    headgear: pick(VVAKER_HEADGEARS, random),
    mood: pick(VVAKER_MOODS, random),
    energy: 1 + Math.floor(random() * 4),
  };
}
