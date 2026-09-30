import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { isLocale, locales, ogLocales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OG_SIZE } from "@/og/OgCard";
import { SignSweep } from "@/components/brand/SignSweep";
import { THEME_SCRIPT } from "@/lib/theme";
import { fontVariables } from "../fonts";
import "../globals.css";

type Params = Promise<{ lang: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#0e1012",
  colorScheme: "dark light",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: dict.meta.title, template: `%s · ${siteConfig.name}` },
    description: dict.meta.description,
    applicationName: siteConfig.name,
    alternates: {
      canonical: `/${lang}/`,
      languages: Object.fromEntries([...locales.map((l) => [l, `/${l}/`]), ["x-default", "/en/"]]),
    },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${lang}/`,
      locale: ogLocales[lang],
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocales[l]),
      images: [{ url: `/og/${lang}.png`, width: OG_SIZE.width, height: OG_SIZE.height, alt: dict.meta.ogAlt, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.social.xHandle,
      title: dict.meta.title,
      description: dict.meta.description,
      images: [`/og/${lang}.png`],
    },
    referrer: "strict-origin-when-cross-origin",
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint (no flash of the other theme). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <SignSweep />
      </body>
    </html>
  );
}
