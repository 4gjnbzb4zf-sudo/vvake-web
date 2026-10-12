import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { Container } from "@/components/ui/Section";
import { releases } from "@/data/releases";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

const copy: Record<Locale, {
  title: string;
  description: string;
  beta: string;
  store: string;
  iphone: string;
  watch: string;
  added: string;
  improved: string;
  fixed: string;
}> = {
  en: {
    title: "What's new",
    description: "Every VVake release on iPhone and Apple Watch: what was added, improved and fixed.",
    beta: "Beta",
    store: "App Store",
    iphone: "iPhone",
    watch: "Apple Watch",
    added: "New",
    improved: "Improved",
    fixed: "Fixed",
  },
  fr: {
    title: "Nouveautés",
    description: "Chaque version de VVake sur iPhone et Apple Watch : ce qui a été ajouté, amélioré et corrigé.",
    beta: "Bêta",
    store: "App Store",
    iphone: "iPhone",
    watch: "Apple Watch",
    added: "Nouveau",
    improved: "Amélioré",
    fixed: "Corrigé",
  },
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const c = copy[lang];
  return {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${lang}/releases/`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/releases/`])),
    },
  };
}

const dateText = (iso: string, lang: Locale) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Release notes: every app build people can get, newest first (src/data/releases.ts). Linked quietly from the footer. */
export default async function ReleasesPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const c = copy[lang];
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main" className="py-20">
        <Container className="max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{c.title}</h1>
          <p className="mt-3 text-muted">{c.description}</p>
          <ol className="mt-12 space-y-12">
            {releases.map((r) => {
              const n = r.notes[lang];
              const groups = [
                { label: c.added, items: n.added },
                { label: c.improved, items: n.improved },
                { label: c.fixed, items: n.fixed },
              ].filter((g) => g.items?.length);
              return (
                <li key={r.version} id={`v${r.version.replace(/\D+/g, "-").replace(/^-|-$/g, "")}`} className="border-t border-line/60 pt-8">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-display text-xl font-semibold">{r.version}</h2>
                    <span className="text-sm text-faint">{dateText(r.date, lang)}</span>
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{r.channel === "beta" ? c.beta : c.store}</span>
                    <span className="text-xs text-faint">{r.devices.map((d) => c[d]).join(" · ")}</span>
                  </div>
                  {groups.map((g) => (
                    <div key={g.label} className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-faint">{g.label}</h3>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                        {g.items!.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </li>
              );
            })}
          </ol>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
