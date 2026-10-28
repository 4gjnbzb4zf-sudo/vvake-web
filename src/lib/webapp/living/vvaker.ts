// Copied from VVFit packages/game-core/src/vvaker.ts (2706ad26 2026-09-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * VVaker identity: a unique, permanent avatar per person (docs/03-economy/vvaker-identity-and-gear.md).
 * - DNA: a readable code for the base traits. One claim per account, no duplicates, never transferable.
 * - Evolution: levels earned only by real effort, never bought.
 * - Add-ons: paid cosmetic layers on top of the DNA (not unique, never affect rewards: ADR-0002).
 * Trait order must match the website's traits.ts (shared test vectors). New values are only ever
 * appended, so existing DNA codes stay valid forever.
 */
export const DNA_TRAITS = {
  color: ["candy", "lilac", "butter", "mint", "sky", "olive", "coral", "slate"],
  accent: ["pulse", "volt", "calm", "ocean", "snow", "flame"],
  sport: [
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
  ],
  headgear: ["none", "cap", "beanie", "headphones", "helmet"],
  eyes: ["pixel", "happy", "fired", "sleepy", "visor", "star"],
  mouth: ["smile", "grin", "calm", "o", "teeth"],
  accessory: ["none", "medal", "towel", "bib"],
  background: ["night", "pulse", "volt", "lilac", "sky", "cream"],
  /** Visual style (ADR-0017): Toy (original), Athlete build A or B. Appended: Toy codes are unchanged. */
  look: ["toy", "athlete-a", "athlete-b"],
  /** Personal style (ADR-0018). 'auto' = the look's default hair. All appended: older codes never change. */
  hair: ["auto", "bald", "crop", "buzz", "mohawk", "ponytail", "bun", "afro", "braids", "long"],
  facial: ["none", "stubble", "beard", "goatee", "mustache"],
  tattoo: ["none", "sleeve", "tribal", "ecg", "flames", "face-star"],
  piercing: ["none", "ear", "nose", "eyebrow", "lip"],
  scar: ["none", "brow", "cheek"],
  /** Body type, for every look. */
  physique: ["regular", "slim", "chubby", "muscular"],
  eyeColor: ["dark", "brown", "blue", "green", "hazel", "grey", "amber"],
} as const;
const EXTRAS = ["hair", "facial", "tattoo", "piercing", "scar", "physique", "eyeColor"] as const;
type ExtraKey = (typeof EXTRAS)[number];

type TraitKey = keyof typeof DNA_TRAITS;
export type DnaTraits = { [K in Exclude<TraitKey, "look" | ExtraKey>]: (typeof DNA_TRAITS)[K][number] } & {
  bib: number;
  /** Omitted = 'toy'. */
  look?: (typeof DNA_TRAITS)["look"][number];
} & { [K in ExtraKey]?: (typeof DNA_TRAITS)[K][number] };

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function idx<K extends TraitKey>(key: K, value: string): number {
  const i = (DNA_TRAITS[key] as readonly string[]).indexOf(value);
  if (i < 0) throw new RangeError(`Unknown ${key}: ${value}`);
  return i;
}

/** "VV-{color}{accent}{sport}-{headgear}{eyes}{mouth}{accessory}-{bib}-{background}[-{look}]", e.g. "VV-000-0000-00-0". Toy has no look suffix. */
export function encodeDna(t: DnaTraits): string {
  const bib = t.accessory === "bib" ? Math.min(99, Math.max(0, Math.round(t.bib))) : 0;
  const a = [idx("color", t.color), idx("accent", t.accent), idx("sport", t.sport)].map((i) => B36[i]).join("");
  const b = [idx("headgear", t.headgear), idx("eyes", t.eyes), idx("mouth", t.mouth), idx("accessory", t.accessory)]
    .map((i) => B36[i])
    .join("");
  const extras = EXTRAS.map((k) => idx(k, t[k] ?? DNA_TRAITS[k][0]));
  const lookIdx = idx("look", t.look ?? "toy");
  // Shortest canonical form: nothing for a plain Toy, one char for a look, eight when any style extra is set.
  const look = extras.some((i) => i > 0) ? `-${B36[lookIdx]}${extras.map((i) => B36[i]).join("")}` : lookIdx > 0 ? `-${B36[lookIdx]}` : "";
  return `VV-${a}-${b}-${String(bib).padStart(2, "0")}-${B36[idx("background", t.background)]}${look}`;
}

