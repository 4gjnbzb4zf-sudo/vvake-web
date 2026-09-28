import { notFound } from "next/navigation";
import { AppPreview } from "@/components/sections/AppPreview";
import { DoubleV } from "@/components/sections/DoubleV";
import { Dev, Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { How } from "@/components/sections/How";
import { OpenBook } from "@/components/sections/OpenBook";
import { Pulse } from "@/components/sections/Pulse";
import { RivalryBoard, type RivalryView } from "@/components/sections/Rivalries";
import { Stats } from "@/components/sections/Stats";
import { Story } from "@/components/sections/Story";
import { Unlock } from "@/components/sections/Unlock";
import { Why } from "@/components/sections/Why";
import { Section } from "@/components/ui/Section";
import { VVakerDeck } from "@/components/vvaker/VVakerDeck";
import { VVakerStudio } from "@/components/vvaker/VVakerStudio";
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
        <AppPreview dict={dict.app} index="02" />
        <Story dict={dict.story} index="03" />
        <DoubleV dict={dict.doubleV} anthem={{ prefix: dict.hero.prefix, lines: dict.hero.anthem }} />
        <How dict={dict.how} index="04" />
        <Pulse dict={dict.pulse} index="05" />
        <Section
          id="rivalries"
          index="06"
          kicker={dict.rivalries.kicker}
          title={<span className="inline-block -skew-x-6 italic">{dict.rivalries.title}</span>}
          lead={dict.rivalries.body}
        >
          <RivalryBoard dict={dict.rivalries} rivalries={rivalryViews()} numberLocale={lang} />
        </Section>
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="07" />
        <OpenBook dict={dict.openBook} index="08" />
        <Section id="vvaker" index="09" kicker={dict.vvaker.kicker} title={dict.vvaker.title} lead={dict.vvaker.body}>
          <VVakerDeck />
          <VVakerStudio dict={dict.vvaker} />
        </Section>
        <Dev dict={dict.dev} index="10" />
        <Faq dict={dict.faq} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
