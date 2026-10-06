// Generated from VVFit/tools/imagine/personas.json (the cast spec) + the master prompt v0.3 (style-prompt.md).
// Keep in sync with tools/imagine/generate.mjs: same wording, so the generator's prompt renders like the site's cast.
import type { VVakerSport } from "@/components/vvaker/traits";

export const ANIMALS = {
  cheetah: "cheetah with spotted golden fur",
  cat: "tabby cat with grey tabby fur",
  fox: "red fox with orange fur",
  wolf: "grey wolf with thick grey fur",
  lion: "lion with golden fur and a big mane",
  tiger: "tiger with orange striped fur",
  panda: "giant panda with black and white fur",
  bear: "grizzly bear with brown fur",
  gorilla: "gorilla with black fur",
  elephant: "elephant with wrinkled grey skin",
  zebra: "zebra with black and white striped fur",
  kangaroo: "kangaroo with sandy brown fur",
  husky: "husky with grey and white fur",
  retriever: "golden retriever with golden fur",
  greyhound: "greyhound with short grey fur",
  raccoon: "raccoon with grey and black fur",
  otter: "otter with sleek brown fur",
  hare: "hare with light brown fur",
  eagle: "eagle with brown feathers",
  owl: "snowy owl with white and grey feathers",
  flamingo: "flamingo with soft pink feathers",
  penguin: "penguin with glossy black and white feathers",
  snowLeopard: "snow leopard with grey spotted fur",
  arcticFox: "arctic fox with thick white fur",
} as const;
export type Animal = keyof typeof ANIMALS;

export const TOPS = {
  jersey: "oversized mesh basketball jersey",
  tank: "tank top",
  singlet: "fitted running singlet",
  hoodie: "oversized hoodie",
  track: "zip track jacket",
  tee: "compression tee",
  puffer: "padded puffer jacket",
  polo: "sport polo shirt",
} as const;
export const BOTTOMS = {
  trackpants: "loose black track pants",
  shorts: "black athletic shorts",
  leggings: "black leggings",
  joggers: "black joggers",
  bibs: "black cycling bib shorts",
  skipants: "black ski pants",
} as const;
export const HEADWEAR = {
  snapback: "black snapback worn backwards and wraparound mirrored sport sunglasses",
  bucket: "black bucket hat",
  beanie: "black beanie",
  headband: "black sweat headband",
  helmet: "sport helmet in black with neon lime details",
  none: "no hat",
} as const;
export const SHOES = {
  retro: "chunky retro basketball sneakers in black with neon lime panels, visible air bubble sole and white midsole",
  runners: "sleek running trainers in black with neon lime soles",
  hightops: "black high-top sneakers with neon lime laces",
  trail: "chunky black trail boots with neon lime laces",
  sport: "",
  barefoot: "barefoot",
} as const;
export const GEAR = {
  sweatband: "a sweatband",
  backpack: "a small black backpack",
  towel: "a towel over the shoulder",
  bottle: "a water bottle",
  gloves: "fingerless training gloves",
} as const;
export const BUILDS = {
  lean: "lean",
  athletic: "athletic",
  muscular: "very muscular",
  curvy: "curvy athletic",
  big: "big and strong",
} as const;
export const ATTITUDES = { cool: "cool", playful: "playful", fierce: "fierce", serene: "serene" } as const;

/** Per sport: the cast's animal, sport elements, pose and sport-specific clothing (used when "sport" is picked). */
export const SPORTS: Record<
  VVakerSport,
  { animal: string; props: string; pose: string; shoes?: string; top?: string; bottoms?: string; headwear?: string }
