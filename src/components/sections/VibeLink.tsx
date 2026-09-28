import { Container } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * "VV × v/v": the double-V link between VVake and the vibe/vibe launchpad.
 * Text-only reference (no third-party logo), clearly marked independent, and no token offer.
 */
export function VibeLink({ dict }: { dict: Dictionary["vibe"] }) {
  return (
    <section aria-labelledby="vibe-title" className="relative overflow-hidden border-t border-line/60 py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(204_255_0/0.08),transparent_65%)]" />
      <Container className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex items-center justify-center gap-4 font-display font-bold select-none sm:gap-6" aria-hidden="true">
          <span className="text-7xl text-pulse sm:text-9xl">VV</span>
          <span className="text-4xl text-faint sm:text-6xl">×</span>
          <span className="text-7xl text-volt sm:text-9xl">v/v</span>
        </div>
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">{dict.kicker}</p>
          <h2 id="vibe-title" className="mt-4 font-display text-3xl leading-tight font-semibold sm:text-5xl">
            {dict.title}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{dict.body}</p>
          <a
            href={siteConfig.vibeVibeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-volt px-6 font-display text-sm font-semibold text-volt transition-colors hover:bg-volt hover:text-night"
          >
            {dict.link} ↗
          </a>
          <p className="mt-3 font-mono text-xs text-volt/80">{dict.note}</p>
          <p className="mt-4 text-xs leading-relaxed text-faint">{dict.disclaimer}</p>
        </div>
      </Container>
    </section>
  );
}
