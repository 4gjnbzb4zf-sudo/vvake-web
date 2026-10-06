import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReferralInvite } from "@/components/sections/ReferralInvite";
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
  const r = getDictionary(lang).referral;
  // A generic "Join me on VVake" card (public/og/<lang>-join.png): the site is static, so not one per code.
  const image = { url: `/og/${lang}-join.png`, width: OG_SIZE.width, height: OG_SIZE.height, alt: r.ogAlt, type: "image/png" };
  return {
    title: r.title,
    description: r.ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: r.ogTitle,
      description: r.ogDescription,
      url: `/${lang}/r/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: r.ogTitle,
      description: r.ogDescription,
      images: [image.url],
    },
  };
}

/**
 * Fallback for referral invite links (vvake.com/r/<code>) when the link opens in a browser instead of the app: the 404
 * page forwards here with the code in the hash (/<lang>/r/#<code>). One static page per language; the code is read in
 * the browser, no API call.
 */
export default async function ReferralPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-16 sm:py-24">
        <Container className="max-w-2xl">
          <ReferralInvite dict={dict.referral} appScheme={siteConfig.appScheme} joinHref={`/${lang}/#unlock`} origin={siteConfig.url} />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
