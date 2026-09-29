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
      <svg width="220" height="119" viewBox="0 0 74 40" fill="none">
        <path
          d="M4 13 L13 34 L22 9 L31 34 L40 13 L45.5 23 L49.5 23 L53.5 11 L58 35 L62 23 L71 23"
          stroke="#ff3d6e"
          strokeWidth="5.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="3" r="2.6" fill="#ccff00" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: 8 }}>VVAKE</div>
        <div style={{ fontSize: 44, color: "#ccff00", marginTop: 8 }}>{dict.pulse.title}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9aa1a6" }}>
        <span>{dict.doubleV.title}</span>
        <span>{dict.hero.pronounce}</span>
      </div>
    </div>
  );
}
