import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { SectionNav } from "@/components/ui/SectionNav";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { Page } from "@/lib/routes";

type SubPage = Exclude<Page, "">;
const KEYS = { "app/": "app", "vvaker/": "vvaker", "backers/": "backers" } as const;

export function subpageMetadata(lang: Locale, page: SubPage): Metadata {
  const intro = getDictionary(lang).pages[KEYS[page]];
  return {
    title: intro.kicker,
    description: intro.lead,
    alternates: {
      canonical: `/${lang}/${page}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/${page}`])),
    },
  };
}

/** A deeper page: header, intro, its sections (numbered from 01, with the section navigator), footer. */
export function Subpage({ lang, page, children }: { lang: Locale; page: SubPage; children: ReactNode }) {
  const dict = getDictionary(lang);
  const intro = dict.pages[KEYS[page]];
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={intro.kicker} title={intro.title} lead={intro.lead} />
        {children}
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
