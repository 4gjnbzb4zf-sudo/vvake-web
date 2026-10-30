"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";

/** /<lang>/app/talk/(?live=0) → /<lang>/app/(?live=0)#/talk (the web app opens the talk sheet). */
export function TalkForward({ lang, label }: { lang: Locale; label: string }) {
  useEffect(() => {
    const live = new URLSearchParams(window.location.search).get("live") === "0" ? "?live=0" : "";
    window.location.replace(`/${lang}/app/${live}#/talk`);
  }, [lang]);
  return (
    <p className="mt-24 text-center">
      <a className="text-muted underline" href={`/${lang}/app/#/talk`}>
        {label}
      </a>
    </p>
  );
}
