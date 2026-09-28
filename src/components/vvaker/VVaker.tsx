import { shade } from "@/lib/color";
import { VVAKER_COLORS, type VVakerTraits } from "./traits";

const INK = "#15181b";
const PULSE = "#ff3d6e";
const VOLT = "#ccff00";
const CALM = "#8b87d9";
const ENERGY_COLORS = [PULSE, "#ff7a9a", "#e8ff7a", VOLT] as const;

interface VVakerProps extends VVakerTraits {
  /** Accessible label. Omit for decorative use. */
  title?: string;
  className?: string;
}

/**
 * A VVaker: a voxel athlete built from three-face boxes (front, top, side) for a toy-like 3D read.
 * Signature elements: floating energy bar, VV headband (a tiny W), glowing watch, square-pixel eyes.
 * Pure SVG with no filters or fonts, so it rasterises identically to PNG in every browser.
 */
export function VVaker({ color, sport, headgear, mood, energy, title, className }: VVakerProps) {
  const base = VVAKER_COLORS[color];
  const light = shade(base, 0.38);
  const dark = shade(base, -0.28);
  const darker = shade(base, -0.45);
  const filled = Math.max(0, Math.min(4, Math.round(energy)));

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

      {sport === "runner" && (
        <g stroke={light} strokeWidth={5} strokeLinecap="round" opacity={0.7}>
          <path d="M22 176 H46" />
          <path d="M14 192 H44" />
          <path d="M26 208 H48" />
        </g>
      )}

      {/* legs + shoes */}
      <rect x="88" y="222" width="24" height="38" fill={darker} />
      <rect x="124" y="222" width="24" height="38" fill={darker} />
      <rect x="82" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
      <rect x="120" y="256" width="34" height="14" rx="2" fill="#eef0f2" />
      <rect x="82" y="266" width="34" height="5" fill={sport === "runner" ? VOLT : PULSE} />
      <rect x="120" y="266" width="34" height="5" fill={sport === "runner" ? VOLT : PULSE} />

      {/* body */}
      <polygon points="154,158 170,146 170,210 154,222" fill={dark} />
      <rect x="80" y="158" width="74" height="64" fill={base} />
      <polygon points="80,158 96,146 170,146 154,158" fill={light} />
      <rect x="112" y="178" width="10" height="10" fill={PULSE} className="animate-pulse-glow" />

      {/* arms */}
      <rect x="60" y="162" width="18" height="46" fill={base} />
      <rect x="60" y="206" width="18" height="14" fill={light} />
      <rect x="172" y="160" width="18" height="46" fill={dark} />
      <rect x="172" y="204" width="18" height="14" fill={base} />

      {/* watch */}
      <rect x="55" y="190" width="28" height="15" rx="3" fill={VOLT} opacity={0.22} />
      <rect x="57" y="192" width="24" height="11" rx="2" fill={INK} stroke={VOLT} strokeWidth={1.5} />
      <path d="M60 198 h4 l2 -3 l2 6 l2 -3 h6" stroke={VOLT} strokeWidth={1.4} fill="none" strokeLinejoin="round" />

      <SportProp sport={sport} />

      {/* head */}
      <polygon points="172,60 190,44 190,140 172,156" fill={dark} />
      <rect x="60" y="60" width="112" height="96" fill={base} />
      <polygon points="60,60 78,44 190,44 172,60" fill={light} />

      {/* VV headband: the knot draws a tiny W */}
      <rect x="60" y="72" width="112" height="13" fill={PULSE} />
      <polygon points="172,72 190,56 190,69 172,85" fill={shade(PULSE, -0.3)} />
      <path d="M136 75.5 l4 7 l4 -7 l4 7 l4 -7" stroke={INK} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <polygon points="190,60 204,70 198,74" fill={PULSE} />
      <polygon points="190,64 202,80 195,82" fill={shade(PULSE, -0.2)} />

      <Face mood={mood} blush={shade(PULSE, 0.45)} />

      <Headgear headgear={headgear} />

      {mood === "sleepy" && (
        <path d="M200 30 h10 l-10 12 h10 M214 16 h7 l-7 8 h7" stroke={CALM} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function Face({ mood, blush }: { mood: VVakerTraits["mood"]; blush: string }) {
  const eyes = (() => {
    switch (mood) {
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
      case "zen":
        return (
          <g stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none">
            <path d="M80 108 Q90 118 100 108" />
            <path d="M132 108 Q142 118 152 108" />
          </g>
        );
      default:
        return (
          <g>
            <rect x="78" y="96" width="24" height="24" rx="3" fill="#fff" />
            <rect x="130" y="96" width="24" height="24" rx="3" fill="#fff" />
            <rect x="88" y="100" width="11" height="12" fill={INK} />
            <rect x="140" y="100" width="11" height="12" fill={INK} />
            <rect x="92" y="101" width="4" height="4" fill="#fff" />
            <rect x="144" y="101" width="4" height="4" fill="#fff" />
          </g>
        );
    }
  })();

  const mouth = (() => {
    switch (mood) {
      case "fired":
        return <path d="M104 132 H128 V138 Q116 150 104 138 Z" fill={INK} />;
      case "sleepy":
        return <rect x="112" y="134" width="8" height="8" rx="4" fill={INK} />;
      case "zen":
        return <path d="M108 134 Q116 140 124 134" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />;
      default:
        return <path d="M102 132 Q116 145 130 132" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />;
    }
  })();

  return (
    <g>
      {eyes}
      <rect x="68" y="126" width="14" height="8" fill={blush} opacity={0.75} />
      <rect x="150" y="126" width="14" height="8" fill={blush} opacity={0.75} />
      {mouth}
    </g>
  );
}

function Headgear({ headgear }: { headgear: VVakerTraits["headgear"] }) {
  switch (headgear) {
    case "cap":
      return (
        <g>
          <polygon points="60,60 78,40 190,40 172,60" fill={PULSE} />
          <rect x="60" y="52" width="112" height="10" fill={shade(PULSE, -0.18)} />
          <polygon points="172,62 190,44 190,54 172,72" fill={shade(PULSE, -0.35)} />
          <polygon points="60,60 36,70 118,70 132,60" fill={shade(PULSE, -0.1)} />
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
          <rect x="44" y="90" width="18" height="34" rx="4" fill={PULSE} />
          <rect x="180" y="84" width="18" height="34" rx="4" fill={shade(PULSE, -0.25)} />
          <rect x="48" y="96" width="4" height="22" fill={VOLT} opacity={0.8} />
        </g>
      );
    default:
      return null;
  }
}

function SportProp({ sport }: { sport: VVakerTraits["sport"] }) {
  switch (sport) {
    case "lifter":
      return (
        <g>
          <path d="M172 214 Q181 196 190 214" stroke="#3a4047" strokeWidth={6} fill="none" />
          <circle cx="181" cy="234" r="19" fill="#2b3036" />
          <rect x="170" y="224" width="7" height="7" fill="#4a525b" />
          <rect x="174" y="236" width="14" height="6" fill={PULSE} />
        </g>
      );
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
        <g>
          <circle cx="190" cy="226" r="17" fill="#f08a3c" />
          <path
            d="M173 226 H207 M190 209 V243 M178 214 Q190 226 178 238 M202 214 Q190 226 202 238"
            stroke="#9c4a14"
            strokeWidth={2}
            fill="none"
          />
        </g>
      );
    case "walker":
      return (
        <g>
          <rect x="174" y="198" width="14" height="30" rx="4" fill="#7fb6f5" />
          <rect x="176" y="192" width="10" height="7" rx="2" fill="#eef0f2" />
          <rect x="176" y="206" width="10" height="4" fill="#fff" opacity={0.6} />
        </g>
      );
    default:
      return null;
  }
}
