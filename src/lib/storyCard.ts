/**
 * The post-signup story card (1080×1920, Instagram / TikTok stories): the campaign line, the player's
 * VVaker throwing the sign, their rank in their city and their invite code. Drawn in the browser.
 */
export interface StoryCard {
  lines: [string, string];
  rank: string;
  tier?: string;
  footer: string;
  personaSrc: string;
}

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Shrinks the font until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 4;
  } while (ctx.measureText(text).width > maxWidth && s > 24);
}

export async function renderStoryCard(card: StoryCard): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue("--font-unbounded").trim() || "sans-serif";
  const mono = css.getPropertyValue("--font-jetbrains").trim() || "monospace";
  await Promise.all([document.fonts.load(`700 100px ${display}`), document.fonts.load(`500 40px ${mono}`)]).catch(() => {});
  const img = await loadImage(card.personaSrc);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Stage: dark radial light, voxel grid, lime glow under the character.
  const bg = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, H * 0.75);
  bg.addColorStop(0, "#2b2f33");
  bg.addColorStop(1, "#0e1012");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(W / 2, 1440, 10, W / 2, 1440, 420);
  glow.addColorStop(0, "rgba(204,255,0,0.35)");
  glow.addColorStop(1, "rgba(204,255,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 1100, W, 700);

  // Wordmark + campaign line.
  ctx.textAlign = "center";
  ctx.fillStyle = "#e6e9eb";
  ctx.font = `700 56px ${display}`;
  ctx.fillText("VVAKE", W / 2, 150);
  fit(ctx, card.lines[0], 700, 104, display, W - 120);
  ctx.fillText(card.lines[0], W / 2, 330);
  ctx.fillStyle = "#ff3d6e";
  fit(ctx, card.lines[1], 700, 104, display, W - 120);
  ctx.fillText(card.lines[1], W / 2, 450);

  // The VVaker, feet on the glow.
  const ih = 940;
  const iw = ih * (img.naturalWidth / img.naturalHeight);
  ctx.drawImage(img, W / 2 - iw / 2, 1470 - ih, iw, ih);

  // Rank, tier, invite.
  ctx.fillStyle = "#ccff00";
  fit(ctx, card.rank, 800, 128, display, W - 120);
  ctx.fillText(card.rank, W / 2, 1640);
  if (card.tier) {
    ctx.fillStyle = "#e6e9eb";
    ctx.font = `500 38px ${mono}`;
    ctx.fillText(card.tier.toUpperCase(), W / 2, 1712);
  }
  ctx.fillStyle = "#9aa1a6";
  ctx.font = `500 34px ${mono}`;
  ctx.fillText(card.footer, W / 2, 1820);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
