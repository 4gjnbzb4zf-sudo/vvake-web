import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeInvite } from "@/components/sections/ChallengeInvite";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OG_SIZE } from "@/og/OgCard";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const c = getDictionary(lang).challenge;
  // A "Beat me in 24 h" card (public/og/<lang>-challenge.png): the site is static, so one card for every code.
  const image = { url: `/og/${lang}-challenge.png`, width: OG_SIZE.width, height: OG_SIZE.height, alt: c.ogAlt, type: "image/png" };
  return {
    title: c.title,
    description: c.ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: c.ogTitle,
      description: c.ogDescription,
      url: `/${lang}/c/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: c.ogTitle,
      description: c.ogDescription,
      images: [image.url],
    },
  };
}

/**
 * Fallback for challenge links (vvake.com/c/<code>) when the app isn't installed: the 404 page forwards here with the
 * code in the hash (/<lang>/c/#<code>). One static page per language; the code is read in the browser. 24-hour
 * challenges ("beat my mark") show the mark, the countdown to accept and, open to everyone, the board.
 */
export default async function ChallengePage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-16 sm:py-24">
        <Container className="max-w-2xl">
          <ChallengeInvite
            dict={dict.challenge}
            lang={lang}
            apiUrl={siteConfig.apiUrl}
            appScheme={siteConfig.appScheme}
            getHref={siteConfig.appDownloadUrl || `/${lang}/#unlock`}
            origin={siteConfig.url}
          />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
