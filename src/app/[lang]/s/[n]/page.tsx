import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OG_SIZE } from "@/og/OgCard";
import { SHARE_VARIANTS } from "@/lib/referral";

type Params = Promise<{ lang: string; n: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => Array.from({ length: SHARE_VARIANTS }, (_, i) => ({ lang, n: String(i + 1) })));
}

/** Its own preview image (a duo + an app challenge), so each shared post can look different. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, n } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  const image = { url: `/og/${lang}-${n}.png`, width: OG_SIZE.width, height: OG_SIZE.height, alt: dict.meta.ogAlt, type: "image/png" };
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/${lang}/` },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${lang}/s/${n}/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: dict.meta.title,
      description: dict.meta.description,
      images: [image.url],
    },
  };
}

/** A share page: shows the preview to social networks, and sends people on to the home page (?ref, ?city kept). */
export default async function SharePage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const home = `/${lang}/`;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(home)}+location.search+location.hash)` }} />
      <a href={home} className="text-muted underline underline-offset-4">
        vvake.com
      </a>
    </main>
  );
}
