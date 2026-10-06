import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicRewards } from "@/components/rewards/PublicRewards";
import { RewardsAccount } from "@/components/rewards/RewardsAccount";
import { FrameGuard, ScamWarning } from "@/components/rewards/Safety";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container, Section } from "@/components/ui/Section";
import { SectionNav } from "@/components/ui/SectionNav";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang).rewards;
  return {
    title: dict.title,
    description: dict.description,
    // In the nav, the footer and the sitemap: the prize rules and the public prize pool are for everyone to read.
    alternates: { canonical: `/${lang}/rewards/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/rewards/`])) },
  };
}

/**
 * vvake.com/rewards (the 404 page forwards /rewards here): weekly $VVAKE prizes for moving, claimed from the
 * visitor's own wallet. App Store rules keep linking and claiming out of the iOS app, so they happen here.
 * One static page per language; everything live (account, wallet, chain, public lists) loads in the browser.
 */
export default async function RewardsPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.rewards;
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        {/* Hidden inside a frame (clickjacking): see src/lib/frameGuard.ts. */}
        <FrameGuard dict={t.framed} href={`${siteConfig.url}/${lang}/rewards/`}>
          <PageIntro kicker={t.kicker} title={t.heading} lead={t.lead} />
          <Container>
            <p className="my-8 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{t.testnet}</p>
          </Container>
          <ScamWarning dict={t.scam} />
          <RewardsAccount dict={t} lang={lang} apiUrl={siteConfig.apiUrl} />
          <Section id="how" index={t.how.index} kicker={t.how.kicker} title={t.how.title}>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.how.items.map((item, i) => (
                <li key={item.h} className="rounded-2xl border border-line bg-surface/60 p-6">
                  <p className="font-mono text-xs text-pulse-fg">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold">{item.h}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.p}</p>
                </li>
              ))}
            </ol>
          </Section>
          <PublicRewards dict={t} lang={lang} apiUrl={siteConfig.apiUrl} />
        </FrameGuard>
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
