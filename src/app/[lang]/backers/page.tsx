import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dev } from "@/components/sections/Extras";
import { HealthWealth } from "@/components/sections/HealthWealth";
import { OpenBook } from "@/components/sections/OpenBook";
import { Partners } from "@/components/sections/Partners";
import { Pulse } from "@/components/sections/Pulse";
import { Rwa } from "@/components/sections/Rwa";
import { Stats } from "@/components/sections/Stats";
import { Story } from "@/components/sections/Story";
import { Unlock } from "@/components/sections/Unlock";
import { VibeLink } from "@/components/sections/VibeLink";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Subpage, subpageMetadata } from "../subpage";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? subpageMetadata(lang, "backers/") : {};
}

/** For backers: launch facts, why Web3, open books, the RWA plan and $VVAKE, the market game, builders and partners. */
export default async function BackersPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <Subpage lang={lang} page="backers/">
      <Stats dict={dict.stats} />
      <Story dict={dict.story} index="01" />
      <OpenBook dict={dict.openBook} index="02" />
      <Rwa locale={lang} dict={dict.rwa} index="03" />
      <HealthWealth dict={dict.healthWealth} />
      <Pulse dict={dict.pulse} index="04" sportNames={dict.multisport.sports} />
      <VibeLink dict={dict.vibe} />
      <Dev dict={dict.dev} index="05" />
      <Partners dict={dict.partners} index="06" />
      <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="07" />
    </Subpage>
  );
}
