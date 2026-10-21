import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorPage } from "@/components/trainings/CreatorPage";
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
  const d = getTrainingsDict(lang);
  const image = { url: trainingOgPath(lang), width: OG_SIZE.width, height: OG_SIZE.height, alt: d.share.ogAlt, type: "image/png" };
  return {
    title: d.creator.title,
    description: d.creator.ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: d.creator.ogTitle,
      description: d.creator.ogDescription,
      url: `/${lang}/coach/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: d.creator.ogTitle,
      description: d.creator.ogDescription,
      images: [image.url],
    },
  };
}

/**
 * A creator's public page (ADR-0047: opt-in profiles), vvake.com/<lang>/coach/#<handle> (the 404 page forwards
 * /<lang>/coach/<handle> here). One static page per language; the profile is fetched in the browser.
 */
export default async function CoachPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-12 sm:py-20">
        <Container className="max-w-2xl">
          <CreatorPage d={getTrainingsDict(lang)} lang={lang} apiUrl={siteConfig.apiUrl} />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
