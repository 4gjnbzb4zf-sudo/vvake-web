import { shade } from "@/lib/color";
import { MOTIONS, type Keys } from "./motion";
import { DEFAULT_TRAITS, FAN_KITS, VVAKER_ACCENTS, VVAKER_COLORS, VVAKER_EYE_COLORS, clampBib, type VVakerTraits } from "./traits";
import { ArmTattoo, Facial, FaceTattoo, HairBack, HairFront, PHYSIQUE, PhysiqueDetail, Piercing, Scar, widen } from "./styleLayers";
import { Accessory, Eyes, Fade, FanKitLayer, Footwear, Front, HandProp, Headgear, Joint, Mouth, Scene, SportProp } from "./VVaker";

const INK = "#15181b";
const OUTLINE = "#0b0d0f";
const VOLT = "#ccff00";
const PULSE = "#ff3d6e";
const ENERGY = [PULSE, "#ff7a9a", "#e8ff7a", VOLT] as const;
/** Maps the Toy's head (x 60–172, y 60–156) onto the Athlete's smaller head (x 88–152, y 30–90). */
const FACE = "translate(88 30) scale(0.5714 0.625) translate(-60 -60)";
const mapKeys = (k: Keys, f: (v: number) => number): Keys => [f(k[0]), f(k[1]), f(k[2]), f(k[3])];
/** Scenes where the figure sits lower (water, boat, cushion): the Athlete is taller than the Toy. */
const ATHLETE_DROP: Partial<Record<VVakerTraits["sport"], number>> = { swimmer: 78, paddler: 50, meditator: 30 };
const WATER = new Set<VVakerTraits["sport"]>(["swimmer", "paddler"]);
/** Props that belong to the scene, not to the Toy's body shape. */
const PROPS = new Set<VVakerTraits["sport"]>(["paddler", "baller", "yogi", "meditator", "coder"]);

/**
 * PROPOSAL "Athlete" (VVaker v2): same voxel DNA (3-face boxes, VV headband, HR watch, energy bar),
 * athletic proportions: smaller head, V-taper torso, muscle lines, tank top + shorts, big sneakers.
 * Driven by the same MOTIONS as v1 (joint angles are shared), so every sport can move the same way.
 */
/** Build A: broad V-taper, tank + shorts, short hair. Build B: waist-to-hip curve, sports top + leggings, ponytail. Anyone picks either. */
export type AthleteBuild = "a" | "b";

