/**
 * Writes public/og/<locale>.png at build time. Static PNGs with a real extension are
 * served as image/png by GitHub Pages, which social crawlers require.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { locales } from "../src/i18n/config";
import { getDictionary } from "../src/i18n/dictionaries";
import { OG_SIZE, OgCard } from "../src/og/OgCard";

async function main() {
  const outDir = join(process.cwd(), "public", "og");
  await mkdir(outDir, { recursive: true });
  for (const locale of locales) {
    const image = new ImageResponse(<OgCard dict={getDictionary(locale)} />, OG_SIZE);
    await writeFile(join(outDir, `${locale}.png`), Buffer.from(await image.arrayBuffer()));
    console.log(`og: public/og/${locale}.png`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
