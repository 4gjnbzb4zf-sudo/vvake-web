import { MoneyText } from "@/components/ui/Money";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";

/** Optional subscription: tools, comfort and perks, never an edge (game-core plus.ts, ADR-0016). */
export function Plus({ dict, index }: { dict: Dictionary["plus"]; index: string }) {
  return (
    <Section id="plus" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[0.8fr_1.6fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-volt/50 bg-gradient-to-b from-volt/15 to-surface p-6 shadow-[0_24px_60px_-30px_rgb(204_255_0/0.5)]">
          <div aria-hidden="true" className="pointer-events-none absolute -top-2 -right-6 w-32 rotate-6 opacity-90">
            <VVaker sport="runner" color="butter" headgear="cap" accent="volt" eyes="star" mouth="grin" accessory="medal" />
          </div>
          <p className="font-mono text-xs tracking-[0.16em] text-volt uppercase">{dict.name}</p>
          <p className="mt-6 font-display text-6xl leading-none font-bold">
            <MoneyText template={dict.price} usd={5} />
            <span className="ml-1 text-lg font-semibold text-muted">{dict.per}</span>
          </p>
          <p className="mt-2 text-sm text-muted">{dict.yearly}</p>
          <p className="mt-1 font-mono text-xs text-volt">{dict.trial}</p>
          <a
            href="#unlock"
            className="mt-6 flex h-11 items-center justify-center rounded-xl bg-volt font-display text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
          >
            {dict.cta}
          </a>
          <div className="mt-5 rounded-2xl border border-pulse/50 bg-gradient-to-br from-pulse/15 to-transparent p-4">
            <p className="font-mono text-[0.6rem] tracking-[0.12em] text-pulse uppercase">{dict.lifetime.tag}</p>
            <p className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-semibold">♾️ {dict.lifetime.title}</span>
              <span className="font-display text-2xl font-bold">
                <MoneyText template={dict.lifetime.price} usd={149} />
                <span className="ml-1 text-xs font-semibold text-muted">{dict.lifetime.per}</span>
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{dict.lifetime.body}</p>
          </div>
          <div className="mt-6 rounded-2xl border border-down/30 bg-down/5 p-4">
            <p className="font-display text-sm font-semibold">{dict.neverTitle}</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              {dict.never.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="font-mono text-down" aria-hidden="true">
                    ✕
                  </span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {dict.perks.map((p) => (
              <li
                key={p.title}
                className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-volt/40"
              >
                <span aria-hidden="true" className="text-2xl">
                  {p.icon}
                </span>
                <div>
                  <p className="font-display font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-2xl border border-mint/30 bg-mint/5 p-4 text-sm text-text">♻️ {dict.split}</p>
          <p className="mt-3 text-xs leading-relaxed text-faint">{dict.note}</p>
        </div>
      </div>
    </Section>
  );
}
