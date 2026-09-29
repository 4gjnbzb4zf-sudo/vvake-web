import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoubleV } from "@/components/sections/DoubleV";
import { Unlock } from "@/components/sections/Unlock";
import { Section } from "@/components/ui/Section";
import { CollectorDrops } from "@/components/vvaker/CollectorDrops";
import { EarnedStats } from "@/components/vvaker/EarnedStats";
import { PersonaBuilder } from "@/components/vvaker/PersonaBuilder";
import { VVakerDeck } from "@/components/vvaker/VVakerDeck";
import { VVakerTiers } from "@/components/vvaker/VVakerTiers";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Subpage, subpageMetadata } from "../subpage";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? subpageMetadata(lang, "vvaker/") : {};
}

/** Your VVaker: build it, grow it (earned stats, tiers), optional collectibles, and the brand's two Vs. */
export default async function VVakerPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <Subpage lang={lang} page="vvaker/">
      <Section id="vvaker" index="01" kicker={dict.vvaker.kicker} title={dict.vvaker.title} lead={dict.vvaker.body}>
        <VVakerDeck />
        <PersonaBuilder dict={dict.vvaker.persona} tagline={dict.vvaker.bannerTagline} sportNames={dict.multisport.sports} />
      </Section>
      <Section id="grow" index="02" kicker={dict.vvaker.grow.kicker} title={dict.vvaker.grow.title}>
        <EarnedStats dict={dict.vvaker.stats} />
        <VVakerTiers dict={dict.vvaker.tiers} />
        <CollectorDrops dict={dict.vvaker.collect} />
      </Section>
      <DoubleV dict={dict.doubleV} anthem={{ prefix: dict.hero.prefix, lines: dict.hero.anthem }} />
      <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="03" />
    </Subpage>
  );
}
