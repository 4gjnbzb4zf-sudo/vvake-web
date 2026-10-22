import { Container } from "@/components/ui/Section";
import { COACH_PLAN_PRICES, COACH_PACKS } from "@/data/coachPlans";
import type { Dictionary } from "@/i18n/dictionaries/en";

const format = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? `{${k}}`));
const usd = (n: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "USD" }).format(n);

/**
 * vvake.com/plus: Free / Plus / Coach Pro side by side and the minute packs (ADR-0051). Static: the planned prices,
 * each marked "Coming soon" (payments stay off until the store products exist). Same numbers as the API's defaults.
 */
export function CoachPlans({ t, lang }: { t: Dictionary["plusPay"]["plans"]; lang: string }) {
  const tiers = [
    { id: "free" as const, price: t.current },
    { id: "plus" as const, price: format(t.perMonth, { price: usd(COACH_PLAN_PRICES.plus, lang) }) },
    { id: "pro" as const, price: format(t.perMonth, { price: usd(COACH_PLAN_PRICES.pro, lang) }) },
  ];
  return (
    <section
      id="plans"
      aria-labelledby="plans-title"
      data-nav={t.kicker}
      data-nav-index={t.index}
      className="border-t border-line/60 py-16"
    >
      <Container>
        <p className="font-mono text-xs tracking-widest text-faint uppercase">
          {t.index} · {t.kicker}
        </p>
        <h2 id="plans-title" className="mt-3 font-display text-3xl font-semibold">
          {t.title}
        </h2>
        <p className="mt-3 max-w-3xl text-muted">{t.lead}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {tiers.map((x) => (
            <div
              key={x.id}
              className={`rounded-2xl border p-5 ${x.id === "pro" ? "border-lilac/60 bg-lilac/5" : "border-line bg-surface/60"}`}
            >
              <h3 className="font-display text-xl font-semibold">{t.tiers[x.id].name}</h3>
              <p className="mt-1 text-sm text-muted">
                {x.price}
                {x.id !== "free" && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs text-faint">{t.soon}</span>}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {t.tiers[x.id].lines.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span aria-hidden="true">✓</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <h3 className="mt-10 font-display text-xl font-semibold">{t.packsTitle}</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted">{t.packsLead}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-xl">
          {COACH_PACKS.map((p) => (
            <div key={p.minutes} className="rounded-xl border border-line bg-surface/60 p-4">
              <p className="font-display text-lg font-semibold">{format(t.pack, { n: p.minutes })}</p>
              <p className="text-sm text-muted">{usd(p.usd, lang)}</p>
              <p className="mt-1 text-xs text-faint">{t.soon}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs text-faint">{t.fine}</p>
      </Container>
    </section>
  );
}
