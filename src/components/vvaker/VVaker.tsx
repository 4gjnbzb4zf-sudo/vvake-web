"use client";

import { shade } from "@/lib/color";
import { useLookPref } from "@/lib/prefs";
import { MOTIONS, type Keys, type Motion } from "./motion";
import { ArmTattoo, Facial, FaceTattoo, HairBack, HairFront, PHYSIQUE, PhysiqueDetail, Piercing, Scar, widen } from "./styleLayers";
import { VVakerAthlete } from "./VVakerAthlete";
import {
  DEFAULT_TRAITS,
  FAN_KITS,
  VVAKER_EYE_COLORS,
  VVAKER_ACCENTS,
  VVAKER_COLORS,
  VVAKER_SPORTS,
  clampBib,
  type VVakerTraits,
} from "./traits";

const INK = "#15181b";
const PULSE = "#ff3d6e";
const VOLT = "#ccff00";
const CALM = "#8b87d9";
const GOLD = "#f5c542";
/** Dark contour that gives every VVaker a crisp sticker/toy read at any size. */
const OUTLINE = "#0b0d0f";
const ENERGY_COLORS = [PULSE, "#ff7a9a", "#e8ff7a", VOLT] as const;

interface VVakerProps extends Partial<VVakerTraits> {
  /** Accessible label. Omit for decorative use. */
  title?: string;
  /** Sport motion loop (CSS; off for reduced motion). The pose itself is static SVG, so exports keep it. */
  animate?: boolean;
  /** Ignore the visitor's saved style and draw exactly `look` (studio preview, comparisons). */
  lockLook?: boolean;
  className?: string;
}

/**
 * A VVaker: a voxel athlete built from three-face boxes (front, top, side) for a toy-like 3D read.
 * Signature elements: floating energy bar, VV headband (a tiny W), glowing watch, square-pixel eyes.
 * Pure SVG with no filters or web fonts, so it rasterises identically to PNG in every browser.
 * Every trait is optional; missing ones fall back to DEFAULT_TRAITS.
 */
