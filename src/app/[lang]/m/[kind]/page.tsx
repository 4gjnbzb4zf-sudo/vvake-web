import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MomentShare } from "@/components/sections/MomentShare";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isMomentKind, MOMENT_KINDS, momentOgPath } from "@/lib/moments";
import { OG_SIZE } from "@/og/OgCard";

type Params = Promise<{ lang: string; kind: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => MOMENT_KINDS.map((kind) => ({ lang, kind })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, kind } = await params;
  if (!isLocale(lang) || !isMomentKind(kind)) return {};
  const m = getDictionary(lang).moments.kinds[kind];
  // One card per kind and language (public/og/<lang>-m-<kind>.png): nothing personal, the same for every sharer.
  const image = { url: momentOgPath(lang, kind), width: OG_SIZE.width, height: OG_SIZE.height, alt: m.ogAlt, type: "image/png" };
  return {
    title: m.title,
    description: m.ogDescription,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: m.ogTitle,
      description: m.ogDescription,
      url: `/${lang}/m/${kind}/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: m.ogTitle,
      description: m.ogDescription,
      images: [image.url],
    },
  };
}

/**
 * A moment shared from the app (a brag card after a session, a ghost beaten, a trophy, a VVaker, a week, a challenge
 * taken, a city rank): the link in
 * the post (vvake.com/<lang>/m/<kind>/#<CODE>). A static page per kind and language, with its own preview card; the
 * sharer's invite code, when there is one, is read from the hash in the browser (no API call, nothing personal).
 */
export default async function MomentPage({ params }: { params: Params }) {
  const { lang, kind } = await params;
  if (!isLocale(lang) || !isMomentKind(kind)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-10 sm:py-20">
        <Container className="max-w-3xl">
          <MomentShare kind={kind} lang={lang} dict={dict} appScheme={siteConfig.appScheme} />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
