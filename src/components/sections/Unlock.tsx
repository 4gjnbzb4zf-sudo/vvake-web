import { Suspense } from "react";
import { Section } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { CITIES, rivalOf, thresholdFor } from "@/lib/cities";
import { WaitlistForm, type CityOption } from "./WaitlistForm";

const TIER_ACCENTS = ["border-volt/50 text-volt", "border-pulse/50 text-pulse", "border-calm/50 text-calm"] as const;

export function Unlock({
  locale,
  dict,
  countryLabels,
  index,
}: {
  locale: Locale;
  dict: Dictionary["unlock"];
  countryLabels: Dictionary["rivalries"]["tabs"];
  index: string;
}) {
  const cities: CityOption[] = [...CITIES.values()].map((c) => ({
    slug: c.slug,
    name: c.name,
    country: c.country,
    threshold: thresholdFor(c.slug),
    rivalSlug: rivalOf(c.slug)?.slug ?? null,
  }));

  return (
    <Section id="unlock" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12">
        {/* useSearchParams needs a Suspense boundary in a static export; the fallback keeps the layout stable. */}
        <Suspense fallback={<div className="h-[420px] rounded-3xl border border-line bg-surface/40" />}>
          <WaitlistForm
            locale={locale}
            dict={dict}
            countryLabels={countryLabels}
            cities={cities}
            endpoint={siteConfig.waitlistEndpoint}
            siteUrl={siteConfig.url}
            privacyHref={`/${locale}/privacy/`}
            social={siteConfig.social}
          />
        </Suspense>
      </div>

      <div className="mt-16">
        <h3 className="font-display text-2xl font-semibold">{dict.tiersTitle}</h3>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {dict.tiers.map((tier, i) => (
            <li key={tier.name} className="rounded-3xl border border-line bg-surface/60 p-6">
              <span
                className={`inline-flex rounded-full border px-3 py-1 font-mono text-xs tracking-[0.15em] uppercase ${TIER_ACCENTS[i]}`}
              >
                {tier.who}
              </span>
              <p className="mt-4 font-display text-xl font-semibold">{tier.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tier.perks}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-faint">{dict.tiersNote}</p>
      </div>
    </Section>
  );
}
