import { Marquee } from "@/components/ui/Marquee";
import { Container } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

export function DoubleV({ dict, anthem }: { dict: Dictionary["doubleV"]; anthem: { prefix: string; lines: readonly string[] } }) {
  return (
    <section aria-labelledby="doublev-title" className="relative overflow-hidden pt-20 pb-10 sm:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-72 -translate-y-1/2 bg-gradient-to-r from-pulse/10 via-transparent to-volt/10 blur-3xl" />
      <Container className="relative flex flex-col items-center text-center">
        <div className="flex items-end gap-3 font-display text-7xl font-bold sm:text-9xl" aria-hidden="true">
          <span className="text-pulse-fg">V</span>
          <span className="-ml-6 text-pulse-soft-fg sm:-ml-10">V</span>
          <span className="px-3 text-4xl text-faint sm:text-6xl">=</span>
          <span className="text-volt-fg">W</span>
        </div>
        <h2 id="doublev-title" className="mt-8 font-display text-3xl font-semibold sm:text-5xl">
          {dict.title}
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{dict.body}</p>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {dict.words.map((w) => (
            <li key={w} className="rounded-full border border-line bg-surface px-5 py-2 font-display text-sm font-semibold">
              <span className="text-pulse-fg">{w.charAt(0)}</span>
              {w.slice(1)}
            </li>
          ))}
        </ul>
        <p className="mt-8 font-mono text-sm tracking-[0.2em] text-volt-fg uppercase">{dict.healthIsWealth}</p>
      </Container>
      <div className="relative mt-20 -rotate-2 border-y-2 border-night bg-pulse py-4 font-display text-2xl font-bold text-ink uppercase sm:text-3xl">
        <Marquee items={anthem.lines.map((line) => `${anthem.prefix} ${line}`)} separator="♥" />
      </div>
    </section>
  );
}