export function VVakerAthlete({
  className,
  animate = true,
  build = "a",
  title,
  ...partial
}: Partial<VVakerTraits> & { className?: string; animate?: boolean; build?: AthleteBuild; title?: string | undefined }) {
  const t: VVakerTraits = { ...DEFAULT_TRAITS, ...partial };
  const skin = VVAKER_COLORS[t.color];
  const kit = VVAKER_ACCENTS[t.accent];
  const light = shade(skin, 0.35);
  const dark = shade(skin, -0.28);
  const kitDark = shade(kit, -0.35);
  const m = MOTIONS[t.sport];
  const filled = Math.max(0, Math.min(4, Math.round(t.energy)));
  const jp = { period: m.period, animate };
  const drop = ATHLETE_DROP[t.sport] ?? m.drop ?? 0;
  const P = PHYSIQUE[t.physique];
  const fem = build === "b";
  // "auto" hair follows the build: a short crop for A, a ponytail for B.
  const hair = t.hair === "auto" ? (fem ? "ponytail" : "crop") : t.hair;
  const blinks = t.eyes !== "sleepy" && t.eyes !== "visor" && t.sport !== "meditator";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 300"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Scene sport={t.sport} m={m} animate={animate} />
      {!WATER.has(t.sport) && <ellipse cx="120" cy="288" rx="62" ry="8" fill="#000" opacity="0.35" />}
      {ENERGY.map((c, i) => (
        <rect key={c} x={78 + i * 22} y={4} width={18} height={8} rx={2} fill={i < filled ? c : "#22262b"} />
      ))}

      <g transform={[m.frame ?? "", drop ? `translate(0 ${drop})` : ""].join(" ").trim() || undefined}>
        <Joint {...jp} x={120} y={212} k={m.tilt} lift={m.body} shift={m.sway}>
          <g stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            {/* legs: thigh (quad line) → knee → shin + big sneaker */}
            {(
              [
                [104, m.lh, m.lk, m.ly],
                [136, m.rh, m.rk, m.ry],
              ] as const
            ).map(([hx, hip, knee, lift]) => (
              <Joint key={hx} {...jp} x={hx} y={212} k={hip} lift={lift}>
                <rect x={hx - 11} y={210} width={22} height={38} fill={fem ? INK : skin} transform={widen(hx, P.legs)} />
                <path d={`M${hx - 4} 218 q-3 14 2 26`} stroke={fem ? kit : dark} strokeWidth={2} fill="none" />
                <Joint {...jp} x={hx} y={246} k={knee}>
                  <rect x={hx - 10} y={244} width={20} height={28} fill={fem ? INK : skin} transform={widen(hx, P.legs)} />
                  {fem && <rect x={hx - 10} y={250} width={20} height={3} fill={kit} stroke="none" />}
                  <rect x={hx - 10} y={258} width={20} height={6} fill="#f4f5f6" />
                  <path d={`M${hx - 16} 270 h30 q6 0 6 8 v4 h-38 z`} fill="#f4f5f6" />
                  <path d={`M${hx - 16} 278 h36`} stroke={kit} strokeWidth={4} />
                  <path d={`M${hx - 8} 272 l10 2`} stroke={kit} strokeWidth={2} />
                  <g transform={`translate(${hx - 97} 8)`}>
                    <Footwear sport={t.sport} dx={0} accent={kit} />
                  </g>
                </Joint>
              </Joint>
            ))}

            <g transform={widen(120, P.torso)}>
              {fem ? (
                <>
                  {/* leggings waist + hips */}
                  <polygon points="94,184 146,184 156,214 84,214" fill={INK} />
                  <path d="M94 190 H146" stroke={kit} strokeWidth={3} />
                  {/* torso: narrower shoulders, waist, sports top + bare midriff */}
                  <polygon points="80,102 160,102 146,160 150,188 90,188 94,160" fill={skin} />
                  <polygon points="160,102 170,95 158,154 146,160" fill={dark} />
                  <polygon points="88,108 152,108 146,150 94,150" fill={kit} />
                  <polygon points="152,108 160,102 154,144 146,150" fill={kitDark} />
                  <path d="M100 108 Q120 122 140 108" fill={skin} />
                  <path d="M112 124 l4 8 l4 -8 l4 8 l4 -8" stroke={INK} strokeWidth={2.2} fill="none" />
                  <path d="M112 164 H128 M112 174 H128 M120 158 V184" stroke={dark} strokeWidth={1.4} />
                </>
              ) : (
                <>
                  {/* shorts */}
                  <polygon points="90,188 150,188 154,222 124,222 120,210 116,222 86,222" fill={INK} />
                  <path d="M92 196 H148" stroke={kit} strokeWidth={3} />
                  {/* V-taper torso: tank top over skin */}
                  <polygon points="72,100 168,100 150,190 90,190" fill={skin} />
                  <polygon points="168,100 180,92 162,184 150,190" fill={dark} />
                  <polygon points="84,106 156,106 146,190 94,190" fill={kit} />
                  <polygon points="156,106 164,100 154,184 146,190" fill={kitDark} />
                  <path d="M100 106 Q120 124 140 106" fill={skin} />
                  <path d="M112 146 l4 8 l4 -8 l4 8 l4 -8" stroke={INK} strokeWidth={2.4} fill="none" />
                  <path d="M112 166 H128 M112 176 H128 M120 160 V184" stroke={kitDark} strokeWidth={1.6} />
                </>
              )}
              <PhysiqueDetail physique={t.physique} cx={120} y={106} skin={shade(skin, 0.12)} />
              {/* the Toy's fan kit and accessories (medal, bib, towel), mapped onto the Athlete's torso */}
              <g transform="translate(84 106) scale(0.973 1.3125) translate(-80 -158)">
                <FanKitLayer kit={FAN_KITS[t.fan]} />
                <Accessory accessory={t.accessory} accent={kit} bib={clampBib(t.bib)} />
              </g>
            </g>

            {/* neck + head (smaller cube) */}
            <rect x="110" y="84" width="20" height="18" fill={dark} />
            <polygon points="152,30 164,20 164,80 152,90" fill={dark} />
            <g transform={FACE}>
              <HairBack hair={hair} accent={kit} animate={animate} />
            </g>
            <rect x="88" y="30" width="64" height="60" fill={skin} />
            <polygon points="88,30 100,20 164,20 152,30" fill={light} />
            <g transform={FACE}>
              <HairFront hair={hair} accent={kit} />
            </g>
            <rect x="88" y="38" width="64" height="9" fill={kit} />
            <polygon points="152,38 164,28 164,37 152,47" fill={kitDark} />
            <path d="M130 40 l3 5 l3 -5 l3 5 l3 -5" stroke={INK} strokeWidth={1.6} fill="none" />
            <polygon points="164,31 176,39 171,42" fill={kit} />
            {/* the face uses the same eyes, mouth, cheeks, headgear and style layers as the Toy, scaled */}
            <g transform={FACE}>
              <g className={animate && blinks ? "vv-blink" : undefined}>
                <Eyes eyes={t.eyes} color={VVAKER_EYE_COLORS[t.eyeColor]} />
              </g>
              <Scar scar={t.scar} />
              <Fade keys={m.strain ? mapKeys(m.strain, (v) => 0.75 + v * 0.25) : undefined} period={m.period} animate={animate}>
                <rect x="68" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={m.strain ? undefined : 0.75} />
                <rect x="150" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={m.strain ? undefined : 0.75} />
              </Fade>
              <FaceTattoo tattoo={t.tattoo} />
              <Facial facial={t.facial} />
              <Fade keys={animate && m.mouth ? mapKeys(m.mouth, (v) => 1 - v) : undefined} period={m.period} animate={animate}>
                <Mouth mouth={t.mouth} />
              </Fade>
              {animate && m.mouth && (
                <Fade keys={m.mouth} period={m.period} animate>
                  <ellipse cx="116" cy="137" rx="6" ry="7" fill={INK} />
                </Fade>
              )}
              <Piercing piercing={t.piercing} />
              <Headgear headgear={t.headgear} accent={kit} />
            </g>

            {PROPS.has(t.sport) && (
              <g transform="translate(0 -12)">
                <SportProp sport={t.sport} accent={kit} animate={animate} motion={m} />
              </g>
            )}

            {/* arms: shoulder → upper arm (bicep) → elbow → forearm + fist; HR watch on the left wrist */}
            <Joint {...jp} x={76} y={106} k={m.ls}>
              <g transform={widen(76, P.arms)}>
                <rect x="66" y="102" width="20" height="44" rx="3" fill={skin} />
                <g transform="translate(66 102) scale(1.111 1.76) translate(-60 -162)">
                  <ArmTattoo tattoo={t.tattoo} part="upper-left" accent={kit} />
                </g>
              </g>
              <path d="M84 110 q6 14 0 30" stroke={dark} strokeWidth={2} fill="none" />
              <Joint {...jp} x={76} y={144} k={m.le}>
                <g transform={widen(76, P.arms)}>
                  <rect x="67" y="142" width="18" height="40" rx="3" fill={skin} />
                  <g transform="translate(67 142) scale(1 1.667) translate(-60 -184)">
                    <ArmTattoo tattoo={t.tattoo} part="fore-left" accent={kit} />
                  </g>
                </g>
                <rect x="64" y="162" width="24" height="11" rx="2" fill={INK} stroke={VOLT} strokeWidth={1.5} />
                <path d="M67 167 h3 l2 -3 l2 5 l2 -3 h5" stroke={VOLT} strokeWidth={1.2} fill="none" />
                <rect x="66" y="180" width="20" height="16" rx="5" fill={light} />
                <g transform="translate(7 -22)">
                  <HandProp sport={t.sport} side="left" />
                </g>
              </Joint>
            </Joint>
            <Joint {...jp} x={164} y={106} k={m.rs}>
              <rect x="154" y="102" width="20" height="44" rx="3" fill={dark} transform={widen(164, P.arms)} />
              <path d="M156 110 q-6 14 0 30" stroke={shade(skin, -0.45)} strokeWidth={2} fill="none" />
              <Joint {...jp} x={164} y={144} k={m.re}>
                <g transform={widen(164, P.arms)}>
                  <rect x="155" y="142" width="18" height="40" rx="3" fill={dark} />
                  <g transform="translate(155 142) scale(1 1.667) translate(-172 -182)">
                    <ArmTattoo tattoo={t.tattoo} part="fore-right" accent={kit} />
                  </g>
                </g>
                <rect x="154" y="180" width="20" height="16" rx="5" fill={skin} />
                <g transform="translate(-17 -20)">
                  <HandProp sport={t.sport} side="right" accent={kit} />
                </g>
              </Joint>
            </Joint>
          </g>
        </Joint>
      </g>
      <Front sport={t.sport} m={m} animate={animate} />
    </svg>
  );
}