export function decodeDna(dna: string): DnaTraits | null {
  const m = /^VV-([0-9a-z]{3})-([0-9a-z]{4})-(\d{2})-([0-9a-z])(?:-([1-9a-z]|[0-9a-z]{8}))?$/.exec(dna);
  if (!m) return null;
  const pick = <K extends TraitKey>(key: K, ch: string) => DNA_TRAITS[key][B36.indexOf(ch)] as (typeof DNA_TRAITS)[K][number] | undefined;
  const [a, b, bibStr, bg] = [m[1]!, m[2]!, m[3]!, m[4]!];
  const t = {
    color: pick("color", a[0]!),
    accent: pick("accent", a[1]!),
    sport: pick("sport", a[2]!),
    headgear: pick("headgear", b[0]!),
    eyes: pick("eyes", b[1]!),
    mouth: pick("mouth", b[2]!),
    accessory: pick("accessory", b[3]!),
    background: pick("background", bg),
    bib: Number(bibStr),
  };
  if (Object.values(t).some((v) => v === undefined)) return null;
  if (t.accessory !== "bib" && t.bib !== 0) return null;
  if (m[5] === undefined) return t as DnaTraits;
  const look = pick("look", m[5][0]!);
  if (!look) return null;
  if (m[5].length === 1) return { ...t, look } as DnaTraits;
  const extras = EXTRAS.map((k, i) => [k, pick(k, m[5]![i + 1]!)] as const);
  if (extras.some(([, v]) => v === undefined)) return null;
  // The long form is only valid when at least one extra is set (one written form per VVaker).
  if (extras.every(([k, v]) => v === DNA_TRAITS[k][0])) return null;
  return { ...t, look, ...Object.fromEntries(extras) } as DnaTraits;
}

/** Number of distinct DNAs (bib numbers only multiply the "bib" accessory). */
export function dnaSpaceSize(): number {
  const base = ["color", "accent", "sport", "headgear", "eyes", "mouth", "background"] as const;
  const product = base.reduce((p, k) => p * DNA_TRAITS[k].length, 1);
  const accessories = DNA_TRAITS.accessory.length - 1 + 100; // "bib" × 100 numbers
  return product * accessories * DNA_TRAITS.look.length * EXTRAS.reduce((p, k) => p * DNA_TRAITS[k].length, 1);
}

/** `first` followed by the other values, so the user's own choice is always tried first. */
function orderFirst<T>(first: T, all: readonly T[]): T[] {
  return [first, ...all.filter((v) => v !== first)];
}

/**
 * Candidates in priority order, generated lazily. The least identity-defining traits change first:
 * background (fastest) → bib number → accent → mouth → eyes. Body color, sport, headgear and accessory never change.
 */
function* candidates(d: DnaTraits): Generator<DnaTraits> {
  const bibs =
    d.accessory === "bib"
      ? orderFirst(
          d.bib,
          Array.from({ length: 100 }, (_, n) => n),
        )
      : [d.bib];
  for (const eyes of orderFirst(d.eyes, DNA_TRAITS.eyes))
    for (const mouth of orderFirst(d.mouth, DNA_TRAITS.mouth))
      for (const accent of orderFirst(d.accent, DNA_TRAITS.accent))
        for (const bib of bibs)
          for (const background of orderFirst(d.background, DNA_TRAITS.background)) yield { ...d, eyes, mouth, accent, bib, background };
}

/** Claims the desired DNA, or the nearest free variant (see `candidates`). Null when `maxTries` are all taken. */
export function claimUnique(
  desired: DnaTraits,
  isTaken: (dna: string) => boolean,
  maxTries = 5000,
): { dna: string; traits: DnaTraits } | null {
  let tried = 0;
  for (const t of candidates(desired)) {
    const dna = encodeDna(t);
    if (!isTaken(dna)) return { dna, traits: t };
    if (++tried >= maxTries) break;
  }
  return null;
}

// ── Evolution (earned only) ───────────────────────────────────────────────────

export const MAX_LEVEL = 50;
export const STAGES = ["rookie", "regular", "athlete", "elite", "legend"] as const;
export type Stage = (typeof STAGES)[number];

/** Cumulative lifetime effort needed to reach `level` (level 1 = 0). Gentle curve: ~a season per stage for a regular mover. */
export function effortForLevel(level: number): number {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return Math.round(100 * Math.pow(l - 1, 1.6));
}

export function levelFromEffort(lifetimeEffort: number): number {
  let level = 1;
  while (level < MAX_LEVEL && lifetimeEffort >= effortForLevel(level + 1)) level++;
  return level;
}

export function stageOf(level: number): Stage {
  return STAGES[Math.min(STAGES.length - 1, Math.floor((Math.max(1, level) - 1) / 10))]!;
}

// ── Paid add-ons (cosmetic layer, never rewards) ─────────────────────────────

export const ADDON_SLOTS = {
  finish: ["matte", "holo", "chrome", "neon"],
  aura: ["none", "flame", "spark", "calm-wave", "city-lights"],
  trail: ["none", "pixel-dust", "pulse-line", "confetti"],
  emote: ["none", "fist-pump", "dab", "heart-hands", "victory-lap"],
} as const;

/** Free players keep the matte finish and "none" slots; everything else is a paid or earned cosmetic. */
export function isFreeAddon(slot: keyof typeof ADDON_SLOTS, value: string): boolean {
  return value === (slot === "finish" ? "matte" : "none");
}
