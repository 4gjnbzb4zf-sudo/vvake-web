import { notFound } from "next/navigation";
import { Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { AppScreens } from "@/components/sections/AppScreens";
import { Hero } from "@/components/sections/Hero";
import { CityClash, CrewExample, Devices, Film, Loop } from "@/components/sections/HomeSections";
import { Paths } from "@/components/sections/Paths";
import { SampleWeek } from "@/components/sections/SampleWeek";
import { Unlock } from "@/components/sections/Unlock";
import { Section } from "@/components/ui/Section";
import { SectionNav } from "@/components/ui/SectionNav";
import { isLocale } from "@/i18n/config";
import { pageHref } from "@/lib/routes";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * The home page has one job: understand VVake fast (your coach, your crew, your city) and join early access.
 * Hero (coach / crew / city, the film on request, the sports strip) → film → plan / move / progress → the real app
 * running (phone and watch reels) → a sample week → a crew → City Clash → honest device status → "Wake your city"
 * (the real city waitlist, referrals included) → short FAQ → three ways to go deeper. Scoring, rewards, Plus, web3 and the
 * roadmap live on /app, /vvaker and /backers.
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const home = dict.home;

  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <Hero dict={dict.hero} />
        <Film dict={home.film} locale={lang} />
        <Loop dict={home.loop} index="01" />
        <AppScreens dict={dict.screens} index="02" more={{ href: `${pageHref(lang, "app/")}#screens`, label: home.screens.more }} />
        <Section id="sample-week" index="03" kicker={home.sample.kicker} title={home.sample.title} lead={home.sample.lead} layout="split">
          <SampleWeek dict={home.sample} />
        </Section>
        <CrewExample dict={home.crew} index="04" />
        <CityClash dict={home.clash} index="05" />
        <Devices dict={home.devices} index="06" />
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="07" heading={home.join} />
        <Faq locale={lang} dict={dict.faq} />
        <Paths locale={lang} dict={dict.paths} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
