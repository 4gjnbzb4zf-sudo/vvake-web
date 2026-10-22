import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlusPage } from "@/components/plus/PlusPage";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).plusPay.title, robots: { index: false, follow: false } };
}

/** Where Stripe's checkout comes back to (paid): the plans page with a line saying so. Not indexed. */
export default async function PlusSuccess({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PlusPage lang={lang} notice="success" />;
}
