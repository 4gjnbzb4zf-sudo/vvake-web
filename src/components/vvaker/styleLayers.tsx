import type { VVakerTraits } from "./traits";

/**
 * Personal-style layers (ADR-0018): hair, facial hair, piercings, scars, tattoos and body types.
 * Everything is drawn in the Toy's head/arm coordinates; the Athlete reuses them through a transform,
 * so both styles show the same choices.
 */
export const HAIR_COLOR = "#3b2a22";
const HAIR_LIGHT = "#5a4034";
const INK_TATTOO = "#1d2a44";
const METAL = "#d9dde2";
const SCAR = "#f2c5c5";
const OUTLINE = "#0b0d0f";

/** Hair that sits behind the head (drawn before it). */
export function HairBack({ hair, accent, animate }: { hair: VVakerTraits["hair"]; accent: string; animate: boolean }) {
  switch (hair) {
    case "ponytail":
      return (
        <g className={animate ? "vv-flutter" : undefined} style={{ transformOrigin: "182px 58px" }}>
          <path d="M176 54 Q224 58 216 118 Q210 142 196 152 Q202 106 174 84 Z" fill={HAIR_COLOR} />
          <rect x="174" y="50" width="12" height="12" rx="3" fill={accent} />
        </g>
      );
    case "afro":
      return (
        <g fill={HAIR_COLOR}>
          <ellipse cx="122" cy="72" rx="88" ry="58" />
          {[
            [40, 60],
            [58, 26],
            [96, 12],
            [146, 12],
            [186, 28],
            [206, 64],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="20" />
          ))}
        </g>
      );
    case "long":
      return <path d="M48 58 Q48 26 118 24 Q198 26 198 60 V190 H170 V100 H62 V190 H48 Z" fill={HAIR_COLOR} />;
    default:
      return null;
  }
}

/** Hair on top of the head (drawn after the head, before the headband so the band sits over it). */
export function HairFront({ hair, accent }: { hair: VVakerTraits["hair"]; accent: string }) {
  const cap = (fill: string, opacity = 1) => (
    <g fill={fill} opacity={opacity}>
      <polygon points="60,60 78,44 190,44 172,60" />
      <rect x="60" y="58" width="112" height="14" />
      <polygon points="172,60 190,44 190,58 172,74" />
    </g>
  );
  switch (hair) {
    case "crop":
    case "ponytail":
    case "long":
    case "afro":
      return cap(HAIR_COLOR);
    case "buzz":
      return cap(HAIR_LIGHT, 0.75);
    case "mohawk":
      return (
        <g>
          {cap(HAIR_COLOR, 0.35)}
          <polygon points="96,52 102,12 112,46 120,4 128,46 138,14 144,52" fill={accent} />
        </g>
      );
    case "bun":
      return (
        <g>
          {cap(HAIR_COLOR)}
          <circle cx="120" cy="32" r="17" fill={HAIR_COLOR} />
          <rect x="110" y="44" width="20" height="5" fill={accent} />
        </g>
      );
    case "braids":
      return (
        <g>
          {cap(HAIR_COLOR)}
          {[54, 178].map((x) =>
            Array.from({ length: 8 }, (_, i) => <circle key={`${x}-${i}`} cx={x} cy={84 + i * 12} r="7" fill={HAIR_COLOR} />),
          )}
          <rect x="48" y="176" width="12" height="6" fill={accent} />
          <rect x="172" y="176" width="12" height="6" fill={accent} />
        </g>
      );
    case "bald":
      return <ellipse cx="130" cy="52" rx="22" ry="4" fill="#ffffff" opacity={0.35} stroke="none" />;
    default:
      return null;
  }
}

/** Facial hair: drawn before the mouth, so the mouth stays visible on top. */
export function Facial({ facial }: { facial: VVakerTraits["facial"] }) {
  switch (facial) {
    case "stubble":
      return (
        <g fill={HAIR_COLOR} opacity={0.45} stroke="none">
          {Array.from({ length: 36 }, (_, i) => {
            const x = 68 + (i % 12) * 8 + (Math.floor(i / 12) % 2) * 4;
            const y = 128 + Math.floor(i / 12) * 9;
            return x > 98 && x < 134 && y < 146 ? null : <rect key={i} x={x} y={y} width="3" height="3" />;
          })}
        </g>
      );
    case "beard":
      return <path d="M60 116 V156 H172 V116 Q168 150 116 152 Q64 150 60 116 Z" fill={HAIR_COLOR} />;
    case "goatee":
      return <path d="M102 144 H130 L125 160 H107 Z" fill={HAIR_COLOR} />;
    case "mustache":
      return <path d="M98 131 Q107 122 116 129 Q125 122 134 131 Q125 129 116 134 Q107 129 98 131 Z" fill={HAIR_COLOR} />;
    default:
      return null;
  }
}

