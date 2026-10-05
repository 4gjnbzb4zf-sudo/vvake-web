import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { privacy } = getDictionary(lang);
  return {
    title: privacy.title,
    description: privacy.description,
    alternates: {
      canonical: `/${lang}/privacy/`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/privacy/`])),
    },
  };
}

/** The privacy policy (apps, API, desk companion and website), one dictionary per language. */
export default async function PrivacyPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const { privacy } = dict;
  const fill = (text: string) => format(text, { email: siteConfig.privacyEmail });
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-20">
        <Container className="max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{privacy.title}</h1>
          <p className="mt-3 text-sm text-faint">{privacy.updated}</p>
          <p className="mt-4 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{privacy.draft}</p>
          <div className="mt-8 space-y-4">
            {privacy.intro.map((p) => (
              <p key={p} className="leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </div>

          <section aria-labelledby="privacy-summary" className="mt-10 rounded-2xl border border-line bg-surface p-6">
            <h2 id="privacy-summary" className="font-display text-xl font-semibold">
              {privacy.summaryTitle}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted marker:text-pulse-fg">
              {privacy.summary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <nav aria-labelledby="privacy-toc" className="mt-10">
            <h2 id="privacy-toc" className="font-display text-sm font-semibold tracking-wide text-faint uppercase">
              {privacy.tocTitle}
            </h2>
            <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1 pl-5 text-sm text-muted marker:text-faint sm:grid-cols-2">
              {privacy.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-text">
                    {s.h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-10">
            {privacy.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
                <h2 id={`${s.id}-title`} className="font-display text-xl font-semibold">
                  {s.h}
                </h2>
                {s.p.map((p) => (
                  <p key={p} className="mt-3 leading-relaxed text-muted">
                    {fill(p)}
                  </p>
                ))}
                {s.list.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {s.list.map((item) => (
                      <li key={item.t} className="leading-relaxed text-muted">
                        <strong className="font-semibold text-text">{item.t}</strong> {fill(item.d)}
                      </li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => (
                  <p key={p} className="mt-3 leading-relaxed text-muted">
                    {fill(p)}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
