"use client";

import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CURRENCIES, CURRENCY_STORAGE_KEY, DEFAULT_CURRENCY, fillMoney, isCurrency, type Currency } from "@/lib/currency";

const EVENT = "vvake-currency";

function read(): Currency {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isCurrency(saved) ? saved : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The visitor's display currency: USD on the server and until they choose another one. */
export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_CURRENCY);
}

function setCurrency(c: Currency) {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page view only.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Text with a {money} placeholder, shown as a round example amount in the visitor's currency. */
export function MoneyText({ template, usd }: { template: string; usd: number }) {
  const currency = useCurrency();
  const { lang } = useParams<{ lang: string }>();
  return <>{fillMoney(template, usd, currency, lang ?? "en")}</>;
}

export function CurrencySelect({ label }: { label: string }) {
  const currency = useCurrency();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={currency}
        onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)}
        title={label}
        className="h-[34px] cursor-pointer appearance-none rounded-lg border border-line bg-transparent pr-6 pl-2.5 font-mono text-xs text-muted transition-colors hover:text-text focus:text-text"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c} className="bg-night text-text">
            {c}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 text-[0.6rem] text-faint">
        ▾
      </span>
    </label>
  );
}