export function VVaker({ title, className, animate = true, lockLook = false, ...partial }: VVakerProps) {
  const pref = useLookPref();
  const t: VVakerTraits = { ...DEFAULT_TRAITS, ...partial };
  // A visitor's saved style wins over decorative defaults, unless the caller locks the look (studio, lab).
  const look = (!lockLook && pref) || t.look;
  if (look !== "toy") {
    return <VVakerAthlete {...t} build={look === "athlete-b" ? "b" : "a"} title={title} className={className} animate={animate} />;
  }
  const base = VVAKER_COLORS[t.color];
  const accent = VVAKER_ACCENTS[t.accent];
  const light = shade(base, 0.38);
  const dark = shade(base, -0.28);
  const darker = shade(base, -0.45);
  const filled = Math.max(0, Math.min(4, Math.round(t.energy)));
  const moving = t.sport === "runner" || t.sport === "cyclist" || t.sport === "roller";
  const m = MOTIONS[t.sport];
  const P = PHYSIQUE[t.physique];
  const blinks = t.eyes !== "sleepy" && t.eyes !== "visor" && t.sport !== "meditator";
  const blinkDelay = (VVAKER_SPORTS.indexOf(t.sport) * 1.3) % 4;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 300"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* ground shadow */}
      {t.sport !== "paddler" && t.sport !== "swimmer" && <ellipse cx="122" cy="282" rx="70" ry="9" fill="#000" opacity="0.35" />}

      {/* energy bar */}
      <g>
        {ENERGY_COLORS.map((c, i) => (
          <rect
            key={c}
            x={72 + i * 25}
            y={8}
            width={21}
            height={10}
            rx={2.5}
            fill={i < filled ? c : "#22262b"}
            stroke={i < filled ? "none" : "#343a41"}
            strokeWidth={1.5}
          />
        ))}
        {filled > 0 && <rect x={72} y={8} width={filled * 25 - 4} height={10} rx={2.5} fill={VOLT} opacity={0.18} />}
      </g>

      {moving && (
        <g stroke={light} strokeWidth={5} strokeLinecap="round" opacity={0.7}>
          <path d="M22 176 H46" />
          <path d="M14 192 H44" />
          <path d="M26 208 H48" />
        </g>
      )}

      <Scene sport={t.sport} m={m} animate={animate} />

      <g transform={[m.frame ?? "", m.drop ? `translate(0 ${m.drop})` : ""].join(" ").trim() || undefined}>
        <Joint x={120} y={222} k={m.tilt} lift={m.body} shift={m.sway} period={m.period} animate={animate}>
          <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            {/* legs: hip → thigh → knee → shin + shoe */}
            <Joint x={100} y={222} k={m.lh} lift={m.ly} period={m.period} animate={animate}>
              <rect x="88" y="222" width="24" height="21" fill={darker} transform={widen(100, P.legs)} />
              <Joint x={100} y={241} k={m.lk} period={m.period} animate={animate}>
                <rect x="88" y="240" width="24" height="20" fill={darker} transform={widen(100, P.legs)} />
                <rect x="82" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
                <rect x="82" y="266" width="34" height="5" fill={accent} />
                <Footwear sport={t.sport} dx={0} accent={accent} />
              </Joint>
            </Joint>
            <Joint x={136} y={222} k={m.rh} lift={m.ry} period={m.period} animate={animate}>
              <rect x="124" y="222" width="24" height="21" fill={darker} transform={widen(136, P.legs)} />
              <Joint x={136} y={241} k={m.rk} period={m.period} animate={animate}>
                <rect x="124" y="240" width="24" height="20" fill={darker} transform={widen(136, P.legs)} />
                <rect x="120" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
                <rect x="120" y="266" width="34" height="5" fill={accent} />
                <Footwear sport={t.sport} dx={38} accent={accent} />
              </Joint>
            </Joint>

            {/* body (width follows the body type) */}
            <g transform={widen(117, P.torso)}>
              <polygon points="154,158 170,146 170,210 154,222" fill={dark} />
              <rect x="80" y="158" width="74" height="64" fill={base} />
              <polygon points="80,158 96,146 170,146 154,158" fill={light} />
              <PhysiqueDetail physique={t.physique} cx={117} y={158} skin={shade(base, 0.12)} />
              {t.accessory === "none" && <rect x="112" y="178" width="10" height="10" fill={PULSE} className="animate-pulse-glow" />}
              <FanKitLayer kit={FAN_KITS[t.fan]} />
              <Accessory accessory={t.accessory} accent={accent} bib={clampBib(t.bib)} />
            </g>

            <SportProp sport={t.sport} accent={accent} animate={animate} motion={m} />

            {/* head, with hair behind and on top */}
            <HairBack hair={t.hair} accent={accent} animate={animate} />
            <polygon points="172,60 190,44 190,140 172,156" fill={dark} />
            <rect x="60" y="60" width="112" height="96" fill={base} />
            <polygon points="60,60 78,44 190,44 172,60" fill={light} />
            <HairFront hair={t.hair} accent={accent} />

            {/* VV headband: the knot draws a tiny W; the tails flutter when moving */}
            <rect x="60" y="72" width="112" height="13" fill={accent} />
            <polygon points="172,72 190,56 190,69 172,85" fill={shade(accent, -0.3)} />
            <path d="M136 75.5 l4 7 l4 -7 l4 7 l4 -7" stroke={INK} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <g className={animate && m.flutter ? "vv-flutter" : undefined}>
              <polygon points="190,60 204,70 198,74" fill={accent} />
              <polygon points="190,64 202,80 195,82" fill={shade(accent, -0.2)} />
            </g>

            <g
              className={animate && blinks ? "vv-blink" : undefined}
              style={animate && blinks ? { animationDelay: `-${blinkDelay}s` } : undefined}
            >
              <Eyes eyes={t.eyes} color={VVAKER_EYE_COLORS[t.eyeColor]} />
            </g>
            <Scar scar={t.scar} />
            <Fade keys={m.strain ? mapKeys(m.strain, (v) => 0.75 + v * 0.25) : undefined} period={m.period} animate={animate}>
              <rect x="68" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={m.strain ? undefined : 0.75} />
              <rect x="150" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={m.strain ? undefined : 0.75} />
            </Fade>
            <FaceTattoo tattoo={t.tattoo} />
            <Facial facial={t.facial} />
            {/* breathing: the trait mouth hands over to an open "o" at effort peaks */}
            <Fade keys={animate && m.mouth ? mapKeys(m.mouth, (v) => 1 - v) : undefined} period={m.period} animate={animate}>
              <Mouth mouth={t.mouth} />
            </Fade>
            {animate && m.mouth && (
              <Fade keys={m.mouth} period={m.period} animate>
                <ellipse cx="116" cy="137" rx="6" ry="7" fill={INK} />
              </Fade>
            )}
            <Piercing piercing={t.piercing} />

            <Headgear headgear={t.headgear} accent={accent} />

            {/* arms: shoulder → upper arm → elbow → forearm + hand; the watch stays on the left wrist */}
            <Spin on={animate && !!m.armSpin} x={69} y={164} period={m.period}>
              <Joint x={69} y={164} k={m.ls} period={m.period} animate={animate}>
                <g transform={widen(69, P.arms)}>
                  <rect x="60" y="162" width="18" height="25" fill={base} />
                  <ArmTattoo tattoo={t.tattoo} part="upper-left" accent={accent} />
                </g>
                <Joint x={69} y={186} k={m.le} period={m.period} animate={animate}>
                  <g transform={widen(69, P.arms)}>
                    <rect x="60" y="184" width="18" height="24" fill={base} />
                    <ArmTattoo tattoo={t.tattoo} part="fore-left" accent={accent} />
                  </g>
                  <rect x="60" y="206" width="18" height="14" fill={light} />
                  <rect x="55" y="190" width="28" height="15" rx="3" fill={VOLT} opacity={0.22} />
                  <rect x="57" y="192" width="24" height="11" rx="2" fill={INK} stroke={VOLT} strokeWidth={1.5} />
                  <path d="M60 198 h4 l2 -3 l2 6 l2 -3 h6" stroke={VOLT} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
                  <HandProp sport={t.sport} side="left" />
                </Joint>
              </Joint>
            </Spin>
            <Spin on={animate && !!m.armSpin} x={181} y={162} period={m.period} late>
              <Joint x={181} y={162} k={m.rs} period={m.period} animate={animate}>
                <rect x="172" y="160" width="18" height="25" fill={dark} transform={widen(181, P.arms)} />
                <Joint x={181} y={184} k={m.re} period={m.period} animate={animate}>
                  <g transform={widen(181, P.arms)}>
                    <rect x="172" y="182" width="18" height="24" fill={dark} />
                    <ArmTattoo tattoo={t.tattoo} part="fore-right" accent={accent} />
                  </g>
                  <rect x="172" y="204" width="18" height="14" fill={base} />
                  <HandProp sport={t.sport} side="right" accent={accent} />
                </Joint>
              </Joint>
            </Spin>
          </g>

          {animate && m.sweat && (
            <g fill="#8fd3ff" stroke={OUTLINE} strokeWidth={1.2}>
              <path d="M196 96 q5 8 0 11 q-5 -3 0 -11 Z" className="vv-sweat" />
              <path d="M52 108 q5 8 0 11 q-5 -3 0 -11 Z" className="vv-sweat" style={{ animationDelay: "-0.6s" }} />
            </g>
          )}
        </Joint>
      </g>

      <Front sport={t.sport} m={m} animate={animate} />

      {t.eyes === "sleepy" && (
        <path d="M200 30 h10 l-10 12 h10 M214 16 h7 l-7 8 h7" stroke={CALM} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const still = (k: Keys) => k.every((v) => v === k[0]);
const mapKeys = (k: Keys, f: (v: number) => number): Keys => [f(k[0]), f(k[1]), f(k[2]), f(k[3])];

/**
 * A joint: the static pose (key 0) is plain SVG, so exports and still frames keep it; when animated,
 * a CSS 4-key cycle rotates (and lifts) the group around the same pivot, relative to that pose.
 */
export function Joint({
  x,
  y,
  k,
  lift,
  shift,
  period,
  animate,
  children,
}: {
  x: number;
  y: number;
  k?: Keys | undefined;
  lift?: Keys | undefined;
  shift?: Keys | undefined;
  period: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  const a0 = k?.[0] ?? 0;
  const y0 = lift?.[0] ?? 0;
  const x0 = shift?.[0] ?? 0;
  const moving = animate && ((k && !still(k)) || (lift && !still(lift)) || (shift && !still(shift)));
  const vars: Record<string, string> = {};
  if (moving) {
    for (let i = 0; i < 4; i++) {
      vars[`--r${i}`] = `${(k?.[i] ?? 0) - a0}deg`;
      vars[`--y${i}`] = `${(lift?.[i] ?? 0) - y0}px`;
      vars[`--x${i}`] = `${(shift?.[i] ?? 0) - x0}px`;
    }
  }
  const transform = [x0 || y0 ? `translate(${x0} ${y0})` : "", a0 ? `rotate(${a0} ${x} ${y})` : ""].join(" ").trim();
  return (
    <g transform={transform || undefined}>
      {moving ? (
        <g className="vv-key" style={{ transformOrigin: `${x}px ${y}px`, animationDuration: `${period}s`, ...vars } as React.CSSProperties}>
          {children}
        </g>
      ) : (
        children
      )}
    </g>
  );
}

/** Full turns around a shoulder (front crawl). `late` runs half a cycle behind. */
function Spin({
  on,
  x,
  y,
  period,
  late,
  children,
}: {
  on: boolean;
  x: number;
  y: number;
  period: number;
  late?: boolean;
  children: React.ReactNode;
}) {
  if (!on) return <>{children}</>;
  return (
    <g
      className="vv-spin"
      style={{ transformOrigin: `${x}px ${y}px`, animationDuration: `${period}s`, animationDelay: late ? `-${period / 2}s` : undefined }}
    >
      {children}
    </g>
  );
}

/** Opacity on the same 4-key cycle (breathing mouth, effort blush). */
export function Fade({
  keys,
  period,
  animate,
  children,
}: {
  keys?: Keys | undefined;
  period: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  if (!animate || !keys || still(keys)) return <g opacity={keys && !animate ? keys[0] : undefined}>{children}</g>;
  const vars: Record<string, string> = {};
  keys.forEach((v, i) => (vars[`--o${i}`] = String(v)));
  return (
    <g className="vv-fade" style={{ animationDuration: `${period}s`, ...vars } as React.CSSProperties}>
      {children}
    </g>
  );
}

/** Things held in a hand move with that arm. */
export function HandProp({ sport, side, accent = VOLT }: { sport: VVakerTraits["sport"]; side: "left" | "right"; accent?: string }) {
  if (sport === "boxer") {
    return side === "left" ? (
      <g>
        <rect x="54" y="200" width="30" height="26" rx="10" fill="#e0364f" />
        <rect x="56" y="220" width="26" height="6" fill="#f4f5f6" />
      </g>
    ) : (
      <g>
        <rect x="166" y="198" width="30" height="26" rx="10" fill="#b82a40" />
        <rect x="168" y="218" width="26" height="6" fill="#f4f5f6" />
      </g>
    );
  }
  if (sport === "hiker" || sport === "skier") {
    return side === "left" ? (
      <g>
        <path d="M66 210 L50 288" stroke="#3a4047" strokeWidth={4} strokeLinecap="round" />
        <circle cx="50" cy="286" r="4" fill={VOLT} />
      </g>
    ) : (
      <g>
        <path d="M184 208 L198 288" stroke="#3a4047" strokeWidth={4} strokeLinecap="round" />
        <circle cx="198" cy="286" r="4" fill={VOLT} />
      </g>
    );
  }
  if (side === "left") return null;
  switch (sport) {
    case "racket":
      return (
        <g>
          <rect x="177" y="212" width="8" height="22" rx="3" fill="#2b3036" />
          <ellipse cx="181" cy="254" rx="16" ry="21" fill="none" stroke={accent} strokeWidth={5} />
          <path d="M170 244 H192 M168 254 H194 M170 264 H192 M176 236 V272 M186 236 V272" stroke="#dfe6ee" strokeWidth={1} />
        </g>
      );
    case "lifter":
      return (
        <g>
          <path d="M172 214 Q181 196 190 214" stroke="#3a4047" strokeWidth={6} fill="none" />
          <circle cx="181" cy="234" r="19" fill="#2b3036" />
          <rect x="170" y="224" width="7" height="7" fill="#4a525b" />
          <rect x="174" y="236" width="14" height="6" fill={accent} />
        </g>
      );
    case "walker":
      return (
        <g>
          <rect x="174" y="198" width="14" height="30" rx="4" fill="#7fb6f5" />
          <rect x="176" y="192" width="10" height="7" rx="2" fill="#eef0f2" />
          <rect x="176" y="206" width="10" height="4" fill="#fff" opacity={0.6} stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

export function Eyes({ eyes, color = INK }: { eyes: VVakerTraits["eyes"]; color?: string }) {
  const line = color === INK ? INK : shade(color, -0.15);
  switch (eyes) {
    case "happy":
      return (
        <g stroke={line} strokeWidth={5} strokeLinecap="round" fill="none">
          <path d="M80 114 Q90 100 100 114" />
          <path d="M132 114 Q142 100 152 114" />
        </g>
      );
    case "fired":
      return (
        <g stroke={line} strokeWidth={6} strokeLinecap="square" fill="none">
          <path d="M80 100 L98 110 L80 120" />
          <path d="M152 100 L134 110 L152 120" />
        </g>
      );
    case "sleepy":
      return (
        <g stroke={line} strokeWidth={6} strokeLinecap="square">
          <path d="M80 112 H100" />
          <path d="M132 112 H152" />
        </g>
      );
    case "visor":
      return (
        <g>
          <path d="M70 98 H164 L160 120 Q116 128 74 120 Z" fill="#1d2330" />
          <path d="M84 104 L100 104 L94 114 Z" fill="#fff" opacity={0.55} stroke="none" />
          <path d="M112 104 H152" stroke={VOLT} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          <polygon points="172,98 190,84 190,104 172,118" fill="#10141c" />
        </g>
      );
    case "star":
      return (
        <g fill={GOLD}>
          <Star cx={90} cy={109} r={13} />
          <Star cx={142} cy={109} r={13} />
        </g>
      );
    default:
      return (
        <g>
          <rect x="78" y="96" width="24" height="24" rx="3" fill="#fff" />
          <rect x="130" y="96" width="24" height="24" rx="3" fill="#fff" />
          <rect x="88" y="100" width="11" height="12" fill={color} />
          <rect x="140" y="100" width="11" height="12" fill={color} />
          <rect x="92" y="101" width="4" height="4" fill="#fff" stroke="none" />
          <rect x="144" y="101" width="4" height="4" fill="#fff" stroke="none" />
        </g>
      );
  }
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
  return <polygon points={points} />;
}

export function Mouth({ mouth }: { mouth: VVakerTraits["mouth"] }) {
  switch (mouth) {
    case "grin":
      return <path d="M104 132 H128 V138 Q116 150 104 138 Z" fill={INK} />;
    case "calm":
      return <path d="M108 134 Q116 140 124 134" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />;
    case "o":
      return <rect x="111" y="132" width="10" height="10" rx="5" fill={INK} />;
    case "teeth":
      return (
        <g>
          <rect x="100" y="131" width="32" height="12" rx="2" fill="#fff" />
          <path d="M108 131 V143 M116 131 V143 M124 131 V143 M100 137 H132" stroke={INK} strokeWidth={1.6} />
        </g>
      );
    default:
      return <path d="M102 132 Q116 145 130 132" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />;
  }
}

export function Headgear({ headgear, accent }: { headgear: VVakerTraits["headgear"]; accent: string }) {
  switch (headgear) {
    case "cap":
      return (
        <g>
          <polygon points="60,60 78,40 190,40 172,60" fill={accent} />
          <rect x="60" y="52" width="112" height="10" fill={shade(accent, -0.18)} />
          <polygon points="172,62 190,44 190,54 172,72" fill={shade(accent, -0.35)} />
          <polygon points="60,60 36,70 118,70 132,60" fill={shade(accent, -0.1)} />
          <rect x="118" y="44" width="10" height="6" fill={VOLT} />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M58 70 V52 Q58 34 80 32 H168 Q190 34 190 52 V60 L172 76 V70 Z" fill={CALM} />
          <rect x="58" y="62" width="114" height="12" fill={shade(CALM, -0.2)} />
          <g stroke={shade(CALM, -0.3)} strokeWidth={2}>
            {[72, 88, 104, 120, 136, 152].map((x) => (
              <path key={x} d={`M${x} 62 V74`} />
            ))}
          </g>
          <rect x="114" y="18" width="16" height="16" rx="3" fill={VOLT} />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M54 104 V70 Q54 28 116 26 Q182 28 186 70 V104" stroke="#2b3036" strokeWidth={9} fill="none" />
          <rect x="44" y="90" width="18" height="34" rx="4" fill={accent} />
          <rect x="180" y="84" width="18" height="34" rx="4" fill={shade(accent, -0.25)} />
          <rect x="48" y="96" width="4" height="22" fill={VOLT} opacity={0.8} stroke="none" />
        </g>
      );
    case "helmet":
      return (
        <g>
          <path d="M54 66 Q54 26 116 22 Q184 24 194 60 L186 70 Z" fill={accent} />
          <g stroke={shade(accent, -0.4)} strokeWidth={3} strokeLinecap="round">
            <path d="M92 34 L100 56" />
            <path d="M118 30 V54" />
            <path d="M144 32 L138 56" />
          </g>
          <path d="M60 66 H176" stroke={OUTLINE} strokeWidth={3} />
          <path d="M66 70 L74 134 M166 70 L160 134" stroke="#2b3036" strokeWidth={2.5} />
        </g>
      );
    default:
      return null;
  }
}

export function Accessory({ accessory, accent, bib }: { accessory: VVakerTraits["accessory"]; accent: string; bib: number }) {
  switch (accessory) {
    case "medal":
      return (
        <g>
          <path d="M100 158 L117 186 L134 158" stroke={accent} strokeWidth={6} fill="none" strokeLinejoin="miter" />
          <circle cx="117" cy="194" r="12" fill={GOLD} />
          <Star cx={117} cy={194} r={6} />
        </g>
      );
    case "towel":
      return (
        <g>
          <path d="M82 150 H152 V166 H82 Z" fill="#f4f5f6" />
          <rect x="132" y="162" width="16" height="40" rx="2" fill="#f4f5f6" />
          <path d="M132 190 H148" stroke={accent} strokeWidth={3} />
        </g>
      );
    case "bib":
      return (
        <g>
          <rect x="96" y="172" width="42" height="34" rx="3" fill="#fbfbfb" />
          <rect x="96" y="172" width="42" height="7" fill={accent} />
          <text
            x="117"
            y="200"
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, Consolas, monospace"
            fontWeight={700}
            fontSize={17}
            fill={INK}
            stroke="none"
          >
            {String(bib).padStart(2, "0")}
          </text>
        </g>
      );
    default:
      return null;
  }
}

export function SportProp({
  sport,
  accent,
  animate,
  motion,
}: {
  sport: VVakerTraits["sport"];
  accent: string;
  animate: boolean;
  motion: Motion;
}) {
  switch (sport) {
    case "yogi":
      return <polygon points="36,262 196,262 216,276 56,276" fill={accent} opacity={0.85} />;
    case "coder":
      return (
        <g>
          <polygon points="84,196 150,196 162,186 96,186" fill="#3a4047" />
          <rect x="84" y="196" width="66" height="34" rx="2" fill="#1d2125" stroke="#3a4047" strokeWidth={2} />
          <path
            d="M104 205 l-6 6 l6 6 M130 205 l6 6 l-6 6 M120 203 l-6 16"
            stroke={VOLT}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "baller":
      return (
        <g className={animate ? "vv-dribble" : undefined}>
          <circle cx="196" cy="246" r="17" fill="#f08a3c" />
          <path
            d="M179 246 H213 M196 229 V263 M184 234 Q196 246 184 258 M208 234 Q196 246 208 258"
            stroke="#9c4a14"
            strokeWidth={2}
            fill="none"
          />
        </g>
      );
    case "martial":
      return (
        <g>
          <path d="M100 158 L117 176 L134 158" stroke="#f4f5f6" strokeWidth={5} fill="none" />
          <rect x="80" y="196" width="74" height="9" fill="#15181b" />
          <rect x="112" y="204" width="6" height="16" fill="#15181b" />
          <rect x="120" y="204" width="6" height="13" fill="#15181b" />
        </g>
      );
    case "paddler":
      return (
        <g>
          {/* canoe hull: hides the legs, rocks with the paddler */}
          <path d="M-2 200 Q120 226 242 200 L232 226 Q120 252 8 226 Z" fill="#d9772b" />
          <path d="M-2 200 Q120 226 242 200" stroke="#f2b36b" strokeWidth={5} fill="none" />
          <path d="M12 214 Q120 238 228 214" stroke="#9a4c16" strokeWidth={2} fill="none" />
          <Joint x={122} y={180} k={motion.prop} period={motion.period} animate={animate}>
            <path d="M18 180 H226" stroke="#8a5a2b" strokeWidth={5} strokeLinecap="round" />
            <path d="M-4 172 Q10 166 22 172 V188 Q10 194 -4 188 Z" fill={accent} />
            <path d="M222 172 Q234 166 248 172 V188 Q234 194 222 188 Z" fill={accent} />
          </Joint>
        </g>
      );
    case "meditator":
      return (
        <g>
          <ellipse cx="120" cy="252" rx="62" ry="10" fill={shade(CALM, -0.2)} opacity={0.9} />
          <circle
            cx="120"
            cy="118"
            r="104"
            fill="none"
            stroke={CALM}
            strokeWidth={2}
            opacity={0.35}
            strokeDasharray="4 8"
            className={animate ? "vv-spin-slow" : undefined}
            style={{ transformOrigin: "120px 118px" }}
          />
        </g>
      );
    default:
      return null;
  }
}

export function FanKitLayer({ kit }: { kit: readonly [string, string] | null }) {
  if (!kit) return null;
  const [a, b] = kit;
  return (
    <g>
      <rect x="80" y="196" width="74" height="10" fill={a} />
      <rect x="80" y="206" width="74" height="4" fill={b} />
      <polygon points="154,196 170,184 170,198 154,210" fill={shade(a, -0.3)} />
      <path d="M78 150 H158 V162 H78 Z" fill={a} />
      {[86, 102, 118, 134, 150].map((x) => (
        <rect key={x} x={x} y="150" width="8" height="12" fill={b} stroke="none" />
      ))}
      <rect x="84" y="160" width="14" height="36" fill={a} />
      <rect x="84" y="172" width="14" height="6" fill={b} stroke="none" />
      <rect x="84" y="186" width="14" height="6" fill={b} stroke="none" />
    </g>
  );
}

/** Background of the sport's scene: track, bike, heavy bag, ice. */
export function Scene({ sport, m, animate }: { sport: VVakerTraits["sport"]; m: Motion; animate: boolean }) {
  const track = (
    <path d="M-20 290 H260" stroke="#3a4047" strokeWidth={3} strokeDasharray="16 12" className={animate ? "vv-dash" : undefined} />
  );
  switch (sport) {
    case "runner":
    case "roller":
      return track;
    case "cyclist":
      return (
        <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
          {track}
          {[44, 198].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={256} r={28} fill="none" stroke="#2b3036" strokeWidth={6} />
              <g
                className={animate ? "vv-spin" : undefined}
                style={{ transformOrigin: `${cx}px 256px` }}
                stroke="#8a929b"
                strokeWidth={1.6}
              >
                <path d={`M${cx} 230 V282 M${cx - 26} 256 H${cx + 26} M${cx - 18} 238 L${cx + 18} 274 M${cx + 18} 238 L${cx - 18} 274`} />
              </g>
              <circle cx={cx} cy={256} r={4} fill={VOLT} />
            </g>
          ))}
          {/* frame, saddle, bars */}
          <path
            d="M44 256 L100 226 L124 258 Z M100 226 L176 214 L124 258 M176 214 L198 256 M176 214 L184 200 M176 200 H196"
            stroke={PULSE}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
          <rect x="86" y="216" width="30" height="8" rx="3" fill="#2b3036" />
          <g className={animate ? "vv-spin" : undefined} style={{ transformOrigin: "124px 258px", animationDuration: `${m.period}s` }}>
            <path d="M124 242 V274" stroke="#2b3036" strokeWidth={4} strokeLinecap="round" />
            <rect x="116" y="238" width="16" height="5" rx="2" fill="#8a929b" />
            <rect x="116" y="273" width="16" height="5" rx="2" fill="#8a929b" />
          </g>
        </g>
      );
    case "boxer":
      return (
        <Joint x={214} y={0} k={m.bag} period={m.period} animate={animate}>
          <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            <path d="M214 0 V70" stroke="#8a929b" strokeWidth={3} strokeDasharray="5 3" />
            <rect x="194" y="66" width="40" height="150" rx="12" fill="#7a2330" />
            <rect x="194" y="96" width="40" height="10" fill="#f4f5f6" />
            <rect x="194" y="186" width="40" height="10" fill="#f4f5f6" />
            <rect x="228" y="70" width="6" height="140" rx="3" fill="#5a1822" stroke="none" />
          </g>
        </Joint>
      );
    case "hiker":
      return (
        <g stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round">
          <polygon points="-10,236 60,120 130,236" fill="#2f3a46" />
          <polygon points="60,120 44,146 60,140 76,146" fill="#eef0f2" />
          <polygon points="80,236 170,84 260,236" fill="#3b4755" />
          <polygon points="170,84 150,116 170,108 190,116" fill="#eef0f2" />
          <path d="M-10 292 Q120 262 250 250" stroke="#8a6a4a" strokeWidth={6} fill="none" />
        </g>
      );
    case "climber":
      return (
        <g stroke={OUTLINE} strokeWidth={2}>
          <rect x="18" y="14" width="204" height="276" rx="10" fill="#6b4f3a" />
          {[
            [40, 40, PULSE],
            [96, 30, VOLT],
            [180, 48, "#7fb6f5"],
            [30, 120, "#7fe0c8"],
            [210, 110, PULSE],
            [44, 200, VOLT],
            [200, 190, "#f5c542"],
            [120, 20, "#b9a7f5"],
            [210, 256, "#7fe0c8"],
            [30, 260, "#f5c542"],
          ].map(([x, y, c]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y} q8 -8 14 0 q2 8 -6 10 q-10 0 -8 -10 Z`} fill={c as string} />
          ))}
        </g>
      );
    case "racket":
      return (
        <g>
          <polygon points="-20,300 30,228 210,228 260,300" fill="#2f7d5b" opacity={0.85} />
          <path d="M30 228 L-20 300 M210 228 L260 300 M10 256 H230" stroke="#eef0f2" strokeWidth={2.5} opacity={0.8} />
          <path d="M6 210 H234" stroke="#dfe6ee" strokeWidth={2} strokeDasharray="3 3" opacity={0.6} />
        </g>
      );
    case "dancer":
      return (
        <g opacity={0.9}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={(i % 6) * 40}
              y={i < 6 ? 252 : 276}
              width="40"
              height="24"
              fill={[PULSE, VOLT, "#7fb6f5", "#b9a7f5", "#7fe0c8", "#f5c542"][(i + (i < 6 ? 0 : 3)) % 6]}
              opacity={0.35}
              className={animate ? "animate-pulse-glow" : undefined}
              style={animate ? { animationDelay: `-${(i * 0.37) % 2}s` } : undefined}
            />
          ))}
        </g>
      );
    case "skier":
      return (
        <g stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round">
          <polygon points="-10,300 -10,236 250,196 250,300" fill="#eef4fa" />
          {[
            [26, 214, 22],
            [206, 176, 26],
            [224, 196, 18],
          ].map(([x, y, h]) => (
            <g key={x}>
              <polygon points={`${x},${y - h} ${x - 12},${y + 6} ${x + 12},${y + 6}`} fill="#2f7d5b" />
              <rect x={x - 2} y={y + 6} width="4" height="6" fill="#6b4f3a" />
            </g>
          ))}
        </g>
      );
    case "footballer":
      return (
        <g>
          <ellipse cx="120" cy="286" rx="124" ry="18" fill="#2f7d5b" opacity={0.7} />
          <path d="M20 280 l3 -8 l3 8 M200 284 l3 -8 l3 8 M60 292 l3 -8 l3 8" stroke="#7fe0a0" strokeWidth={2} fill="none" />
        </g>
      );
    case "skater":
      return (
        <g>
          <ellipse cx="120" cy="282" rx="118" ry="16" fill="#dff4ff" opacity={0.28} />
          <path
            d="M20 284 Q70 272 120 284 T220 282 M40 292 Q100 282 160 292"
            stroke="#dff4ff"
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
        </g>
      );
    default:
      return null;
  }
}

function Burst({ x, y, text, fill = VOLT }: { x: number; y: number; text?: string; fill?: string }) {
  const points = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? 24 : 11;
    const a = (Math.PI / 8) * i;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={points} fill={fill} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
      {text && (
        <text x={x} y={y + 4} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontWeight={800} fontSize={11} fill={INK}>
          {text}
        </text>
      )}
    </g>
  );
}

/** Foreground of the scene: water, impacts, splashes, dust, sparkles. Only while animating, except water. */
export function Front({ sport, m, animate }: { sport: VVakerTraits["sport"]; m: Motion; animate: boolean }) {
  switch (sport) {
    case "paddler":
      return (
        <g>
          <rect x="0" y="264" width="240" height="36" fill="#1f6fb8" opacity={0.92} />
          <g className={animate ? "vv-wave" : undefined}>
            <path
              d="M-40 266 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
              stroke="#8fd3ff"
              strokeWidth={3}
              fill="none"
            />
            <path
              d="M-20 284 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
              stroke="#5fb0ea"
              strokeWidth={2}
              fill="none"
              opacity={0.7}
            />
          </g>
          {animate && m.splashL && (
            <Fade keys={m.splashL} period={m.period} animate>
              <path d="M6 262 l-6 -14 M14 260 l0 -16 M22 262 l6 -13" stroke="#dff4ff" strokeWidth={3} strokeLinecap="round" />
            </Fade>
          )}
          {animate && m.splashR && (
            <Fade keys={m.splashR} period={m.period} animate>
              <path d="M218 262 l-6 -13 M226 260 l0 -16 M234 262 l6 -14" stroke="#dff4ff" strokeWidth={3} strokeLinecap="round" />
            </Fade>
          )}
        </g>
      );
    case "swimmer":
      return (
        <g>
          <rect x="0" y="222" width="240" height="78" fill="#1c8fd6" opacity={0.88} />
          <g className={animate ? "vv-wave" : undefined}>
            <path
              d="M-40 224 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
              stroke="#bfe9ff"
              strokeWidth={3}
              fill="none"
            />
          </g>
          {/* lane rope */}
          {Array.from({ length: 13 }, (_, i) => (
            <circle key={i} cx={6 + i * 19} cy={292} r={6} fill={i % 2 ? "#f4f5f6" : PULSE} stroke={OUTLINE} strokeWidth={1.5} />
          ))}
          <path d="M60 250 q8 -4 16 0 M150 262 q8 -4 16 0" stroke="#bfe9ff" strokeWidth={2} fill="none" opacity={0.6} />
          {animate && m.splashL && (
            <Fade keys={m.splashL} period={m.period} animate>
              <path d="M40 222 l-7 -14 M50 220 l0 -17 M60 222 l6 -13" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" />
            </Fade>
          )}
          {animate && m.splashR && (
            <Fade keys={m.splashR} period={m.period} animate>
              <path d="M180 222 l-6 -13 M190 220 l0 -17 M200 222 l7 -14" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" />
            </Fade>
          )}
        </g>
      );
    case "boxer":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <Burst x={200} y={150} text="POW" />
        </Fade>
      ) : null;
    case "martial":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <Burst x={208} y={112} text="HAI!" fill="#f4f5f6" />
        </Fade>
      ) : null;
    case "runner":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <g fill="#8a929b" opacity={0.7}>
            <circle cx="78" cy="280" r="6" />
            <circle cx="66" cy="276" r="4" />
            <circle cx="58" cy="282" r="3" />
          </g>
        </Fade>
      ) : null;
    case "climber":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <g fill="#ffffff" opacity={0.7}>
            <circle cx="50" cy="96" r="7" />
            <circle cx="40" cy="88" r="4" />
            <circle cx="190" cy="100" r="6" />
            <circle cx="200" cy="90" r="3.5" />
          </g>
        </Fade>
      ) : null;
    case "racket":
      return (
        <Joint x={0} y={0} shift={m.ballX} lift={m.ballY} period={m.period} animate={animate}>
          <circle cx="226" cy="168" r="7" fill="#d9f24a" stroke={OUTLINE} strokeWidth={1.5} />
          <path d="M221 164 Q226 168 221 173" stroke="#ffffff" strokeWidth={1.2} fill="none" />
        </Joint>
      );
    case "dancer":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <g fill={VOLT} stroke={OUTLINE} strokeWidth={1.5}>
            <path d="M28 70 v-22 l14 -4 v22" fill="none" stroke={VOLT} strokeWidth={3} />
            <circle cx="24" cy="72" r="5" />
            <circle cx="38" cy="68" r="5" />
            <path d="M206 50 v-20" stroke={PULSE} strokeWidth={3} />
            <circle cx="202" cy="52" r="5" fill={PULSE} />
          </g>
        </Fade>
      ) : null;
    case "skier":
      return animate ? (
        <g fill="#ffffff">
          {m.splashL && (
            <Fade keys={m.splashL} period={m.period} animate>
              <circle cx="40" cy="270" r="5" />
              <circle cx="30" cy="262" r="3.5" />
              <circle cx="48" cy="258" r="3" />
            </Fade>
          )}
          {m.splashR && (
            <Fade keys={m.splashR} period={m.period} animate>
              <circle cx="196" cy="268" r="5" />
              <circle cx="206" cy="260" r="3.5" />
              <circle cx="188" cy="256" r="3" />
            </Fade>
          )}
        </g>
      ) : null;
    case "footballer":
      return (
        <Joint x={0} y={0} lift={m.ballY} period={m.period} animate={animate}>
          <circle cx="146" cy="252" r="13" fill="#f4f5f6" stroke={OUTLINE} strokeWidth={2} />
          <polygon points="146,245 152,250 150,257 142,257 140,250" fill={INK} />
        </Joint>
      );
    case "skater":
      return animate && m.burst ? (
        <Fade keys={m.burst} period={m.period} animate>
          <g fill="#ffffff">
            <Star cx={40} cy={270} r={5} />
            <Star cx={200} cy={266} r={4} />
            <Star cx={120} cy={292} r={3.5} />
          </g>
        </Fade>
      ) : null;
    default:
      return null;
  }
}

/** Skates ride on the shoe, so they move with the shin. `dx` shifts from the left to the right foot. */
export function Footwear({ sport, dx, accent }: { sport: VVakerTraits["sport"]; dx: number; accent: string }) {
  if (sport === "roller") {
    return (
      <g transform={dx ? `translate(${dx} 0)` : undefined}>
        <rect x="84" y="246" width="30" height="12" rx="2" fill={accent} />
        <rect x="80" y="270" width="38" height="4" fill="#2b3036" />
        {[88, 99, 110].map((cx) => (
          <circle key={cx} cx={cx} cy={277} r={4.5} fill={GOLD} />
        ))}
      </g>
    );
  }
  if (sport === "skier") {
    return (
      <g transform={dx ? `translate(${dx} 0)` : undefined}>
        <rect x="84" y="246" width="30" height="14" rx="2" fill="#2b3036" />
        <path d="M64 276 H132 Q140 276 138 268" stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (sport === "skater") {
    return (
      <g transform={dx ? `translate(${dx} 0)` : undefined}>
        <rect x="84" y="246" width="30" height="12" rx="2" fill="#f4f5f6" />
        <path d="M86 272 V277 M112 272 V277" stroke="#8a929b" strokeWidth={2} />
        <path d="M78 279 H118 Q122 279 120 274" stroke="#dfe6ee" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}
