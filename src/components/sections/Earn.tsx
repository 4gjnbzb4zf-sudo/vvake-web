import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

/** Availability tag per item: 0 = day one, 1 = seasons (where legal), 2 = licensed partners, 3 = planned. */
const WHEN_STYLE = ["bg-volt text-night", "bg-butter text-night", "bg-sky text-night", "bg-lilac text-night"] as const;

/**
 * "What you get": everything a member gains beyond health, ordered from what exists on day one
 * to what depends on partners and legal review (C12, C13, C17, C20, C25). No promised returns.
 */
export function Earn({ dict, index }: { dict: Dictionary["earn"]; index: string }) {
  return (
    <Section id="earn" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dict.items.map((item) => (
          <li
            key={item.title}
            className="flex flex-col rounded-3xl border border-line bg-surface/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-volt/40"
          >
            <div className="flex items-start justify-between gap-3">
              <span aria-hidden="true" className="text-3xl">
                {item.icon}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[0.6rem] font-medium tracking-[0.1em] whitespace-nowrap uppercase",
                  WHEN_STYLE[item.when],
                )}
              >
                {dict.when[item.when]}
              </span>
            </div>
            <p className="mt-4 font-display text-lg leading-snug font-semibold">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-transparent to-pulse/10 p-6 sm:p-8 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-volt uppercase">{dict.investors.kicker}</p>
          <h3 className="mt-2 font-display text-2xl leading-tight font-semibold">{dict.investors.title}</h3>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {dict.investors.points.map((p) => (
            <li key={p.title}>
              <a
                href={p.href}
                className="group block h-full rounded-2xl border border-line bg-night/60 p-4 transition-colors hover:border-volt/50"
              >
                <p className="font-display font-semibold">
                  {p.title} <span className="text-volt transition-transform group-hover:translate-x-0.5">→</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.disclaimer}</p>
    </Section>
  );
}