> = {
  runner: {
    animal: "cheetah",
    props: "a white race bib with the number 1 pinned on the singlet, a sweatband",
    pose: "mid-stride running pose, one foot off the ground",
    shoes: "sleek running trainers in black with neon lime soles",
    top: "fitted black and silver running singlet",
    bottoms: "black running shorts",
    headwear: undefined,
  },
  walker: {
    animal: "golden retriever",
    props: "a water bottle in one hand, a step-counter smartwatch",
    pose: "relaxed confident walk",
    shoes: undefined,
    top: undefined,
    bottoms: undefined,
    headwear: undefined,
  },
  cyclist: {
    animal: "greyhound",
    props: "a black road bike with neon lime accents held by the handlebar beside them",
    pose: "standing next to the bike, one hand on the handlebar",
    shoes: "black cycling shoes with neon lime straps",
    top: "black and silver cycling jersey",
    bottoms: "black cycling bib shorts",
    headwear: "black aero cycling helmet and wraparound mirrored sunglasses",
  },
  lifter: {
    animal: "gorilla",
    props: "a chrome kettlebell held in one hand, black lifting belt",
    pose: "power stance, kettlebell at the hip",
    shoes: undefined,
    top: "black and silver tank top",
    bottoms: undefined,
    headwear: undefined,
  },
  boxer: {
    animal: "elephant",
    props: "chrome boxing gloves, one worn and one resting on the floor",
    pose: "boxing guard stance, legs wide",
    shoes: undefined,
    top: "black and silver basketball tank top",
    bottoms: undefined,
    headwear: undefined,
  },
  yogi: {
    animal: "flamingo",
    props: "a rolled black yoga mat with neon lime edge tucked under the arm",
    pose: "tree pose standing on one leg",
    shoes: "barefoot",
    top: "cropped black and silver sports top",
    bottoms: "black leggings",
    headwear: "no hat",
  },
  baller: {
    animal: "tabby cat",
    props: "an orange basketball held at the hip",
    pose: "casual stance, basketball tucked under the arm",
    shoes: undefined,
    top: undefined,
    bottoms: undefined,
    headwear: undefined,
  },
  coder: {
    animal: "raccoon",
    props: "a laptop with neon lime code on the screen under the arm",
    pose: "stretching one arm up after sitting",
    shoes: undefined,
    top: "black zip hoodie over the jersey",
    bottoms: undefined,
    headwear: "silver over-ear headphones on the head",
  },
  martial: {
    animal: "giant panda",
    props: "black belt tied at the waist",
    pose: "karate stance, one fist forward",
    shoes: "barefoot",
    top: "white martial arts gi jacket with black belt over the kit",
    bottoms: "white gi pants",
    headwear: "black headband",
  },
  paddler: {
    animal: "eagle",
    props: "seated in a carved wooden canoe holding a wooden paddle, binoculars around the neck",
    pose: "seated in the canoe, paddle across the body",
    shoes: undefined,
    top: 'black and cobalt blue zip track jacket with a white "VV" logo',
    bottoms: "grey track pants",
    headwear: "black baseball cap",
  },
  meditator: {
    animal: "snowy owl",
    props: "a round black meditation cushion",
    pose: "seated cross-legged on the cushion, eyes closed",
    shoes: "barefoot",
    top: "loose black and silver hoodie",
    bottoms: "black joggers",
    headwear: "no hat",
  },
  roller: {
    animal: "red fox",
    props: "knee pads and wrist guards",
    pose: "gliding forward on one skate, other leg lifted behind",
    shoes: "quad roller skates in black with neon lime wheels",
    top: undefined,
    bottoms: undefined,
    headwear: undefined,
  },
  skater: {
    animal: "arctic fox",
    props: "a neon lime scarf",
    pose: "gliding on the ice, arms open for balance",
    shoes: "black ice skates with silver blades",
    top: "black and silver padded jacket",
    bottoms: undefined,
    headwear: "black beanie",
  },
  swimmer: {
    animal: "otter",
    props: "a towel over the shoulder",
    pose: "standing poolside, towel over the shoulder",
    shoes: "black pool slides",
    top: "no top, black and silver swim jammer",
    bottoms: "black and silver swim jammers",
    headwear: "black swim cap with goggles pushed up on the forehead",
  },
  hiker: {
    animal: "grizzly bear",
    props: "a hiking backpack and two trekking poles",
    pose: "stepping up onto a rock, poles planted",
    shoes: "chunky black trail boots with neon lime laces",
    top: "black and silver technical jacket",
    bottoms: "black hiking pants",
    headwear: "black beanie",
  },
  climber: {
    animal: "snow leopard",
    props: "a chalk bag at the waist, a climbing harness, chalky hands",
    pose: "reaching up as if gripping a hold",
    shoes: "black climbing shoes",
    top: "black and silver tank top",
    bottoms: "black climbing pants",
    headwear: "no hat",
  },
  racket: {
    animal: "hare",
    props: "a tennis racket and a neon lime tennis ball",
    pose: "ready position, racket in front",
    shoes: undefined,
    top: "black and silver polo shirt",
    bottoms: "black shorts",
    headwear: undefined,
  },
  dancer: {
    animal: "zebra",
    props: "",
    pose: "breakdance freeze pose on one hand",
    shoes: undefined,
    top: "oversized black and silver hoodie",
    bottoms: undefined,
    headwear: undefined,
  },
  skier: {
    animal: "husky",
    props: "skis and ski poles",
    pose: "carving crouch on skis",
    shoes: "black ski boots",
    top: "black and silver ski jacket",
    bottoms: "black ski pants",
    headwear: "black ski helmet with mirrored goggles",
  },
  footballer: {
    animal: "lion",
    props: "a black and white football under one foot",
    pose: "confident stance, one foot on the ball",
    shoes: "black football boots with neon lime studs",
    top: "black and silver football jersey",
    bottoms: "black football shorts and socks",
    headwear: "no hat",
  },
};

