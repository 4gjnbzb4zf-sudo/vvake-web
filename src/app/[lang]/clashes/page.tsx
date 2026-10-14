import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClashBoard } from "@/components/clashes/LiveClashes";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const c = getDictionary(lang).clashes;
  return {
    title: c.pageTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${lang}/clashes/`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/clashes/`])),
    },
  };
}

/**
 * Live City Clashes: every clash live now, waiting for results or about to start, from the API's public feed
 * (GET /v1/public/clashes), fetched in the browser and refreshed every minute. No clash, no data: the empty state.
 */
export default async function ClashesPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const c = dict.clashes;
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-16 sm:py-24">
        <Container className="max-w-5xl">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">{c.pageTitle}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{c.pageLead}</p>
          <div className="mt-10">
            <ClashBoard apiUrl={siteConfig.apiUrl} dict={c} lang={lang} />
          </div>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
