import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).privacy.title, alternates: { canonical: `/${lang}/privacy/` } };
}

export default async function PrivacyPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-20">
        <Container className="max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{dict.privacy.title}</h1>
          <p className="mt-4 rounded-xl border border-butter/30 bg-butter/10 px-4 py-3 text-sm text-butter">{dict.privacy.updated}</p>
          <div className="mt-10 space-y-8">
            {dict.privacy.sections.map((s) => (
              <section key={s.h}>
                <h2 className="font-display text-xl font-semibold">{s.h}</h2>
                <p className="mt-2 leading-relaxed text-muted">{format(s.p, { email: siteConfig.privacyEmail })}</p>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
