"use client";

import { useId, useState } from "react";
import { COUNTRIES, type Country } from "@/lib/cities";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

export interface RivalryView {
  id: keyof Dictionary["rivalries"]["stories"];
  country: Country;
  sides: readonly [{ name: string; threshold: number }, { name: string; threshold: number }];
}

interface RivalriesProps {
  dict: Dictionary["rivalries"];
  rivalries: readonly RivalryView[];
  numberLocale: string;
}

export function RivalryBoard({ dict, rivalries, numberLocale }: RivalriesProps) {
  const [country, setCountry] = useState<Country>("FR");
  const baseId = useId();
  const nf = new Intl.NumberFormat(numberLocale);

  return (
    <div className="mt-12">
      <div role="tablist" aria-label={dict.title} className="inline-flex rounded-xl border border-line bg-surface p-1">
        {COUNTRIES.map((c) => (
          <button
            key={c}
            id={`${baseId}-tab-${c}`}
            role="tab"
            type="button"
            aria-selected={country === c}
            aria-controls={`${baseId}-panel`}
            onClick={() => setCountry(c)}
            className={cn(
              "rounded-lg px-3.5 py-2 font-display text-sm font-semibold transition-colors sm:px-5",
              country === c ? "bg-pulse text-ink" : "text-muted hover:text-text",
            )}
          >
            {dict.tabs[c]}
          </button>
        ))}
      </div>

      <ul id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${country}`} className="mt-8 grid gap-3 md:grid-cols-2">
        {rivalries
          .filter((r) => r.country === country)
          .map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface/60 p-5 transition-colors hover:border-pulse-fg/40">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <Side name={r.sides[0].name} threshold={nf.format(r.sides[0].threshold)} caption={dict.toUnlock} />
                <span className="font-mono text-xs tracking-widest text-pulse-fg uppercase">{dict.vs}</span>
                <Side name={r.sides[1].name} threshold={nf.format(r.sides[1].threshold)} caption={dict.toUnlock} align="right" />
              </div>
              <p className="mt-4 border-t border-line pt-3 text-sm text-muted">{dict.stories[r.id]}</p>
            </li>
          ))}
      </ul>
      <p className="mt-6 text-sm text-faint">{dict.perCapita}</p>
    </div>
  );
}

function Side({
  name,
  threshold,
  caption,
  align = "left",
}: {
  name: string;
  threshold: string;
  caption: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p className="font-display text-lg leading-tight font-semibold">{name}</p>
      <p className="mt-1 font-mono text-xs text-faint">
        <span className="text-volt-fg">{threshold}</span> {caption}
      </p>
    </div>
  );
}
