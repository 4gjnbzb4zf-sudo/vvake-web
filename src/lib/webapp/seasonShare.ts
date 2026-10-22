import { PHASE_HEX, type Phase, type SeasonCard } from "./season";

/**
 * The season card as an image (1080 × 1350, a phone post): the goal, its date, the countdown, the phases bar with
 * today's place, readiness and the verdict. Nothing about health. Drawn on a canvas in the browser; the colours are the
 * app's (dark brand background in every theme, like the app's share cards).
 */
export interface CardWords {
  kicker: string;
  /** Next to the big number: "days to go". */
  daysUnit: string;
  readiness: string;
  footer: string;
}

export async function seasonCardImage(card: SeasonCard, w: CardWords): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  try {
    await document.fonts?.ready;
  } catch {
    // system fonts then
  }
  const font = (px: number, weight = 600) => `${weight} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  g.fillStyle = "#0e1012";
  g.fillRect(0, 0, W, H);
  // A soft glow in the brand's volt, top right.
  const glow = g.createRadialGradient(W - 120, 160, 20, W - 120, 160, 700);
  glow.addColorStop(0, "rgba(204,255,0,0.18)");
  glow.addColorStop(1, "rgba(204,255,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  const pad = 96;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ccff00";
  g.font = font(34, 700);
  g.fillText(w.kicker.toUpperCase(), pad, 170);

  g.fillStyle = "#e6e9eb";
  g.font = font(104, 800);
  wrap(g, card.title, pad, 300, W - pad * 2, 112, 2);
  if (card.subtitle) {
    g.fillStyle = "#9aa1a6";
    g.font = font(44, 500);
    g.fillText(card.subtitle, pad, 470);
  }

  if (card.countdown !== null && card.countdown !== undefined) {
    g.fillStyle = "#ccff00";
    g.font = font(200, 800);
    g.fillText(String(card.countdown), pad, 720);
    const numW = g.measureText(String(card.countdown)).width;
    g.fillStyle = "#e6e9eb";
    g.font = font(48, 600);
    g.fillText(w.daysUnit, pad + numW + 28, 720);
  }

  // The phases bar.
  const total = card.phases.reduce((t, p) => t + p.weeks, 0) || 1;
  const barY = 840;
  const barH = 64;
  const barW = W - pad * 2;
  let x = pad;
  for (const p of card.phases) {
    const pw = (p.weeks / total) * barW;
    g.fillStyle = PHASE_HEX[(p.phase as Phase) in PHASE_HEX ? (p.phase as Phase) : "base"];
    g.globalAlpha = p.current ? 1 : 0.75;
    round(g, x + 2, barY, Math.max(2, pw - 4), barH, 14);
    g.fill();
    g.globalAlpha = 1;
    if (pw > 150) {
      g.fillStyle = "#0e1012";
      g.font = font(28, 700);
      const label = p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label;
      g.fillText(label, x + 20, barY + 42);
    }
    x += pw;
  }
  // Today on the bar.
  const tx = pad + Math.max(0, Math.min(1, card.progress)) * barW;
  g.fillStyle = "#e6e9eb";
  round(g, tx - 4, barY - 24, 8, barH + 48, 4);
  g.fill();

  // The current phase, readiness, the verdict.
  const cur = card.phases.find((p) => p.current);
  let y = 1040;
  g.font = font(44, 600);
  if (cur) {
    g.fillStyle = "#e6e9eb";
    g.fillText(card.lines[0] ?? cur.label, pad, y);
    y += 70;
  }
  if (typeof card.readiness === "number") {
    g.fillStyle = "#7fe0c8";
    g.fillText(w.readiness.replace("{n}", String(card.readiness)) + (card.verdict ? ` · ${card.verdict}` : ""), pad, y);
  }

  g.fillStyle = "#80878d";
  g.font = font(32, 600);
  g.fillText(w.footer, pad, H - 96);
  g.fillStyle = "#e6e9eb";
  g.font = font(40, 800);
  const brand = "VVake";
  g.fillText(brand, W - pad - g.measureText(brand).width, H - 96);

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]!;
    if (g.measureText(test).width > maxW && line) {
      if (n === maxLines - 1) {
        g.fillText(`${line}…`, x, y + n * lineH);
        return;
      }
      g.fillText(line, x, y + n * lineH);
      n++;
      line = words[i]!;
    } else line = test;
  }
  g.fillText(line, x, y + n * lineH);
}
