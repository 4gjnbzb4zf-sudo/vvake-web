import { AppScreens } from "@/components/sections/AppScreens";
import { HeroFilm } from "@/components/sections/HeroFilm";
import { notFound } from "next/navigation";
import { Benefits } from "@/components/sections/Benefits";
import { Coach } from "@/components/sections/Coach";
import { Faq, Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { Paths } from "@/components/sections/Paths";
import { Unlock } from "@/components/sections/Unlock";
import { SectionNav } from "@/components/ui/SectionNav";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * The short home page: what VVake is and what's in it for you, one thing to try (the coach call),
 * the city waitlist, then three ways to go deeper (the app, your VVaker, backers).
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <Hero locale={lang} dict={dict.hero} highlights={dict.highlights} app={dict.app} />
        <HeroFilm dict={dict.hero} />
        <AppScreens dict={dict.screens} />
        <Benefits locale={lang} dict={dict.benefits} />
        <Coach dict={dict.coach} index="01" />
        <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="02" />
        <Paths locale={lang} dict={dict.paths} />
        <Faq dict={dict.faq} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
