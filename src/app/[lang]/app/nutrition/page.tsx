import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NutritionForward } from "@/components/webapp/NutritionForward";
import { isLocale } from "@/i18n/config";
import { getNutritionDict } from "@/i18n/nutrition";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: { absolute: `${getNutritionDict(lang).title} · VVake` }, robots: { index: false, follow: true } };
}

/**
 * vvake.com/<lang>/app/nutrition/ (VVFit ADR-0070): Nutrition from a link or a shortcut. The site is static, so the page
 * forwards to /<lang>/app/#/nutrition (keeping a view: ?view=plan → #/nutrition/plan).
 */
export default async function NutritionPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <NutritionForward lang={lang} label={getNutritionDict(lang).title} />;
}
