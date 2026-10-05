import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { defaultLocale, locales } from "@/i18n/config";
import { LOCALE_STORAGE_KEY, negotiateLocale } from "@/i18n/negotiate";
import { challengeRedirect } from "@/lib/challengeLink";
import { claudeRedirect } from "@/lib/claudeLink";
import { rewardsRedirect } from "@/lib/rewards-config";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "404 · VVake", robots: { index: false } };

/**
 * GitHub Pages serves this page for every unknown path, including challenge links (/c/<code>) opened by someone
 * without the app, and Claude Code link codes (/claude/<code>): send those to the localized fallback page
 * (/<lang>/c/#<code>, /<lang>/claude/#<code>), same language rules as "/".
 * The rewards page (/rewards, linked from the app) goes to /<lang>/rewards/ the same way.
 */
const CHALLENGE_REDIRECT = `(function(){
var negotiate=${negotiateLocale.toString()};
var challengeRedirect=${challengeRedirect.toString()};
var claudeRedirect=${claudeRedirect.toString()};
var rewardsRedirect=${rewardsRedirect.toString()};
var supported=${JSON.stringify(locales)};
var saved=null;try{saved=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})}catch(e){}
var prefs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
var lang=saved&&supported.indexOf(saved)>=0?saved:negotiate(prefs,supported,${JSON.stringify(defaultLocale)});
var to=challengeRedirect(location.pathname,lang)||claudeRedirect(location.pathname,lang)||rewardsRedirect(location.pathname,lang);if(to)location.replace(to);
})();`;

export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <script dangerouslySetInnerHTML={{ __html: CHALLENGE_REDIRECT }} />
        <Logo />
        <h1 className="font-display text-4xl font-semibold">404</h1>
        <p className="text-muted">
          {en.notFound.body} <span lang="fr">{fr.notFound.body}</span>
        </p>
        <div className="flex gap-3">
          <Link href="/en/" className="rounded-xl bg-pulse px-5 py-2.5 font-display text-sm font-semibold text-ink">
            {en.notFound.cta}
          </Link>
          <Link href="/fr/" lang="fr" className="rounded-xl border border-line px-5 py-2.5 font-display text-sm font-semibold">
            {fr.notFound.cta}
          </Link>
        </div>
      </body>
    </html>
  );
}
