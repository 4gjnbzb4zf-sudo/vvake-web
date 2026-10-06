import { HAND_DOT, HAND_PATH, HAND_TRANSFORM, HAND_VIEWBOX } from "../components/brand/handMark";
import type { Dictionary } from "@/i18n/dictionaries";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Social preview card, rendered to PNG by scripts/generate-og.tsx (satori subset of CSS). */
export function OgCard({
  dict,
  cast = [],
  challenge,
  invite,
  dare,
}: {
  dict: Dictionary;
  cast?: string[];
  challenge?: number;
  invite?: boolean;
  /** The "Beat me in 24 h" card of challenge links (/[lang]/c/). */
  dare?: boolean;
}) {
  // `invite`: the "Join me on VVake" card of invite links (/[lang]/r/), the same for every code.
  const c = dare
    ? { kicker: dict.challenge.ogKicker, title: dict.challenge.ogTitle, cta: dict.challenge.ogLine }
    : invite
      ? { kicker: dict.referral.ogKicker, title: dict.referral.ogTitle, cta: dict.referral.ogLine }
      : challenge === undefined
        ? undefined
        : dict.og.challenges[challenge % dict.og.challenges.length]!;
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
      {cast.length > 0 && (
        <div style={{ position: "absolute", right: 20, bottom: 0, display: "flex", alignItems: "flex-end" }}>
          {cast.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src.slice(-24)} src={src} alt="" height={i === 0 ? 560 : 530} style={{ marginLeft: i === 0 ? 0 : -70 }} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", fontSize: 28, color: "#9aa1a6" }}>vvake.com</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <svg width="112" height="196" viewBox={HAND_VIEWBOX} style={{ marginBottom: 22 }}>
            <g transform={HAND_TRANSFORM} fill="#e6e9eb">
              <path d={HAND_PATH} />
            </g>
            <circle {...HAND_DOT} fill="#ccff00" />
          </svg>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: 8, lineHeight: 1 }}>AKE</div>
        </div>
        <div style={{ fontSize: 38, color: "#ccff00", marginTop: 8 }}>{dict.unlock.success.campaign.join(" ")}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9aa1a6" }}>
        {c ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "18px 24px",
              borderRadius: 24,
              border: "2px solid rgba(204,255,0,0.45)",
              background: "rgba(23,26,29,0.92)",
              color: "#e6e9eb",
            }}
          >
            <span style={{ fontSize: 22, color: "#ccff00", letterSpacing: 2 }}>{c.kicker.toUpperCase()}</span>
            <span style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>{c.title}</span>
            <span style={{ fontSize: 22, color: "#9aa1a6", marginTop: 6 }}>{c.cta} →</span>
          </div>
        ) : (
          <span>{dict.benefits.title}</span>
        )}
      </div>
    </div>
  );
}
