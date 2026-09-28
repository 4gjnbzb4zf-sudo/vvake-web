/** Body colors: pastel voxel bodies. */
export const VVAKER_COLORS = {
  candy: "#f7a8c8",
  lilac: "#b9a7f5",
  butter: "#f5e27a",
  mint: "#7fe0c8",
  sky: "#7fb6f5",
  olive: "#b8b07a",
  coral: "#ff9f7a",
  slate: "#aab4c0",
} as const;

/** Gear colors: headband, cap, headphone cups, shoe soles, bib trim. */
export const VVAKER_ACCENTS = {
  pulse: "#ff3d6e",
  volt: "#ccff00",
  calm: "#8b87d9",
  ocean: "#3d8bff",
  snow: "#eef0f2",
  flame: "#ff8a3d",
} as const;

/** Export backgrounds for PNG avatars and banners. */
export const VVAKER_BACKGROUNDS = {
  night: "#0e1012",
  pulse: "#ff3d6e",
  volt: "#ccff00",
  lilac: "#b9a7f5",
  sky: "#7fb6f5",
  cream: "#f1ead9",
} as const;

export const VVAKER_SPORTS = ["runner", "walker", "lifter", "cyclist", "boxer", "yogi", "baller", "coder"] as const;
export const VVAKER_HEADGEARS = ["none", "cap", "beanie", "headphones", "helmet"] as const;
export const VVAKER_EYES = ["pixel", "happy", "fired", "sleepy", "visor", "star"] as const;
export const VVAKER_MOUTHS = ["smile", "grin", "calm", "o", "teeth"] as const;
export const VVAKER_ACCESSORIES = ["none", "medal", "towel", "bib"] as const;

export type VVakerColor = keyof typeof VVAKER_COLORS;
export type VVakerAccent = keyof typeof VVAKER_ACCENTS;
export type VVakerBackground = keyof typeof VVAKER_BACKGROUNDS;
export type VVakerSport = (typeof VVAKER_SPORTS)[number];
export type VVakerHeadgear = (typeof VVAKER_HEADGEARS)[number];
export type VVakerEyes = (typeof VVAKER_EYES)[number];
export type VVakerMouth = (typeof VVAKER_MOUTHS)[number];
export type VVakerAccessory = (typeof VVAKER_ACCESSORIES)[number];

export interface VVakerTraits {
  color: VVakerColor;
  accent: VVakerAccent;
  sport: VVakerSport;
  headgear: VVakerHeadgear;
  eyes: VVakerEyes;
  mouth: VVakerMouth;
  accessory: VVakerAccessory;
  /** Race-bib number shown when `accessory` is "bib" (0–99). */
  bib: number;
  /** Filled segments of the energy bar, 0–4. */
  energy: number;
}

export const DEFAULT_TRAITS: VVakerTraits = {
  color: "candy",
  accent: "pulse",
  sport: "runner",
  headgear: "none",
  eyes: "pixel",
  mouth: "smile",
  accessory: "none",
  bib: 7,
  energy: 3,
};

export function clampBib(value: number): number {
  return Number.isFinite(value) ? Math.min(99, Math.max(0, Math.round(value))) : 0;
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function randomTraits(random: () => number = Math.random): VVakerTraits {
  return {
    color: pick(Object.keys(VVAKER_COLORS) as VVakerColor[], random),
    accent: pick(Object.keys(VVAKER_ACCENTS) as VVakerAccent[], random),
    sport: pick(VVAKER_SPORTS, random),
    headgear: pick(VVAKER_HEADGEARS, random),
    eyes: pick(VVAKER_EYES, random),
    mouth: pick(VVAKER_MOUTHS, random),
    accessory: pick(VVAKER_ACCESSORIES, random),
    bib: Math.floor(random() * 100),
    energy: 1 + Math.floor(random() * 4),
  };
}
