import type { Locale } from "@/i18n/config";

/**
 * The old plans address (/<lang>/plus/) on a static export: a meta refresh, a script that keeps the query and the
 * hash (/plus/#plans → /plans/#plans), and a plain link for everyone else. Not indexed; its canonical is /<lang>/plans/.
 */
export function PlansRedirect({ lang, label }: { lang: Locale; label: string }) {
  const to = `/${lang}/plans/`;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(to)}+location.search+location.hash);` }} />
      <a href={to} className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted hover:text-text">
        {label}
      </a>
    </main>
  );
}
