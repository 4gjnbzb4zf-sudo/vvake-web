import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlusCheckout } from "@/components/plus/PlusCheckout";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container } from "@/components/ui/Section";
import { SectionNav } from "@/components/ui/SectionNav";
import { siteConfig } from "@/config/site";
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
    alternates: { canonical: `/${lang}/plus/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/plus/`])) },
  };
}

/**
 * vvake.com/plus: a month of VVake Fit Plus paid with $VVAKE from the visitor's own wallet, at the API's discount.
 * The iOS app sells Plus through the App Store (In-App Purchase); it links here only where Apple allows a link to an
 * outside purchase (the US storefront) and in test builds. One static page per language; everything live loads in the
 * browser (sign-in, price, invoice).
 */
export default async function PlusPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.plusPay;
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={t.kicker} title={t.heading} lead={t.lead} />
        <Container>
          <p className="my-8 max-w-3xl rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-muted">{t.appStore}</p>
        </Container>
        <PlusCheckout dict={t} rewards={dict.rewards} lang={lang} apiUrl={siteConfig.apiUrl} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
