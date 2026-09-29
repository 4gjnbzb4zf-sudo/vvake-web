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
      <svg width="104" height="120" viewBox="0 0 40 46" fill="none">
        <g stroke="#ff3d6e" strokeWidth="6" strokeLinecap="round">
          <path d="M14 34 L5.5 13" />
          <path d="M20 33 L20 9" />
          <path d="M26 34 L34.5 13" />
        </g>
        <path d="M11.5 30 Q11 43 20 43 Q29 43 28.5 30 Z" fill="#ff3d6e" />
        <circle cx="20" cy="3" r="2.8" fill="#ccff00" />
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
