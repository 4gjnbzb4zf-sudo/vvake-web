import {
  VVAKER_ACCENTS,
  VVAKER_ACCESSORIES,
  VVAKER_BACKGROUNDS,
  VVAKER_COLORS,
  VVAKER_EYES,
  VVAKER_HEADGEARS,
  VVAKER_LOOKS,
  VVAKER_HAIRS,
  VVAKER_FACIALS,
  VVAKER_TATTOOS,
  VVAKER_PIERCINGS,
  VVAKER_SCARS,
  VVAKER_PHYSIQUES,
  VVAKER_EYE_COLORS,
  VVAKER_MOUTHS,
  VVAKER_SPORTS,
  type VVakerBackground,
  type VVakerTraits,
} from "@/components/vvaker/traits";

/**
 * VVaker DNA: mirrors `encodeDna` in the monorepo's packages/game-core/src/vvaker.ts.
 * Trait order is part of the format; `dna.test.ts` pins the shared test vectors.
 */
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function at(list: readonly string[], value: string): string {
  const i = list.indexOf(value);
  if (i < 0) throw new RangeError(`Unknown trait value: ${value}`);
  return B36[i]!;
}

export function encodeDna(t: VVakerTraits, background: VVakerBackground): string {
  const bib = t.accessory === "bib" ? Math.min(99, Math.max(0, Math.round(t.bib))) : 0;
  const a = at(Object.keys(VVAKER_COLORS), t.color) + at(Object.keys(VVAKER_ACCENTS), t.accent) + at(VVAKER_SPORTS, t.sport);
  const b = at(VVAKER_HEADGEARS, t.headgear) + at(VVAKER_EYES, t.eyes) + at(VVAKER_MOUTHS, t.mouth) + at(VVAKER_ACCESSORIES, t.accessory);
  // Shortest canonical form (mirrors game-core): nothing for a plain Toy, one char for a look, eight with any style extra.
  const extras = [
    at(VVAKER_HAIRS, t.hair ?? "auto"),
    at(VVAKER_FACIALS, t.facial ?? "none"),
    at(VVAKER_TATTOOS, t.tattoo ?? "none"),
    at(VVAKER_PIERCINGS, t.piercing ?? "none"),
    at(VVAKER_SCARS, t.scar ?? "none"),
    at(VVAKER_PHYSIQUES, t.physique ?? "regular"),
    at(Object.keys(VVAKER_EYE_COLORS), t.eyeColor ?? "dark"),
  ].join("");
  const lookCh = at(VVAKER_LOOKS, t.look ?? "toy");
  const look = extras !== "0000000" ? `-${lookCh}${extras}` : lookCh !== "0" ? `-${lookCh}` : "";
  return `VV-${a}-${b}-${String(bib).padStart(2, "0")}-${at(Object.keys(VVAKER_BACKGROUNDS), background)}${look}`;
}
