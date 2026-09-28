import { notFound } from "next/navigation";
import { AppPreview } from "@/components/sections/AppPreview";
import { Challenges } from "@/components/sections/Challenges";
import { DoubleV } from "@/components/sections/DoubleV";
import { Dev, Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { How } from "@/components/sections/How";
import { Multisport } from "@/components/sections/Multisport";
import { OpenBook } from "@/components/sections/OpenBook";
import { Pace } from "@/components/sections/Pace";
import { Partners } from "@/components/sections/Partners";
import { Pulse } from "@/components/sections/Pulse";
import { RivalryBoard, type RivalryView } from "@/components/sections/Rivalries";
import { Rwa } from "@/components/sections/Rwa";
import { Stats } from "@/components/sections/Stats";
import { Story } from "@/components/sections/Story";
import { Unlock } from "@/components/sections/Unlock";
import { VibeLink } from "@/components/sections/VibeLink";
import { Wellbeing } from "@/components/sections/Wellbeing";
import { Why } from "@/components/sections/Why";
import { Section } from "@/components/ui/Section";
import { CollectorDrops } from "@/components/vvaker/CollectorDrops";
import { VVakerDeck } from "@/components/vvaker/VVakerDeck";
import { VVakerStudio } from "@/components/vvaker/VVakerStudio";
import { VVakerTiers } from "@/components/vvaker/VVakerTiers";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCity, RIVALRIES, thresholdFor } from "@/lib/cities";

function rivalryViews(): RivalryView[] {
  return RIVALRIES.map((r) => {
    const side = (slug: string) => ({ name: getCity(slug)?.name ?? slug, threshold: thresholdFor(slug) });
    return { id: r.id as RivalryView["id"], country: r.country, sides: [side(r.cities[0]), side(r.cities[1])] as const };
  });
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <Hero dict={dict.hero} highlights={dict.highlights} />
        <Stats dict={dict.stats} />
        <Why dict={dict.why} index="01" />
        <Multisport dict={dict.multisport} index="02" />
        <Challenges dict={dict.challenges} index="03" />
        <Pace dict={dict.pace} index="04" />
        <Wellbeing dict={dict.wellbeing} index="05" />
        <AppPreview dict={dict.app} index="06" />
        <Story dict={dict.story} index="07" />
        <DoubleV dict={dict.doubleV} anthem={{ prefix: dict.hero.prefix, lines: dict.hero.anthem }} />
        <VibeLink dict={dict.vibe} />
        <How dict={dict.how} index="08" />
        <Pulse dict={dict.pulse} index="09" />
        <Rwa dict={dict.rwa} index="10" />
        <Section
          id="rivalries"
          index="11"
          kicker={dict.rivalries.kicker}
          title={<span className="inline-block -skew-x-6 italic">{dict.rivalries.title}</span>}
          lead={dict.rivalries.body}
        >
          <RivalryBoard dict={dict.rivalries} rivalries={rivalryViews()} numberLocale={lang} />
        </Section>
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="12" />
        <OpenBook dict={dict.openBook} index="13" />
        <Section id="vvaker" index="14" kicker={dict.vvaker.kicker} title={dict.vvaker.title} lead={dict.vvaker.body}>
          <VVakerDeck />
          <VVakerStudio dict={dict.vvaker} />
          <VVakerTiers dict={dict.vvaker.tiers} />
          <CollectorDrops dict={dict.vvaker.collect} />
        </Section>
        <Dev dict={dict.dev} index="15" />
        <Partners dict={dict.partners} index="16" />
        <Faq dict={dict.faq} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