export interface Persona {
  name: string;
  animal: Animal;
  sport: VVakerSport;
  top: keyof typeof TOPS;
  bottoms: keyof typeof BOTTOMS;
  headwear: keyof typeof HEADWEAR;
  shoes: keyof typeof SHOES;
  gear: (keyof typeof GEAR)[];
  build: keyof typeof BUILDS;
  attitude: keyof typeof ATTITUDES;
}

export const DEFAULT_PERSONA: Persona = {
  name: "",
  animal: "cat",
  sport: "baller",
  top: "jersey",
  bottoms: "trackpants",
  headwear: "snapback",
  shoes: "retro",
  gear: [],
  build: "athletic",
  attitude: "cool",
};

/**
 * The ready-made cast (public/personas, one per sport) expressed in the generator's own options, so browsing
 * the cast sets the selectors to the character on screen. Closest option where the cast wears sport-specific kit
 * (tools/imagine/personas.json has the exact wording).
 */
type CastLook = Omit<Persona, "name" | "sport">;
const cast = (
  animal: Animal,
  top: Persona["top"],
  bottoms: Persona["bottoms"],
  headwear: Persona["headwear"],
  shoes: Persona["shoes"],
  build: Persona["build"] = "athletic",
  attitude: Persona["attitude"] = "cool",
  gear: Persona["gear"] = [],
): CastLook => ({ animal, top, bottoms, headwear, shoes, build, attitude, gear });

export const CAST: Record<VVakerSport, CastLook> = {
  runner: cast("cheetah", "singlet", "shorts", "snapback", "sport", "lean", "cool", ["sweatband"]),
  walker: cast("retriever", "jersey", "trackpants", "snapback", "retro", "athletic", "cool", ["bottle"]),
  cyclist: cast("greyhound", "tee", "bibs", "helmet", "sport", "lean"),
  lifter: cast("gorilla", "tank", "trackpants", "snapback", "retro", "muscular"),
  boxer: cast("elephant", "tank", "trackpants", "snapback", "retro", "muscular"),
  yogi: cast("flamingo", "tank", "leggings", "none", "barefoot", "lean"),
  baller: cast("cat", "jersey", "trackpants", "snapback", "retro"),
  coder: cast("raccoon", "hoodie", "trackpants", "none", "retro"),
  martial: cast("panda", "tee", "trackpants", "headband", "barefoot"),
  paddler: cast("eagle", "track", "trackpants", "snapback", "retro"),
  meditator: cast("owl", "hoodie", "joggers", "none", "barefoot", "lean", "serene"),
  roller: cast("fox", "jersey", "trackpants", "snapback", "sport", "lean", "playful"),
  skater: cast("arcticFox", "puffer", "trackpants", "beanie", "sport"),
  swimmer: cast("otter", "tank", "shorts", "none", "sport", "athletic", "cool", ["towel"]),
  hiker: cast("bear", "track", "trackpants", "beanie", "trail", "big", "cool", ["backpack"]),
  climber: cast("snowLeopard", "tank", "joggers", "none", "sport", "muscular"),
  racket: cast("hare", "polo", "shorts", "snapback", "retro", "lean"),
  dancer: cast("zebra", "hoodie", "trackpants", "snapback", "retro", "athletic", "playful"),
  skier: cast("husky", "puffer", "skipants", "helmet", "sport"),
  footballer: cast("lion", "jersey", "shorts", "none", "sport"),
};

/** The cast member for a sport as a full persona (the player's name is kept). */
export const castPersona = (sport: VVakerSport, name = ""): Persona => ({ name, sport, ...CAST[sport], gear: [...CAST[sport].gear] });

/** True when the persona is exactly the cast member for its sport (so the preview is that character). */
export function isCastPersona(p: Persona): boolean {
  const c = CAST[p.sport];
  return (Object.keys(c) as (keyof CastLook)[]).every((k) =>
    k === "gear" ? c.gear.length === p.gear.length && c.gear.every((g) => p.gear.includes(g)) : c[k] === p[k],
  );
}

