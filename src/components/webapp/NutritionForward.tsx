"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { NUTRITION_VIEWS } from "./AppContext";

/** /<lang>/app/nutrition/(?view=plan) → /<lang>/app/#/nutrition(/plan) (the web app opens Nutrition). */
export function NutritionForward({ lang, label }: { lang: Locale; label: string }) {
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view") ?? "";
    const view = (NUTRITION_VIEWS as readonly string[]).includes(v) && v !== "today" ? `/${v}` : "";
    window.location.replace(`/${lang}/app/#/nutrition${view}`);
  }, [lang]);
  return (
    <p className="mt-24 text-center">
      <a className="text-muted underline" href={`/${lang}/app/#/nutrition`}>
        {label}
      </a>
    </p>
  );
}
