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

/**
 * Fan kits: unofficial team *colors* (scarf + jersey stripe), labelled by city and sport, never club logos
 * or names (C15). Official club kits need a licence. Not part of the DNA: fans pledge per season.
 */
export const FAN_KITS = {
  none: null,
  "montreal-hockey": ["#af1e2d", "#192168"],
  "toronto-hockey": ["#00205b", "#ffffff"],
  "calgary-hockey": ["#c8102e", "#f1be48"],
  "edmonton-hockey": ["#041e42", "#ff4c00"],
  "paris-football": ["#004170", "#da291c"],
  "marseille-football": ["#2faee0", "#ffffff"],
  "lyon-football": ["#ffffff", "#1b3f8b"],
  "toulouse-rugby": ["#e30613", "#111111"],
  "boston-baseball": ["#bd3039", "#0c2340"],
  "new-york-baseball": ["#0c2340", "#c4ced4"],
  "green-bay-football": ["#203731", "#ffb612"],
} as const satisfies Record<string, readonly [string, string] | null>;

export type FanKit = keyof typeof FAN_KITS;

/** Append-only (order is part of the DNA format). */
export const VVAKER_SPORTS = [
  "runner",
  "walker",
  "lifter",
  "cyclist",
  "boxer",
  "yogi",
  "baller",
  "coder",
  "martial",
  "paddler",
  "meditator",
  "roller",
  "skater",
  "swimmer",
  "hiker",
  "climber",
  "racket",
  "dancer",
  "skier",
  "footballer",
] as const;
/** Visual style (ADR-0017). Appended to the DNA as an optional suffix: Toy codes never change. */
export const VVAKER_LOOKS = ["toy", "athlete-a", "athlete-b"] as const;
/** Personal style (ADR-0018), appended to the DNA; the first value of each is the default. */
export const VVAKER_HAIRS = ["auto", "bald", "crop", "buzz", "mohawk", "ponytail", "bun", "afro", "braids", "long"] as const;
export const VVAKER_FACIALS = ["none", "stubble", "beard", "goatee", "mustache"] as const;
export const VVAKER_TATTOOS = ["none", "sleeve", "tribal", "ecg", "flames", "face-star"] as const;
export const VVAKER_PIERCINGS = ["none", "ear", "nose", "eyebrow", "lip"] as const;
export const VVAKER_SCARS = ["none", "brow", "cheek"] as const;
export const VVAKER_PHYSIQUES = ["regular", "slim", "chubby", "muscular"] as const;
/** Eye colors (pupils, and eye lines when not dark). */
export const VVAKER_EYE_COLORS = {
  dark: "#15181b",
  brown: "#6b3e26",
  blue: "#2f7fd6",
  green: "#2e9a5e",
  hazel: "#8a6a2f",
  grey: "#6b7682",
  amber: "#c8841f",
} as const;
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
export type VVakerLook = (typeof VVAKER_LOOKS)[number];
export type VVakerHair = (typeof VVAKER_HAIRS)[number];
export type VVakerFacial = (typeof VVAKER_FACIALS)[number];
export type VVakerTattoo = (typeof VVAKER_TATTOOS)[number];
export type VVakerPiercing = (typeof VVAKER_PIERCINGS)[number];
export type VVakerScar = (typeof VVAKER_SCARS)[number];
export type VVakerPhysique = (typeof VVAKER_PHYSIQUES)[number];
export type VVakerEyeColor = keyof typeof VVAKER_EYE_COLORS;

export interface VVakerTraits {
  color: VVakerColor;
  accent: VVakerAccent;
  sport: VVakerSport;
  headgear: VVakerHeadgear;
  eyes: VVakerEyes;
  mouth: VVakerMouth;
  accessory: VVakerAccessory;
  /** Toy (original) or Athlete build A / B; anyone picks any. */
  look: VVakerLook;
  hair: VVakerHair;
  facial: VVakerFacial;
  tattoo: VVakerTattoo;
  piercing: VVakerPiercing;
  scar: VVakerScar;
  physique: VVakerPhysique;
  eyeColor: VVakerEyeColor;
  /** Race-bib number shown when `accessory` is "bib" (0–99). */
  bib: number;
  /** Filled segments of the energy bar, 0–4. */
  energy: number;
  /** Seasonal team-colors kit (not part of the DNA). */
  fan: FanKit;
}

export const DEFAULT_TRAITS: VVakerTraits = {
  color: "candy",
  accent: "pulse",
  sport: "runner",
  headgear: "none",
  eyes: "pixel",
  mouth: "smile",
  accessory: "none",
  look: "toy",
  hair: "auto",
  facial: "none",
  tattoo: "none",
  piercing: "none",
  scar: "none",
  physique: "regular",
  eyeColor: "dark",
  bib: 7,
  energy: 3,
  fan: "none",
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
    look: pick(VVAKER_LOOKS, random),
    hair: pick(VVAKER_HAIRS, random),
    facial: random() < 0.3 ? pick(VVAKER_FACIALS, random) : "none",
    tattoo: random() < 0.35 ? pick(VVAKER_TATTOOS, random) : "none",
    piercing: random() < 0.3 ? pick(VVAKER_PIERCINGS, random) : "none",
    scar: random() < 0.15 ? pick(VVAKER_SCARS, random) : "none",
    physique: pick(VVAKER_PHYSIQUES, random),
    eyeColor: pick(Object.keys(VVAKER_EYE_COLORS) as VVakerEyeColor[], random),
    bib: Math.floor(random() * 100),
    energy: 1 + Math.floor(random() * 4),
    fan: random() < 0.4 ? pick(Object.keys(FAN_KITS) as FanKit[], random) : "none",
  };
}

/** Keeps only known trait values (e.g. from saved preferences); anything unknown falls back to the default. */
export function sanitizeTraits(input: unknown): VVakerTraits {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const one = <K extends keyof VVakerTraits>(key: K, allowed: readonly unknown[]): VVakerTraits[K] =>
    (allowed.includes(v[key]) ? v[key] : DEFAULT_TRAITS[key]) as VVakerTraits[K];
  return {
    color: one("color", Object.keys(VVAKER_COLORS)),
    accent: one("accent", Object.keys(VVAKER_ACCENTS)),
    sport: one("sport", VVAKER_SPORTS),
    headgear: one("headgear", VVAKER_HEADGEARS),
    eyes: one("eyes", VVAKER_EYES),
    mouth: one("mouth", VVAKER_MOUTHS),
    accessory: one("accessory", VVAKER_ACCESSORIES),
    look: one("look", VVAKER_LOOKS),
    hair: one("hair", VVAKER_HAIRS),
    facial: one("facial", VVAKER_FACIALS),
    tattoo: one("tattoo", VVAKER_TATTOOS),
    piercing: one("piercing", VVAKER_PIERCINGS),
    scar: one("scar", VVAKER_SCARS),
    physique: one("physique", VVAKER_PHYSIQUES),
    eyeColor: one("eyeColor", Object.keys(VVAKER_EYE_COLORS)),
    bib: clampBib(Number(v.bib)),
    energy: Math.max(0, Math.min(4, Math.round(Number(v.energy) || DEFAULT_TRAITS.energy))),
    fan: one("fan", Object.keys(FAN_KITS)),
  };
}
