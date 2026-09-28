import { Logo } from "@/components/brand/Logo";
import { localeLabels, locales } from "@/i18n/config";

/**
 * GitHub Pages can't redirect by header, so "/" picks a language in the browser
 * (keeping ?ref= and ?city= for referrals). No-JS visitors get plain links.
 */
const REDIRECT = `(function(){try{var l=(navigator.languages||[navigator.language||"en"]).map(function(x){return String(x).toLowerCase()});var fr=l.some(function(x){return x.indexOf("fr")===0});location.replace("/"+(fr?"fr":"en")+"/"+location.search+location.hash)}catch(e){location.replace("/en/")}})();`;

export default function RootPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <script dangerouslySetInnerHTML={{ __html: REDIRECT }} />
      <Logo />
      <nav aria-label="Language" className="flex gap-3">
        {locales.map((l) => (
          <a key={l} href={`/${l}/`} hrefLang={l} className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted hover:text-text">
            {localeLabels[l]}
          </a>
        ))}
      </nav>
    </main>
  );
}
