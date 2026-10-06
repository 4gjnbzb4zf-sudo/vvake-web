import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { terms } = getDictionary(lang);
  return {
    title: terms.title,
    description: terms.description,
    alternates: {
      canonical: `/${lang}/terms/`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/terms/`])),
    },
  };
}

/**
 * Health & safety and your responsibility: the disclaimer the apps ask everyone to accept (the same text, version 1;
 * the apps' lib/disclaimer.ts). The site follows the apps: change both together.
 */
export default async function TermsPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const { terms } = dict;
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-20">
        <Container className="max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{terms.title}</h1>
          <p className="mt-3 text-sm text-faint">{terms.updated}</p>

          <section aria-labelledby="terms-short" className="mt-10 rounded-2xl border border-line bg-surface p-6">
            <h2 id="terms-short" className="font-display text-xl font-semibold">
              {terms.shortTitle}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted marker:text-pulse-fg">
              {terms.short.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <p className="mt-6 leading-relaxed text-muted">{terms.accept}</p>

          <div className="mt-12 space-y-10">
            {terms.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
                <h2 id={`${s.id}-title`} className="font-display text-xl font-semibold">
                  {s.h}
                </h2>
                <p className="mt-3 leading-relaxed text-muted">{s.p}</p>
              </section>
            ))}
          </div>

          <p className="mt-12 text-sm text-muted">
            {terms.privacy}{" "}
            <a href={`/${lang}/privacy/`} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {terms.privacyLink}
            </a>
          </p>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
