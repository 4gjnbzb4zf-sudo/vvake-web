import { shade } from "@/lib/color";
import { DEFAULT_TRAITS, FAN_KITS, VVAKER_ACCENTS, VVAKER_COLORS, clampBib, type VVakerTraits } from "./traits";

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
  className?: string;
}

/**
 * A VVaker: a voxel athlete built from three-face boxes (front, top, side) for a toy-like 3D read.
 * Signature elements: floating energy bar, VV headband (a tiny W), glowing watch, square-pixel eyes.
 * Pure SVG with no filters or web fonts, so it rasterises identically to PNG in every browser.
 * Every trait is optional; missing ones fall back to DEFAULT_TRAITS.
 */
export function VVaker({ title, className, animate = true, ...partial }: VVakerProps) {
  const t: VVakerTraits = { ...DEFAULT_TRAITS, ...partial };
  const base = VVAKER_COLORS[t.color];
  const accent = VVAKER_ACCENTS[t.accent];
  const light = shade(base, 0.38);
  const dark = shade(base, -0.28);
  const darker = shade(base, -0.45);
  const filled = Math.max(0, Math.min(4, Math.round(t.energy)));
  const moving = t.sport === "runner" || t.sport === "cyclist";
  const pose = POSES[t.sport];

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
      <ellipse cx="122" cy="282" rx="70" ry="9" fill="#000" opacity="0.35" />

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

      <g transform={pose.drop ? `translate(0 ${pose.drop})` : undefined}>
        <g
          className={animate && pose.bob ? "vv-bob" : undefined}
          style={animate && pose.bob ? { animationDuration: `${pose.bob}s` } : undefined}
        >
          <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            {/* legs + shoes, pivoting at the hips */}
            <Limb x={100} y={222} angle={pose.ll} motion={animate ? pose.legs : undefined}>
              <rect x="88" y="222" width="24" height="38" fill={darker} />
              <rect x="82" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
              <rect x="82" y="266" width="34" height="5" fill={accent} />
            </Limb>
            <Limb x={136} y={222} angle={pose.rl} motion={animate ? pose.legs : undefined} opposite>
              <rect x="124" y="222" width="24" height="38" fill={darker} />
              <rect x="120" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
              <rect x="120" y="266" width="34" height="5" fill={accent} />
            </Limb>

            {/* body */}
            <polygon points="154,158 170,146 170,210 154,222" fill={dark} />
            <rect x="80" y="158" width="74" height="64" fill={base} />
            <polygon points="80,158 96,146 170,146 154,158" fill={light} />
            {t.accessory === "none" && <rect x="112" y="178" width="10" height="10" fill={PULSE} className="animate-pulse-glow" />}
            <FanKitLayer kit={FAN_KITS[t.fan]} />
            <Accessory accessory={t.accessory} accent={accent} bib={clampBib(t.bib)} />

            <SportProp sport={t.sport} accent={accent} animate={animate} />

            {/* head */}
            <polygon points="172,60 190,44 190,140 172,156" fill={dark} />
            <rect x="60" y="60" width="112" height="96" fill={base} />
            <polygon points="60,60 78,44 190,44 172,60" fill={light} />

            {/* VV headband: the knot draws a tiny W */}
            <rect x="60" y="72" width="112" height="13" fill={accent} />
            <polygon points="172,72 190,56 190,69 172,85" fill={shade(accent, -0.3)} />
            <path d="M136 75.5 l4 7 l4 -7 l4 7 l4 -7" stroke={INK} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <polygon points="190,60 204,70 198,74" fill={accent} />
            <polygon points="190,64 202,80 195,82" fill={shade(accent, -0.2)} />

            <Eyes eyes={t.eyes} />
            <rect x="68" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={0.75} />
            <rect x="150" y="126" width="14" height="8" fill={shade(PULSE, 0.45)} opacity={0.75} />
            <Mouth mouth={t.mouth} />

            <Headgear headgear={t.headgear} accent={accent} />
            {/* arms + hands, pivoting at the shoulders; the watch stays on the left wrist */}
            <Limb x={69} y={164} angle={pose.la} motion={animate ? pose.leftArm : undefined}>
              <rect x="60" y="162" width="18" height="46" fill={base} />
              <rect x="60" y="206" width="18" height="14" fill={light} />
              <rect x="55" y="190" width="28" height="15" rx="3" fill={VOLT} opacity={0.22} />
              <rect x="57" y="192" width="24" height="11" rx="2" fill={INK} stroke={VOLT} strokeWidth={1.5} />
              <path d="M60 198 h4 l2 -3 l2 6 l2 -3 h6" stroke={VOLT} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
              <HandProp sport={t.sport} side="left" />
            </Limb>
            <Limb x={181} y={162} angle={pose.ra} motion={animate ? pose.rightArm : undefined} opposite={pose.rightArmOpposite}>
              <rect x="172" y="160" width="18" height="46" fill={dark} />
              <rect x="172" y="204" width="18" height="14" fill={base} />
              <HandProp sport={t.sport} side="right" accent={accent} />
            </Limb>
          </g>
        </g>
      </g>

      {t.eyes === "sleepy" && (
        <path d="M200 30 h10 l-10 12 h10 M214 16 h7 l-7 8 h7" stroke={CALM} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** A swing between two angles (deg) around the limb's joint; `dur` is half a cycle in seconds. */
interface Motion {
  from: number;
  to: number;
  dur: number;
}
interface Pose {
  /** Static angles (deg, clockwise) for left/right arm and leg: this is what exports and still frames show. */
  la: number;
  ra: number;
  ll: number;
  rl: number;
  /** Moves the whole figure down (seated poses). */
  drop?: number;
  /** Body bounce, half-cycle seconds. */
  bob?: number;
  leftArm?: Motion;
  rightArm?: Motion;
  /** Right arm swings in counter-phase to the left (running, walking). */
  rightArmOpposite?: boolean;
  legs?: Motion;
}

const POSES: Record<VVakerTraits["sport"], Pose> = {
  runner: {
    la: 0,
    ra: 0,
    ll: 0,
    rl: 0,
    bob: 0.22,
    leftArm: { from: -30, to: 30, dur: 0.44 },
    rightArm: { from: -30, to: 30, dur: 0.44 },
    rightArmOpposite: true,
    legs: { from: -18, to: 18, dur: 0.44 },
  },
  walker: {
    la: 0,
    ra: 0,
    ll: 0,
    rl: 0,
    bob: 0.4,
    leftArm: { from: -12, to: 12, dur: 0.8 },
    rightArm: { from: -8, to: 8, dur: 0.8 },
    rightArmOpposite: true,
    legs: { from: -9, to: 9, dur: 0.8 },
  },
  cyclist: { la: -28, ra: -12, ll: 0, rl: 0, legs: { from: -14, to: 10, dur: 0.3 } },
  lifter: { la: 14, ra: 0, ll: 6, rl: -6, rightArm: { from: 0, to: -115, dur: 1.1 } },
  boxer: { la: -62, ra: 62, ll: 8, rl: -8, bob: 0.3, leftArm: { from: 0, to: -28, dur: 0.35 }, rightArm: { from: 0, to: 18, dur: 0.6 } },
  yogi: { la: 95, ra: -95, ll: 0, rl: -38, leftArm: { from: -5, to: 5, dur: 2.4 }, rightArm: { from: 5, to: -5, dur: 2.4 } },
  baller: { la: 20, ra: -14, ll: 6, rl: -6, bob: 0.28, rightArm: { from: 0, to: -16, dur: 0.28 } },
  coder: { la: -22, ra: 22, ll: 0, rl: 0, leftArm: { from: 0, to: -5, dur: 0.18 }, rightArm: { from: 0, to: 5, dur: 0.22 } },
  martial: { la: -40, ra: -90, ll: 12, rl: -12, rightArm: { from: 0, to: 50, dur: 0.5 } },
  paddler: { la: -30, ra: -38, ll: 0, rl: 0, leftArm: { from: -12, to: 12, dur: 1 }, rightArm: { from: -12, to: 12, dur: 1 } },
  meditator: { la: 28, ra: -28, ll: 78, rl: -78, drop: 22, bob: 2.4 },
};

/** A limb group: static pose via the SVG transform, optional CSS swing around the same joint. */
function Limb({
  x,
  y,
  angle,
  motion,
  opposite,
  children,
}: {
  x: number;
  y: number;
  angle: number;
  motion?: Motion | undefined;
  opposite?: boolean | undefined;
  children: React.ReactNode;
}) {
  const inner = motion ? (
    <g
      className="vv-swing"
      style={
        {
          transformOrigin: `${x}px ${y}px`,
          "--from": `${opposite ? motion.to : motion.from}deg`,
          "--to": `${opposite ? motion.from : motion.to}deg`,
          animationDuration: `${motion.dur}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </g>
  ) : (
    children
  );
  return angle ? <g transform={`rotate(${angle} ${x} ${y})`}>{inner}</g> : <g>{inner}</g>;
}

/** Things held in a hand move with that arm. */
function HandProp({ sport, side, accent = VOLT }: { sport: VVakerTraits["sport"]; side: "left" | "right"; accent?: string }) {
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
  if (side === "left") return null;
  switch (sport) {
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

function Eyes({ eyes }: { eyes: VVakerTraits["eyes"] }) {
  switch (eyes) {
    case "happy":
      return (
        <g stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none">
          <path d="M80 114 Q90 100 100 114" />
          <path d="M132 114 Q142 100 152 114" />
        </g>
      );
    case "fired":
      return (
        <g stroke={INK} strokeWidth={6} strokeLinecap="square" fill="none">
          <path d="M80 100 L98 110 L80 120" />
          <path d="M152 100 L134 110 L152 120" />
        </g>
      );
    case "sleepy":
      return (
        <g stroke={INK} strokeWidth={6} strokeLinecap="square">
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
          <rect x="88" y="100" width="11" height="12" fill={INK} />
          <rect x="140" y="100" width="11" height="12" fill={INK} />
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

function Mouth({ mouth }: { mouth: VVakerTraits["mouth"] }) {
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

function Headgear({ headgear, accent }: { headgear: VVakerTraits["headgear"]; accent: string }) {
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

function Accessory({ accessory, accent, bib }: { accessory: VVakerTraits["accessory"]; accent: string; bib: number }) {
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

function SportProp({ sport, accent, animate }: { sport: VVakerTraits["sport"]; accent: string; animate: boolean }) {
  switch (sport) {
    case "cyclist":
      return (
        <g>
          <circle cx="200" cy="246" r="22" fill="none" stroke="#2b3036" strokeWidth={5} />
          <g className={animate ? "vv-spin" : undefined} style={{ transformOrigin: "200px 246px" }} stroke="#6b7278" strokeWidth={1.6}>
            <path d="M200 226 V266 M180 246 H220 M186 232 L214 260 M214 232 L186 260" />
          </g>
          <circle cx="200" cy="246" r="4" fill={accent} />
        </g>
      );
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
        <g className={animate ? "vv-rock" : undefined} style={{ transformOrigin: "125px 198px" }}>
          <path d="M44 150 L206 246" stroke="#8a5a2b" strokeWidth={5} strokeLinecap="round" />
          <ellipse cx="40" cy="146" rx="9" ry="16" transform="rotate(-30 40 146)" fill={accent} />
          <ellipse cx="210" cy="250" rx="9" ry="16" transform="rotate(-30 210 250)" fill={accent} />
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

function FanKitLayer({ kit }: { kit: readonly [string, string] | null }) {
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