export function Piercing({ piercing }: { piercing: VVakerTraits["piercing"] }) {
  switch (piercing) {
    case "ear":
      return (
        <g fill="none" stroke={METAL} strokeWidth={2.6}>
          <circle cx="182" cy="116" r="6" />
          <circle cx="58" cy="120" r="5" />
        </g>
      );
    case "nose":
      return <path d="M111 125 a5 5 0 1 0 10 0" fill="none" stroke={METAL} strokeWidth={2.6} />;
    case "eyebrow":
      return (
        <g fill={METAL} stroke={OUTLINE} strokeWidth={1}>
          <circle cx="147" cy="89" r="3" />
          <circle cx="155" cy="95" r="3" />
        </g>
      );
    case "lip":
      return <circle cx="126" cy="147" r="4.5" fill="none" stroke={METAL} strokeWidth={2.4} />;
    default:
      return null;
  }
}

export function Scar({ scar }: { scar: VVakerTraits["scar"] }) {
  const cut = (d: string, stitches: string) => (
    <g stroke={SCAR} strokeLinecap="round" fill="none">
      <path d={d} strokeWidth={4} />
      <path d={stitches} strokeWidth={1.6} />
    </g>
  );
  switch (scar) {
    case "brow":
      return cut("M82 84 L100 104", "M86 94 l6 -6 M92 100 l6 -6");
    case "cheek":
      return cut("M140 124 L164 140", "M146 134 l5 -7 M154 139 l5 -7");
    default:
      return null;
  }
}

export function FaceTattoo({ tattoo }: { tattoo: VVakerTraits["tattoo"] }) {
  if (tattoo !== "face-star") return null;
  return (
    <polygon points="154,120 156,126 162,126 157,130 159,136 154,132 149,136 151,130 146,126 152,126" fill={INK_TATTOO} stroke="none" />
  );
}

/** Arm tattoos in the Toy's arm coordinates: left upper arm, left forearm, right forearm. */
export function ArmTattoo({
  tattoo,
  part,
  accent,
}: {
  tattoo: VVakerTraits["tattoo"];
  part: "upper-left" | "fore-left" | "fore-right";
  accent: string;
}) {
  const ink = { stroke: INK_TATTOO, fill: "none", strokeLinecap: "round" as const };
  if (tattoo === "sleeve" && part === "upper-left")
    return <path d="M61 168 q8 -5 16 0 M61 176 q8 5 16 0 M61 183 q8 -5 16 0" strokeWidth={2} {...ink} />;
  if (tattoo === "sleeve" && part === "fore-left") return <path d="M61 188 q8 5 16 0 M64 186 v4 M74 186 v4" strokeWidth={2} {...ink} />;
  if (tattoo === "tribal" && part === "upper-left") return <path d="M61 165 L71 170 L61 175 L73 180 L61 185" strokeWidth={3} {...ink} />;
  if (tattoo === "ecg" && part === "fore-right")
    return <path d="M173 194 h4 l2 -5 l3 10 l2 -5 h5" strokeWidth={2} stroke={accent} fill="none" strokeLinecap="round" />;
  if (tattoo === "flames" && part === "fore-left")
    return <path d="M63 205 q1 -9 5 -13 q-1 7 4 5 q2 -5 0 -9 q6 5 3 17 Z" fill="#ff8a3d" stroke={INK_TATTOO} strokeWidth={1.2} />;
  return null;
}

/** Body types: horizontal scale of torso, arms and legs, plus a belly or muscle lines. */
export const PHYSIQUE: Record<VVakerTraits["physique"], { torso: number; arms: number; legs: number }> = {
  regular: { torso: 1, arms: 1, legs: 1 },
  slim: { torso: 0.84, arms: 0.8, legs: 0.85 },
  chubby: { torso: 1.18, arms: 1.12, legs: 1.14 },
  muscular: { torso: 1.1, arms: 1.32, legs: 1.16 },
};

/** Horizontal scale around `cx` (keeps a limb or torso centred on its joint). */
export const widen = (cx: number, k: number) => (k === 1 ? undefined : `translate(${cx} 0) scale(${k} 1) translate(${-cx} 0)`);

export function PhysiqueDetail({ physique, cx, y, skin }: { physique: VVakerTraits["physique"]; cx: number; y: number; skin: string }) {
  if (physique === "chubby") return <ellipse cx={cx} cy={y + 46} rx="30" ry="15" fill={skin} opacity={0.9} />;
  if (physique === "muscular")
    return (
      <path
        d={`M${cx - 26} ${y + 12} Q${cx - 13} ${y + 22} ${cx - 1} ${y + 12} M${cx + 1} ${y + 12} Q${cx + 13} ${y + 22} ${cx + 26} ${y + 12}`}
        stroke={OUTLINE}
        strokeWidth={2}
        fill="none"
        opacity={0.55}
      />
    );
  return null;
}
