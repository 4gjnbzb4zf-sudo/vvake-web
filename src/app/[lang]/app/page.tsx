import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { WebApp } from "@/components/webapp/WebApp";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getWebAppDict } from "@/i18n/webapp";
import { TOUR_SECTIONS } from "@/lib/routes";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getWebAppDict(lang);
  return {
    title: { absolute: t.meta.title },
    description: t.meta.description,
    alternates: { canonical: `/${lang}/app/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/app/`])) },
    manifest: `/app-${lang}.webmanifest`,
    appleWebApp: { capable: true, title: "VVake", statusBarStyle: "black-translucent" },
    icons: { apple: "/app-icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1012" },
  ],
  colorScheme: "dark light",
};

/**
 * vvake.com/<lang>/app: VVake on the web, the phone app in the browser (src/components/webapp). One static page per
 * language, full screen like the app (no site header or footer); everything live loads in the browser from the API.
 */
export default async function WebAppPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <WebApp lang={lang} t={getWebAppDict(lang)} apiUrl={siteConfig.apiUrl} legacyTour={TOUR_SECTIONS} />;
}
