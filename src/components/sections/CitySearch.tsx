"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Country } from "@/lib/cities";
import { cn } from "@/lib/cn";
import { hasExactMatch, searchByName } from "@/lib/search";

export interface SearchableCity {
  slug: string;
  name: string;
  country: Country;
  metroPopulation: number;
}

export type CitySelection = { kind: "city"; slug: string } | { kind: "request"; name: string };

interface CitySearchProps {
  cities: readonly SearchableCity[];
  countryLabels: Record<Country, string>;
  dict: Dictionary["unlock"]["form"];
  selectedName: string;
  onSelect: (selection: CitySelection) => void;
}

type Option = { key: string; label: string; hint: string; selection: CitySelection };

/**
 * Accessible combobox (WAI-ARIA 1.2 list autocomplete): type to filter launch cities (accent-insensitive),
 * or pick "Request “…”" for a city that isn't on the list. Arrow keys, Enter and Escape work as expected.
 */
export function CitySearch({ cities, countryLabels, dict, selectedName, onSelect }: CitySearchProps) {
  const baseId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const text = query ?? selectedName;

  const options = useMemo<Option[]>(() => {
    const q = query?.trim() ?? "";
    const matches = q ? searchByName(cities, q) : [...cities].sort((a, b) => b.metroPopulation - a.metroPopulation).slice(0, 8);
    const list: Option[] = matches.map((c) => ({
      key: c.slug,
      label: c.name,
      hint: countryLabels[c.country],
      selection: { kind: "city", slug: c.slug },
    }));
    if (q.length >= 2 && !hasExactMatch(cities, q)) {
      list.push({ key: "request", label: format(dict.requestOption, { city: q }), hint: "＋", selection: { kind: "request", name: q } });
    }
    return list;
  }, [cities, countryLabels, dict.requestOption, query]);

  function choose(option: Option) {
    onSelect(option.selection);
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(null);
    }
  }

  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  return (
    <div className="relative">
      <label htmlFor={`${baseId}-input`} className="font-display text-sm font-semibold">
        {dict.city}
      </label>
      <input
        id={`${baseId}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={dict.cityPlaceholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="mt-3 h-12 w-full rounded-xl border border-line bg-night px-4 text-text transition-colors outline-none placeholder:text-faint focus:border-pulse-fg"
      />
      <p className="mt-2 text-xs text-faint">{dict.requestHint}</p>

      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={dict.citySuggestions}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface-2 p-1 shadow-2xl shadow-black/50"
        >
          {!query && (
            <li className="px-3 pt-2 pb-1 font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">{dict.citySuggestions}</li>
          )}
          {options.map((o, i) => (
            <li
              key={o.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm",
                i === active ? "bg-pulse/15 text-text" : "text-muted",
                o.selection.kind === "request" && "border-t border-line text-volt-fg",
              )}
            >
              <span>{o.label}</span>
              <span className="font-mono text-[0.65rem] text-faint">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
