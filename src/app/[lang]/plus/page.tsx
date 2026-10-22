import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlansRedirect } from "@/components/plus/PlansRedirect";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    title: getDictionary(lang).plusPay.title,
    robots: { index: false, follow: true },
    alternates: { canonical: `/${lang}/plans/` },
  };
}

/**
 * vvake.com/<lang>/plus/, the plans page's old address: forwards to /<lang>/plans/ (static export, no server
 * redirect). /plus/success/ and /plus/cancel/ below stay real pages: Stripe's checkout returns there.
 */
export default async function PlusMoved({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PlansRedirect lang={lang} label={getDictionary(lang).plusPay.title} />;
}
