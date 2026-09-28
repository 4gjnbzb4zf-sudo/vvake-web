import { notFound } from "next/navigation";
import { AppPreview } from "@/components/sections/AppPreview";
import { Challenges } from "@/components/sections/Challenges";
import { DoubleV } from "@/components/sections/DoubleV";
import { Crew } from "@/components/sections/Crew";
import { Earn } from "@/components/sections/Earn";
import { DayLoop } from "@/components/sections/DayLoop";
import { Dev, Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { How } from "@/components/sections/How";
import { Journal } from "@/components/sections/Journal";
import { Planner } from "@/components/sections/Planner";
import { Live } from "@/components/sections/Live";
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
import { EarnedStats } from "@/components/vvaker/EarnedStats";
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
        <Hero dict={dict.hero} highlights={dict.highlights} app={dict.app} />
        <Stats dict={dict.stats} />
        {/* Why join: the reasons, what you get, proof the world is moving, the day-one hook, the CTA. */}
        <Why dict={dict.why} index="01" />
        <Earn dict={dict.earn} index="02" />
        <Live dict={dict.live} index="03" numberLocale={lang} />
        <Section
          id="rivalries"
          index="04"
          kicker={dict.rivalries.kicker}
          title={<span className="inline-block -skew-x-6 italic">{dict.rivalries.title}</span>}
          lead={dict.rivalries.body}
        >
          <RivalryBoard dict={dict.rivalries} rivalries={rivalryViews()} numberLocale={lang} />
        </Section>
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="05" />
        {/* Play: how it works, every sport, then the tools that keep you going. */}
        <How dict={dict.how} index="06" />
        <AppPreview dict={dict.app} index="07" />
        <Multisport dict={dict.multisport} index="08" />
        <Challenges dict={dict.challenges} index="09" />
        <Crew dict={dict.crew} index="10" />
        <Section id="plan" index="11" kicker={dict.plan.kicker} title={dict.plan.title} lead={dict.plan.body}>
          <Planner dict={dict.plan} sportNames={dict.multisport.sports} />
        </Section>
        <Section id="journal" index="12" kicker={dict.journal.kicker} title={dict.journal.title} lead={dict.journal.body}>
          <Journal dict={dict.journal} />
        </Section>
        <DayLoop dict={dict.day} index="13" />
        <Pace dict={dict.pace} index="14" />
        <Wellbeing dict={dict.wellbeing} index="15" />
        {/* Brand moment, then identity. */}
        <Story dict={dict.story} index="16" />
        <DoubleV dict={dict.doubleV} anthem={{ prefix: dict.hero.prefix, lines: dict.hero.anthem }} />
        <Section id="vvaker" index="17" kicker={dict.vvaker.kicker} title={dict.vvaker.title} lead={dict.vvaker.body}>
          <VVakerDeck />
          <VVakerStudio dict={dict.vvaker} />
          <EarnedStats dict={dict.vvaker.stats} />
          <VVakerTiers dict={dict.vvaker.tiers} />
          <CollectorDrops dict={dict.vvaker.collect} />
        </Section>
        {/* Web3 & ownership: markets and rewards, the game on top of them, and the open books. */}
        <Rwa dict={dict.rwa} index="18" />
        <Pulse dict={dict.pulse} index="19" />
        <OpenBook dict={dict.openBook} index="20" />
        <VibeLink dict={dict.vibe} />
        <Dev dict={dict.dev} index="21" />
        <Partners dict={dict.partners} index="22" />
        <Faq dict={dict.faq} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
