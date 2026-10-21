import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrainingShare } from "@/components/trainings/TrainingShare";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getTrainingsDict } from "@/i18n/trainings";
import { trainingOgPath } from "@/lib/moments";
import { OG_SIZE } from "@/og/OgCard";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const s = getTrainingsDict(lang).share;
  // One card per language (public/og/<lang>-t.png): the site is static, so the same for every training.
  const image = { url: trainingOgPath(lang), width: OG_SIZE.width, height: OG_SIZE.height, alt: s.ogAlt, type: "image/png" };
  return {
    title: s.title,
    description: s.ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: s.ogTitle,
      description: s.ogDescription,
      url: `/${lang}/t/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: s.ogTitle,
      description: s.ogDescription,
      images: [image.url],
    },
  };
}

/**
 * Shared custom trainings (vvake.com/<lang>/t/<CODE>, ADR-0047) when the app isn't installed: the 404 page forwards
 * here with the code in the hash (/<lang>/t/#<CODE>, the challenge as ?c=). One static page per language; the training
 * is fetched in the browser and can run right here in the web app's camera workout.
 */
export default async function TrainingSharePage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-12 sm:py-20">
        <Container className="max-w-2xl">
          <TrainingShare
            d={getTrainingsDict(lang)}
            lang={lang}
            apiUrl={siteConfig.apiUrl}
            appScheme={siteConfig.appScheme}
            origin={siteConfig.url}
          />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
