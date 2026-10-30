"use client";

import { useEffect, useMemo, useState } from "react";
import { getNutritionDict } from "@/i18n/nutrition";
import { localTz } from "@/lib/webapp/api";
import { localDay } from "@/lib/webapp/format";
import { dayLoadOf, NUTRITION_TEXT, nutritionText } from "@/lib/webapp/nutrition/core";
import { nutritionApi, type NutritionDay } from "@/lib/webapp/nutrition/nutritionApi";
import { useApp } from "./AppContext";
import { Row } from "./ui";

/**
 * Today's "Fuel" line (ADR-0070): only when Nutrition is on, one row in Today's last slot (the ≤ 4 cards rule): the
 * day's calm status in words (never a number here), a tap opens Nutrition, "Log a meal" opens the log. Quiet doesn't
 * hide it: it's the athlete's own data, not a suggestion. Nothing while a workout runs (Today isn't shown then).
 */
export function FuelRow() {
  const { featureOn, session, lang, go } = useApp();
  const on = featureOn("nutrition");
  const api = useMemo(() => nutritionApi(session), [session]);
  const [day, setDay] = useState<NutritionDay | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    api
      .day(localDay(Date.now()), localTz())
      .then((d) => live && setDay(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api, on]);
  if (!on) return null;
  const tn = getNutritionDict(lang);
  const key = day?.status.lineKey ?? "";
  const line = NUTRITION_TEXT[key] ? nutritionText(key, lang) : tn.lead;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      <Row tone="mint" icon="🍽" title={tn.title} detail={line} onClick={() => go({ name: "nutrition" })} />
      <Row tone="volt" icon="+" title={tn.log.title} onClick={() => go({ name: "nutrition", view: "log" })} />
    </div>
  );
}

/**
 * The recovery-meal tip after a web workout (ADR-0070, suggest kind `recovery_meal`): only when Nutrition is on, only
 * after a hard or long session (game-core dayLoadOf), only when Quiet allows it (suggestAllowed; never during a
 * workout: the summary comes after it). One calm line, a door to ideas, dismissed for this visit with one tap.
 */
export function RecoveryTip({ minutes, feltHard }: { minutes: number; feltHard: boolean }) {
  const { featureOn, suggests, lang, go } = useApp();
  const [gone, setGone] = useState(false);
  const load = dayLoadOf({ doneMin: minutes, doneHard: feltHard });
  if (gone || !featureOn("nutrition") || (load !== "hard" && load !== "long") || !suggests("recovery_meal")) return null;
  const r = getNutritionDict(lang).recovery;
  return (
    <section className="rounded-2xl border border-mint-fg/40 bg-surface p-4">
      <p className="font-display font-semibold text-mint-fg">{r.title}</p>
      <p className="mt-1 text-sm">{r.line}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 text-sm font-semibold"
          onClick={() => go({ name: "nutrition", view: "ideas" })}
        >
          {r.ideas}
        </button>
        <button type="button" className="min-h-11 flex-1 rounded-xl text-sm text-muted" onClick={() => setGone(true)}>
          {r.dismiss}
        </button>
      </div>
    </section>
  );
}
