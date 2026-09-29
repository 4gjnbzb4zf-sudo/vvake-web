import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/dictionaries";

const TIER_STYLES = ["border-line", "border-mint-fg/40", "border-volt-fg/40", "border-pulse-fg/50"] as const;
const LINKS = { vibe: siteConfig.vibeVibeUrl, x: siteConfig.social.x, charter: "#open-book", faq: "#faq" } as const;

/** What the planned $VVAKE token is for: holder perks with or without Plus, what stays equal, what it never does (ADR-0020). */
export function TokenHolders({ dict }: { dict: Dictionary["rwa"]["token"] }) {
  return (
    <div className="mt-8 rounded-[2rem] border border-pulse-fg/40 bg-gradient-to-br from-pulse/10 via-transparent to-volt/10 p-6 sm:p-8">
      <p className="font-mono text-xs tracking-[0.18em] text-pulse-fg uppercase">{dict.kicker}</p>
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
                  <span className="mr-2 text-volt-fg">→</span>
                  {p}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <p className="font-display text-xl font-semibold">{dict.levels.title}</p>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{dict.levels.body}</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dict.levels.items.map((l, i) => (
            <li key={l.name} className="relative rounded-2xl border border-line bg-night/70 p-5">
              <div
                aria-hidden="true"
                className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-pulse"
                style={{ opacity: 0.35 + i * 0.2 }}
              />
              <p className="font-display text-lg font-semibold">
                <span aria-hidden="true" className="mr-2">
                  {l.icon}
                </span>
                {l.name}
              </p>
              <p className="mt-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-faint uppercase">{l.hold}</p>
              <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
                {i > 0 && <li className="text-faint">+ {dict.levels.items[i - 1]!.name}</li>}
                {l.perks.map((p) => (
                  <li key={p}>
                    <span className="mr-2 text-volt-fg">→</span>
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-xs text-mint-fg">🗳️ {dict.levels.vote}</p>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-line bg-night/60 p-5">
          <p className="font-display text-xl font-semibold">{dict.tokenomics.title}</p>
          <dl className="mt-3 divide-y divide-line text-sm">
            {dict.tokenomics.items.map((t) => (
              <div key={t.label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted">{t.label}</dt>
                <dd className="text-right font-mono text-xs text-text">{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-pulse-fg/50 bg-gradient-to-br from-pulse/15 to-night/60 p-5">
          <p className="font-display text-xl font-semibold">{dict.burn.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{dict.burn.body}</p>
          <ol className="mt-3 space-y-1.5 text-sm">
            {dict.burn.steps.map((s, i) => (
              <li key={s}>
                <span className="mr-2 font-mono text-pulse-fg">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-faint">{dict.burn.note}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-mint-fg/40 bg-night/60 p-5">
          <p className="text-sm font-semibold text-mint-fg">{dict.equal.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{dict.equal.body}</p>
        </div>
        <div className="rounded-2xl border border-down-fg/40 bg-night/60 p-5">
          <p className="text-sm font-semibold text-down-fg">{dict.never.title}</p>
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
              className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-volt-fg hover:text-text"
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
