import { Logo } from "@/components/brand/Logo";
import { Container, Section } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { sectionHref } from "@/lib/routes";

export function Dev({ dict, index }: { dict: Dictionary["dev"]; index: string }) {
  return (
    <Section id="dev" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div data-theme="dark" className="mt-12 overflow-hidden rounded-2xl border border-line bg-[#0b0d0f] shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-down/70" />
          <span className="h-3 w-3 rounded-full bg-butter/70" />
          <span className="h-3 w-3 rounded-full bg-up/70" />
          <span className="ml-3 font-mono text-xs text-faint">~/ship-it</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-sm leading-7 sm:p-6">
          {dict.terminal.map((line, i) => (
            <code
              key={line}
              className={i === 0 ? "block text-muted" : i === dict.terminal.length - 1 ? "block text-volt-fg" : "block text-text"}
            >
              {line}
            </code>
          ))}
        </pre>
      </div>
      <p className="mt-3 font-mono text-xs text-volt-fg">{dict.worksWith}</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dict.features.map((f, i) => (
          <li key={f.title} className="rounded-3xl border border-line bg-surface/60 p-5 transition-colors hover:border-volt-fg/40">
            <span className="font-mono text-xs text-pulse-fg">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-faint">{dict.note}</p>
    </Section>
  );
}

/** Short answers on demand; the details live on the deeper pages (linked from the answer where there is one). */
export function Faq({ locale, dict }: { locale: Locale; dict: Dictionary["faq"] }) {
  return (
    <Section id="faq" title={dict.title} nav={dict.title}>
      <div className="mt-10 divide-y divide-line rounded-3xl border border-line bg-surface/50">
        {dict.items.map((item) => (
          <details key={item.q} className="group px-6 py-5 sm:px-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="font-mono text-pulse-fg transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted">
              {item.a}
              {"link" in item && (
                <>
                  {" "}
                  <a
                    href={`/${locale}/${item.link}`}
                    className="font-semibold whitespace-nowrap text-pulse-fg underline-offset-4 hover:underline"
                  >
                    {dict.more} →
                  </a>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary["footer"] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line/60 py-14">
      <Container>
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <Logo />
            <p className="mt-3 font-display text-sm text-muted">{dict.tagline}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-muted">
            <a href={`/${locale}/privacy/`} className="hover:text-text">
              {dict.privacy}
            </a>
            <a href={`/${locale}/rewards/`} className="hover:text-text">
              {dict.rewards}
            </a>
            <a href={sectionHref(locale, "partners")} className="hover:text-text">
              {dict.partners}
            </a>
            <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-text">
              {dict.contact}
            </a>
            <a href={siteConfig.social.x} target="_blank" rel="noopener noreferrer" className="hover:text-text">
              X {siteConfig.social.xHandle}
            </a>
          </nav>
        </div>
        <p className="mt-10 max-w-4xl text-xs leading-relaxed text-faint">{dict.legal}</p>
        <p className="mt-4 text-xs text-faint">
          © {year} VVake. {dict.rights}
        </p>
      </Container>
    </footer>
  );
}
