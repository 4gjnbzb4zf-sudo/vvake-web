import { HAND_DOT, HAND_PATH, HAND_TRANSFORM, HAND_VIEWBOX } from "../components/brand/handMark";
import type { Dictionary } from "@/i18n/dictionaries";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Social preview card, rendered to PNG by scripts/generate-og.tsx (satori subset of CSS). */
export function OgCard({ dict }: { dict: Dictionary }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "radial-gradient(ellipse at 20% 0%, rgba(255,61,110,0.35), transparent 55%), #0e1012",
        color: "#e6e9eb",
      }}
    >
      <svg width="69" height="120" viewBox={HAND_VIEWBOX}>
        <g transform={HAND_TRANSFORM} fill="#e6e9eb">
          <path d={HAND_PATH} />
        </g>
        <circle {...HAND_DOT} fill="#ccff00" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: 8 }}>VVAKE</div>
        <div style={{ fontSize: 44, color: "#ccff00", marginTop: 8 }}>{dict.unlock.success.campaign.join(" ")}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9aa1a6" }}>
        <span>{dict.benefits.title}</span>
        <span>{dict.hero.pronounce}</span>
      </div>
    </div>
  );
}
