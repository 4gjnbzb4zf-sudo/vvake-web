import { notFound } from "next/navigation";
import { DoubleV } from "@/components/sections/DoubleV";
import { Dev, Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { How } from "@/components/sections/How";
import { OpenBook } from "@/components/sections/OpenBook";
import { Pulse } from "@/components/sections/Pulse";
import { RivalryBoard, type RivalryView } from "@/components/sections/Rivalries";
import { Story } from "@/components/sections/Story";
import { Unlock } from "@/components/sections/Unlock";
import { Section } from "@/components/ui/Section";
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
        <Hero dict={dict.hero} />
        <Story dict={dict.story} />
        <DoubleV dict={dict.doubleV} />
        <How dict={dict.how} />
        <Pulse dict={dict.pulse} />
        <Section
          id="rivalries"
          kicker={dict.rivalries.kicker}
          title={dict.rivalries.title}
          lead={dict.rivalries.body}
          className="border-t border-line/60"
        >
          <RivalryBoard dict={dict.rivalries} rivalries={rivalryViews()} numberLocale={lang} />
        </Section>
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} />
        <OpenBook dict={dict.openBook} />
        <Section
          id="vvaker"
          kicker={dict.vvaker.kicker}
          title={dict.vvaker.title}
          lead={dict.vvaker.body}
          className="border-t border-line/60"
        >
          <VVakerStudio dict={dict.vvaker} />
        </Section>
        <Dev dict={dict.dev} />
        <Faq dict={dict.faq} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
