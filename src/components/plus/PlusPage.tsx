import { CoachPlans } from "@/components/plus/CoachPlans";
import { PlusCheckout } from "@/components/plus/PlusCheckout";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container } from "@/components/ui/Section";
import { SectionNav } from "@/components/ui/SectionNav";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * vvake.com/<lang>/plans/ and the pages Stripe's checkout comes back to (/plus/success/, /plus/cancel/): the same page,
 * with a line saying how the checkout ended. Everything live loads in the browser (sign-in, price, invoice, card).
 */
export function PlusPage({ lang, notice }: { lang: Locale; notice?: "success" | "cancel" }) {
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
        <CoachPlans t={t.plans} lang={lang} />
        <PlusCheckout dict={t} rewards={dict.rewards} lang={lang} apiUrl={siteConfig.apiUrl} notice={notice} />
      </main>
      <Footer locale={lang} dict={dict.footer} />
      <SectionNav label={dict.nav.sections} open={dict.nav.jump} />
    </>
  );
}
