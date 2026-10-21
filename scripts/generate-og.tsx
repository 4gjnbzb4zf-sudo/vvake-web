/**
 * Writes public/og/<locale>.png at build time. Static PNGs with a real extension are
 * served as image/png by GitHub Pages, which social crawlers require.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { locales } from "../src/i18n/config";
import { getDictionary } from "../src/i18n/dictionaries";
import { OG_SIZE, OgCard } from "../src/og/OgCard";
import { SHARE_VARIANTS } from "../src/lib/referral";
import { MOMENT_CAST, MOMENT_KINDS, TRAINING_CAST } from "../src/lib/moments";
import { getTrainingsDict } from "../src/i18n/trainings";

/** A cast image as a PNG data URI (satori can't read WebP), trimmed to the character. */
async function castPng(id: string): Promise<string> {
  const png = await sharp(join(process.cwd(), "public", "personas", `${id}.webp`))
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function main() {
  const outDir = join(process.cwd(), "public", "og");
  await mkdir(outDir, { recursive: true });
  // Default card (page metadata) + 8 share variants: a different woman + man duo and app challenge each,
  // served by /[lang]/s/[n]/ so every shared link can show a different picture.
  const duos: [string, string][] = [
    ["footballer-f", "baller"],
    ["runner-f", "footballer"],
    ["boxer-f", "walker"],
    ["lifter-f", "racket"],
    ["climber-f", "runner"],
    ["runner-f", "lifter"],
    ["footballer-f", "hiker"],
    ["boxer-f", "roller"],
  ];
  const png = new Map<string, string>();
  for (const id of new Set([...duos.flat(), ...Object.values(MOMENT_CAST).flat(), ...TRAINING_CAST])) png.set(id, await castPng(id));
  for (const locale of locales) {
    const dict = getDictionary(locale);
    const render = async (file: string, cast: string[], challenge?: number, invite?: boolean, dare?: boolean) => {
      const image = new ImageResponse(<OgCard dict={dict} cast={cast} challenge={challenge} invite={invite} dare={dare} />, OG_SIZE);
      await writeFile(join(outDir, file), Buffer.from(await image.arrayBuffer()));
    };
    await render(
      `${locale}.png`,
      duos[0]!.map((id) => png.get(id)!),
    );
    // Invite links (/[lang]/r/): "Join me on VVake", a runner duo racing.
    await render(
      `${locale}-join.png`,
      ["runner-f", "runner"].map((id) => png.get(id)!),
      undefined,
      true,
    );
    // Challenge links (/[lang]/c/): "Beat me in 24 h", a boxer and a runner.
    await render(
      `${locale}-challenge.png`,
      ["boxer-f", "runner"].map((id) => png.get(id)!),
      undefined,
      false,
      true,
    );
    // Moment share pages (/[lang]/m/<kind>/): a card per kind, each with its own duo and line.
    for (const kind of MOMENT_KINDS) {
      const m = dict.moments.kinds[kind];
      const image = new ImageResponse(
        <OgCard
          dict={dict}
          cast={MOMENT_CAST[kind].map((id) => png.get(id)!)}
          moment={{ kicker: m.ogKicker, title: m.ogTitle, cta: m.ogLine }}
        />,
        OG_SIZE,
      );
      await writeFile(join(outDir, `${locale}-m-${kind}.png`), Buffer.from(await image.arrayBuffer()));
    }
    // Shared custom trainings (/[lang]/t/) and creator pages (/[lang]/coach/): one card per language.
    {
      const t = getTrainingsDict(locale).share;
      const image = new ImageResponse(
        <OgCard
          dict={dict}
          cast={TRAINING_CAST.map((id) => png.get(id)!)}
          moment={{ kicker: t.ogKicker, title: t.ogTitle, cta: t.ogLine }}
        />,
        OG_SIZE,
      );
      await writeFile(join(outDir, `${locale}-t.png`), Buffer.from(await image.arrayBuffer()));
    }
    for (let n = 1; n <= SHARE_VARIANTS; n++) {
      // Alternate who stands first (and taller) so neither the woman nor the man always leads.
      const duo = n % 2 === 0 ? [...duos[n - 1]!].reverse() : duos[n - 1]!;
      await render(
        `${locale}-${n}.png`,
        duo.map((id) => png.get(id)!),
        n - 1,
      );
    }
    console.log(
      `og: public/og/${locale}.png + ${SHARE_VARIANTS} share variants + join, challenge and ${MOMENT_KINDS.length} moment cards + training card`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