/** Master prompt v0.3 for a player's persona (same wording as tools/imagine/generate.mjs). */
export function buildPersonaPrompt(p: Persona): string {
  const sport = SPORTS[p.sport];
  const shoes = p.shoes === "sport" ? (sport.shoes ?? SHOES.retro) : SHOES[p.shoes];
  const barefoot = /barefoot/.test(shoes);
  const [animal, fur] = ANIMALS[p.animal].split(" with ");
  const extras = [sport.props, ...p.gear.map((g) => GEAR[g])].filter(Boolean).join(", ");
  return [
    `Hyper-realistic 3D character render of an anthropomorphic ${animal} athlete, ${BUILDS[p.build]} build, human-like hands with ${fur} texture, confident ${ATTITUDES[p.attitude]} expression, full body from head to ${barefoot ? "feet" : "shoes"}, ${sport.pose}.`,
    `VVake Fit streetwear kit: ${TOPS[p.top]} in black and chrome-silver with a small printed "VVAKE" wordmark on the chest in clean bold sans-serif capitals (white on black fabric, black on silver fabric), no other logos, silver Cuban link chain, silver over-ear headphones resting around the neck, ${HEADWEAR[p.headwear]}, ${BOTTOMS[p.bottoms]} with two white side stripes, ${shoes}.`,
    `A black sport smartwatch worn naturally on the left wrist like a real watch: strap wrapped around the wrist, screen on top of the wrist facing up, glowing with the VVake app (a neon lime heart-rate line and a heart icon).`,
    extras ? `Sport elements: ${extras}.` : "",
    `One hand raised at shoulder height making the VVake sign: exactly three fingers raised straight up and pressed together side by side in a row (the index, middle and ring fingers), the little finger folded down and held under the thumb, palm facing the camera, clearly readable. Not a peace sign, not an OK sign, not four fingers.`,
    `Colour palette: black, chrome silver and gold, with neon lime (#ccff00) and a touch of hot pink (#ff3d6e) as accents.`,
    `Isolated on a pure white seamless background, soft even studio lighting, subtle contact shadow under the character, centred with margin around the character, portrait 2:3, ultra detailed, sharp focus.`,
    `No real brand logos or trademarks (no swoosh, no jumpman, no three stripes, no club crests), no text other than "VV", anatomically clean hands with the correct number of fingers, no extra limbs, no background scenery, no floating props, not cartoon, not anime, not blurry, no watermark.`,
  ]
    .filter(Boolean)
    .join(" ");
}

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const idx = (obj: object, key: string) => B36[Object.keys(obj).indexOf(key)] ?? "0";

/** Readable persona code, e.g. "VVP-6a0000-10-0", one per combination (claimed at launch). */
export function personaCode(p: Persona, sports: readonly string[]): string {
  const gear = Object.keys(GEAR).reduce((m, g, i) => (p.gear.includes(g as keyof typeof GEAR) ? m | (1 << i) : m), 0);
  const a =
    idx(ANIMALS, p.animal) +
    B36[sports.indexOf(p.sport)] +
    idx(TOPS, p.top) +
    idx(BOTTOMS, p.bottoms) +
    idx(HEADWEAR, p.headwear) +
    idx(SHOES, p.shoes);
  return `VVP-${a}-${idx(BUILDS, p.build)}${idx(ATTITUDES, p.attitude)}-${B36[gear]}`;
}

/**
 * Reads a persona code back (the inverse of personaCode; the app's game-core decodePersona does the same), keeping
 * `name`. Null when it isn't a valid code. Used to try the nearest free look the API suggests.
 */
export function personaFromCode(code: string, sports: readonly string[], name = ""): Persona | null {
  const m = /^VVP-([0-9a-z]{6})-([0-9a-z]{2})-([0-9a-z])$/i.exec(code.trim().replace(/\s+/g, ""));
  if (!m) return null;
  const [a, b, g] = [m[1]!.toLowerCase(), m[2]!.toLowerCase(), m[3]!.toLowerCase()];
  const at = <T extends string>(keys: readonly T[], ch: string): T | undefined => keys[B36.indexOf(ch)];
  const keys = <O extends object>(o: O) => Object.keys(o) as (keyof O & string)[];
  const p = {
    animal: at(keys(ANIMALS), a[0]!),
    sport: at(sports as readonly VVakerSport[], a[1]!),
    top: at(keys(TOPS), a[2]!),
    bottoms: at(keys(BOTTOMS), a[3]!),
    headwear: at(keys(HEADWEAR), a[4]!),
    shoes: at(keys(SHOES), a[5]!),
    build: at(keys(BUILDS), b[0]!),
    attitude: at(keys(ATTITUDES), b[1]!),
  };
  const bits = B36.indexOf(g);
  const gearKeys = keys(GEAR);
  if (Object.values(p).some((v) => v === undefined) || bits < 0 || bits >= 1 << gearKeys.length) return null;
  return { name, ...(p as Omit<Persona, "name" | "gear">), gear: gearKeys.filter((_, i) => bits & (1 << i)) };
}
