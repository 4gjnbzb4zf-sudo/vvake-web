import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlusPage } from "@/components/plus/PlusPage";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang).plusPay;
  return {
    title: dict.title,
    description: dict.description,
    alternates: { canonical: `/${lang}/plans/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/plans/`])) },
  };
}

/**
 * vvake.com/<lang>/plans/: the coach plans (Free, VVake Coach Plus, Coach Premium and minute packs), and a month of
 * Coach Plus paid with $VVAKE from the visitor's own wallet, at the API's discount, or a monthly card subscription
 * (Stripe, shown once the API has its keys). The iOS app sells the plans through the App Store (In-App Purchase); it
 * links here only where Apple allows a link to an outside purchase (the US storefront) and in test builds. One static
 * page per language. The old address /<lang>/plus/ forwards here; /<lang>/plus/success/ and /cancel/ stay where
 * Stripe's checkout returns.
 */
export default async function Plans({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PlusPage lang={lang} />;
}
