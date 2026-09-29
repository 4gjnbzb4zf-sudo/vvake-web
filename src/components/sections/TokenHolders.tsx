import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/dictionaries";

const TIER_STYLES = ["border-line", "border-mint/40", "border-volt/40", "border-pulse/50"] as const;
const LINKS = { vibe: siteConfig.vibeVibeUrl, x: siteConfig.social.x, charter: "#open-book", faq: "#faq" } as const;

/** What the planned $VVAKE token is for: holder perks with or without Plus, what stays equal, what it never does (ADR-0020). */
export function TokenHolders({ dict }: { dict: Dictionary["rwa"]["token"] }) {
  return (
    <div className="mt-8 rounded-[2rem] border border-pulse/40 bg-gradient-to-br from-pulse/10 via-transparent to-volt/10 p-6 sm:p-8">
      <p className="font-mono text-xs tracking-[0.18em] text-pulse uppercase">{dict.kicker}</p>
      <h3 className="mt-2 font-display text-2xl leading-tight font-bold sm:text-3xl">{dict.title}</h3>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">{dict.body}</p>

      <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {dict.tiers.map((t, i) => (
          <li key={t.name} className={`flex flex-col rounded-2xl border ${TIER_STYLES[i % TIER_STYLES.length]} bg-night/70 p-5`}>
            <p className="font-display text-lg font-semibold">
              <span aria-hidden="true" className="mr-2">
                {t.icon}
              </span>
              {t.name}
            </p>
            <p className="mt-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-faint uppercase">{t.who}</p>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
              {t.perks.map((p) => (
                <li key={p}>
                  <span className="mr-2 text-volt">→</span>
                  {p}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-mint/40 bg-night/60 p-5">
          <p className="text-sm font-semibold text-mint">{dict.equal.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{dict.equal.body}</p>
        </div>
        <div className="rounded-2xl border border-down/40 bg-night/60 p-5">
          <p className="text-sm font-semibold text-down">{dict.never.title}</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {dict.never.items.map((n) => (
              <li key={n}>✕ {n}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {dict.links.map((l) => {
          const href = LINKS[l.to as keyof typeof LINKS];
          const external = href.startsWith("http");
          return (
            <a
              key={l.to}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-volt hover:text-text"
            >
              {l.label}
              {external ? " ↗" : ""}
            </a>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.notice}</p>
    </div>
  );
}
