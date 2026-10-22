import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacesForward } from "@/components/webapp/PlacesForward";
import { isLocale } from "@/i18n/config";
import { getWebAppDict } from "@/i18n/webapp";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getWebAppDict(lang);
  return { title: { absolute: `${t.places.title} · VVake` }, description: t.places.lead, robots: { index: false, follow: true } };
}

/**
 * vvake.com/<lang>/app/places/?sport=swim: a link anyone can share to the web app's Places near me. The site is
 * static, so the sport is read in the browser and the page forwards to /<lang>/app/#/places/<sport>.
 */
export default async function PlacesPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PlacesForward lang={lang} label={getWebAppDict(lang).places.title} />;
}
