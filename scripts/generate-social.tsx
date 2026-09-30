/**
 * Social kit for the brand accounts: profile pictures and banners, written to ../VVFit/marketing/social
 * (or the folder given as the first argument). Same renderer as the share cards (scripts/generate-og.tsx).
 * Usage: npx tsx scripts/generate-social.tsx [outDir]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { HAND_DOT, HAND_PATH, HAND_TRANSFORM, HAND_VIEWBOX } from "../src/components/brand/handMark";
import { getDictionary } from "../src/i18n/dictionaries";

const HAND_RATIO = 739 / 1288; // width / height of the traced hand

async function castPng(id: string): Promise<string> {
  const png = await sharp(join(process.cwd(), "public", "personas", `${id}.webp`))
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function Hand({ height, color, dot }: { height: number; color: string; dot: string }) {
  return (
    <svg width={Math.round(height * HAND_RATIO)} height={height} viewBox={HAND_VIEWBOX}>
      <g transform={HAND_TRANSFORM} fill={color}>
        <path d={HAND_PATH} />
      </g>
      <circle {...HAND_DOT} fill={dot} />
    </svg>
  );
}

const BG = "radial-gradient(ellipse at 20% 0%, rgba(255,61,110,0.35), transparent 55%), #0e1012";

function Pfp({ variant }: { variant: "dark" | "lime" }) {
  const lime = variant === "lime";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: lime ? "#ccff00" : BG,
      }}
    >
      <Hand height={700} color={lime ? "#0e1012" : "#e6e9eb"} dot={lime ? "#ff3d6e" : "#ccff00"} />
    </div>
  );
}

function Banner({ w, h, line, cast }: { w: number; h: number; line: string; cast: string[] }) {
  const castH = Math.round(h * 0.94);
  const handH = Math.round(h * 0.34);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative", background: BG, color: "#e6e9eb" }}>
      <div
        style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: Math.round(h * 0.16), height: "100%" }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", marginBottom: Math.round(handH * 0.1) }}>
            <Hand height={handH} color="#e6e9eb" dot="#ccff00" />
          </div>
          <div style={{ fontSize: Math.round(handH * 0.78), fontWeight: 800, letterSpacing: 6, lineHeight: 1 }}>AKE</div>
        </div>
        <div style={{ fontSize: Math.round(h * 0.075), color: "#ccff00", marginTop: Math.round(h * 0.04) }}>{line}</div>
        <div style={{ fontSize: Math.round(h * 0.045), color: "#9aa1a6", marginTop: Math.round(h * 0.03) }}>vvake.com</div>
      </div>
      <div style={{ position: "absolute", right: Math.round(h * 0.06), bottom: 0, display: "flex", alignItems: "flex-end" }}>
        {cast.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            height={i === 1 ? castH : Math.round(castH * 0.93)}
            style={{ marginLeft: i === 0 ? 0 : -Math.round(castH * 0.14) }}
          />
        ))}
      </div>
    </div>
  );
}

async function main() {
  const out = resolve(process.argv[2] ?? join(process.cwd(), "..", "VVFit", "marketing", "social"));
  await mkdir(out, { recursive: true });
  const save = async (file: string, el: React.ReactElement, width: number, height: number) => {
    const img = new ImageResponse(el, { width, height });
    await writeFile(join(out, file), Buffer.from(await img.arrayBuffer()));
    console.log(`social: ${file} (${width}×${height})`);
  };

  await save("pfp-dark.png", <Pfp variant="dark" />, 1024, 1024);
  await save("pfp-lime.png", <Pfp variant="lime" />, 1024, 1024);

  // A woman, a man, a woman: the crew throwing the sign.
  const cast = await Promise.all(["runner-f", "runner-m", "baller-f"].map(castPng));
  for (const locale of ["en", "fr"] as const) {
    const line = getDictionary(locale).unlock.success.campaign.join(" ");
    await save(`x-header-${locale}.png`, <Banner w={1500} h={500} line={line} cast={cast} />, 1500, 500);
    await save(`linkedin-cover-${locale}.png`, <Banner w={1584} h={396} line={line} cast={cast} />, 1584, 396);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
