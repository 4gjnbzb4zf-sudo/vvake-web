import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountSettings } from "@/components/account/AccountSettings";
import { FrameGuard } from "@/components/rewards/Safety";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { SectionNav } from "@/components/ui/SectionNav";
import { siteConfig } from "@/config/site";
import { getAccountDict } from "@/i18n/account";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getAccountDict(lang);
  return {
    title: t.title,
    description: t.description,
    // A signed-in page: nothing to index (left out of the sitemap too).
    robots: { index: false, follow: true },
    alternates: { canonical: `/${lang}/account/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/account/`])) },
  };
}

/**
 * vvake.com/account: once signed in (the rewards page's e-mail code or the app's link code), every setting and
 * connection the VVake account keeps: profile, app settings, reminders, plan and agenda, coach (calls, memory, undo),
 * health, connections (Google Calendar and Spotify on the watch by redirect), My Pulse, Plus, fresh start, delete.
 * One static page per language; everything live loads in the browser.
 */
export default async function AccountPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = getAccountDict(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <FrameGuard dict={dict.rewards.framed} href={`${siteConfig.url}/${lang}/account/`}>
          <PageIntro kicker={t.kicker} title={t.heading} lead={t.lead} />
          <AccountSettings dict={dict.rewards} t={t} lang={lang} apiUrl={siteConfig.apiUrl} />
        </FrameGuard>
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
