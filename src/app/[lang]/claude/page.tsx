import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaudeLink } from "@/components/sections/ClaudeLink";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).claude.title, robots: { index: false, follow: false } };
}

/**
 * Fallback for Claude Code link codes (vvake.com/claude/<code>) when the link opens in a browser instead of the app:
 * the 404 page forwards here with the code in the hash (/<lang>/claude/#<code>). One static page per language; the
 * code is read in the browser, no API call.
 */
export default async function ClaudePage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-16 sm:py-24">
        <Container className="max-w-2xl">
          <ClaudeLink dict={dict.claude} appScheme={siteConfig.appScheme} joinHref={`/${lang}/#unlock`} />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
