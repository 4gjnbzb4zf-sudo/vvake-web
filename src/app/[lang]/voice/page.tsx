import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { VoiceGroupSection, VoiceHow } from "@/components/sections/VoiceCommands";
import { SectionNav } from "@/components/ui/SectionNav";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { groupVoiceCommands } from "@/lib/voiceCommands";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang).voice;
  return {
    title: dict.kicker,
    description: dict.description,
    alternates: { canonical: `/${lang}/voice/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/voice/`])) },
  };
}

/**
 * The app's voice commands (/<lang>/voice/), grouped by category, with example phrases in both languages.
 * The list comes from the VVFit export in src/data/voice-commands.json (see src/lib/voiceCommands.ts).
 */
export default async function VoicePage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.voice;
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={t.kicker} title={t.title} lead={t.lead} />
        <VoiceHow dict={t} index="01" />
        {groupVoiceCommands().map((group, i) => (
          <VoiceGroupSection key={group.category.key} group={group} index={String(i + 2).padStart(2, "0")} lang={lang} dict={t} />
        ))}
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
