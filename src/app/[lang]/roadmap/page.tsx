import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { meta } = getDictionary(lang).roadmap;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/${lang}/roadmap/`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/roadmap/`])),
    },
  };
}

const STAGE_STYLES = ["border-mint-fg/50", "border-volt-fg/50", "border-pulse-fg/50", "border-line", "border-line"] as const;
const TAG_STYLES = ["bg-mint text-ink", "bg-volt text-ink", "bg-pulse text-ink", "bg-surface text-text", "bg-surface text-text"] as const;

/** A realistic roadmap: stages, never dates (now / next / after funding / after that / later), what isn't done, how to help. */
export default async function RoadmapPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const r = dict.roadmap;
  const HREF: Record<string, string> = {
    waitlist: `/${lang}/#unlock`,
    x: siteConfig.social.x,
    backers: `/${lang}/backers/`,
    contact: `mailto:${siteConfig.partnersEmail}`,
  };
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={r.kicker} title={r.title} lead={r.lead} />
        <Container className="py-16 sm:py-20">
          <ol className="relative space-y-4 border-l border-line/60 pl-6 sm:pl-8">
            {r.stages.map((s, i) => (
              <li key={s.tag} className={`relative rounded-3xl border ${STAGE_STYLES[i % STAGE_STYLES.length]} bg-surface/50 p-6 sm:p-8`}>
                <span aria-hidden="true" className="absolute top-8 -left-[1.95rem] h-3 w-3 rounded-full bg-volt sm:-left-[2.45rem]" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className={`rounded-md px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.12em] uppercase ${TAG_STYLES[i % TAG_STYLES.length]}`}
                  >
                    {String(i + 1).padStart(2, "0")} · {s.tag}
                  </span>
                  <span className="font-mono text-[0.65rem] tracking-[0.08em] text-faint uppercase">{s.status}</span>
                </div>
                <h2 className="mt-4 font-display text-2xl leading-snug font-semibold">{s.title}</h2>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
                  {s.items.map((item) => (
                    <li key={item}>
                      <span className="mr-2 text-volt-fg">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-down-fg/30 bg-down/5 p-6">
              <h2 className="font-display text-xl font-semibold">{r.notDone.title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {r.notDone.items.map((item) => (
                  <li key={item}>
                    <span className="mr-2 font-mono text-down-fg">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-volt-fg/30 bg-volt/5 p-6">
              <h2 className="font-display text-xl font-semibold">{r.help.title}</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {r.help.items.map((h) => {
                  const href = HREF[h.to] ?? `/${lang}/`;
                  const external = href.startsWith("http");
                  return (
                    <li key={h.to}>
                      <a
                        href={href}
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="font-semibold text-text underline decoration-volt-fg/60 underline-offset-4 hover:decoration-volt-fg"
                      >
                        {h.label}
                        {external ? " ↗" : ""}
                      </a>
                      <p className="mt-0.5 text-muted">{h.body}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-faint">{r.notice}</p>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
