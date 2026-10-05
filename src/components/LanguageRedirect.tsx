import { Logo } from "@/components/brand/Logo";
import { defaultLocale, localeLabels, locales } from "@/i18n/config";
import { LOCALE_STORAGE_KEY, negotiateLocale } from "@/i18n/negotiate";

/**
 * GitHub Pages can't negotiate languages server-side, so a path without a language decides in the browser:
 * 1. a language the visitor explicitly chose before (saved by the switcher),
 * 2. otherwise the first supported language in the browser/OS preference order,
 * 3. otherwise English. Query string (?ref=, ?city=) and hash are preserved.
 * No-JS visitors get plain links. `path` is the localized page ("" for home, "privacy/").
 */
function redirectScript(path: string): string {
  return `(function(){
var negotiate=${negotiateLocale.toString()};
var supported=${JSON.stringify(locales)};
var saved=null;try{saved=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})}catch(e){}
var prefs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
var lang=saved&&supported.indexOf(saved)>=0?saved:negotiate(prefs,supported,${JSON.stringify(defaultLocale)});
location.replace("/"+lang+"/"+${JSON.stringify(path)}+location.search+location.hash);
})();`;
}

export function LanguageRedirect({ path = "" }: { path?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <script dangerouslySetInnerHTML={{ __html: redirectScript(path) }} />
      <Logo />
      <nav aria-label="Language" className="flex gap-3">
        {locales.map((l) => (
          <a
            key={l}
            href={`/${l}/${path}`}
            hrefLang={l}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted hover:text-text"
          >
            {localeLabels[l]}
          </a>
        ))}
      </nav>
    </main>
  );
}
