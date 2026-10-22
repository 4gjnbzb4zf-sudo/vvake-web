"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { placesAppPath } from "@/lib/webapp/places";

/** /<lang>/app/places/?sport=swim → /<lang>/app/#/places/swim (the web app's hash route). */
export function PlacesForward({ lang, label }: { lang: Locale; label: string }) {
  useEffect(() => {
    window.location.replace(placesAppPath(lang, new URLSearchParams(window.location.search).get("sport")));
  }, [lang]);
  return (
    <p className="mt-24 text-center">
      <a className="text-muted underline" href={`/${lang}/app/#/places`}>
        {label}
      </a>
    </p>
  );
}
