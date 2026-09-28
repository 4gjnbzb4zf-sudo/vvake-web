import { LogoMark } from "@/components/brand/Logo";
import { MoneyText } from "@/components/ui/Money";
import { ButtonLink } from "@/components/ui/Button";
import { Marquee } from "@/components/ui/Marquee";
import { Container } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";
import { getCity, RIVALRIES } from "@/lib/cities";
import { AnthemRotator } from "./AnthemRotator";
import { PhoneMock, WatchMock } from "./AppPreview";

interface HeroProps {
  dict: Dictionary["hero"];
  highlights: Dictionary["highlights"];
  app: Dictionary["app"];
}

export function Hero({ dict, highlights, app }: HeroProps) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="bg-voxel-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-pulse/15 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 -bottom-40 h-[380px] w-[520px] rounded-full bg-volt/10 blur-[120px]" />

      <Container className="relative grid items-center gap-14 pt-16 pb-16 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
        <div className="animate-rise">
          <div className="inline-flex max-w-full flex-wrap items-center gap-y-1 rounded-full border border-line bg-surface/70 py-1.5 pr-1.5 pl-2 text-[13px] whitespace-nowrap text-muted sm:flex-nowrap">
            <LogoMark className="h-4 shrink-0" />
            <span className="ml-2.5">{dict.pronounce}</span>
            <span aria-hidden="true" className="mx-2.5 hidden h-4 w-px bg-line sm:block" />
            <a href="#rwa" className="ml-2 rounded-full bg-volt/10 px-3 py-0.5 text-volt transition-colors hover:bg-volt/20 sm:ml-0">
              ⛓️ {dict.chain}
            </a>
          </div>

          <h1 id="hero-title" className="mt-8 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-7xl">
            <span className="sr-only">{dict.anthem.map((line) => `${dict.prefix} ${line}`).join(" ")}</span>
            <span aria-hidden="true" className="block text-text">
              {dict.prefix}
            </span>
            <span aria-hidden="true" className="text-gradient-pulse block pb-2">
              <AnthemRotator lines={dict.anthem} />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{dict.lead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#unlock">{dict.ctaPrimary}</ButtonLink>
            <ButtonLink href="#earn" variant="ghost">
              {dict.ctaSecondary}
            </ButtonLink>
          </div>
        </div>

        <HeroDevices hero={dict} app={app} />
      </Container>

      <div className="relative z-10 -mx-4 -rotate-1 border-y-2 border-volt/40 bg-night-2 py-4 font-mono text-xs tracking-[0.2em] text-volt uppercase italic">
        <Marquee items={[...highlights.strip, ...RIVALRY_TICKER]} />
      </div>
    </section>
  );
}

/** City names are proper nouns, so the rivalry ticker is shared by every locale. */
const RIVALRY_TICKER = RIVALRIES.map((r) => r.cities.map((slug) => getCity(slug)?.name ?? slug).join(" vs "));

const DOWN = "#e07856";
const UP = "#5bd08a";
const CANDLES = [
  { x: 40, open: 250, close: 290, color: DOWN },
  { x: 70, open: 230, close: 280, color: UP },
  { x: 100, open: 260, close: 300, color: DOWN },
  { x: 130, open: 240, close: 270, color: DOWN },
] as const;

/** Floating voxel "pixels" around the crew: deterministic positions so SSR and client match. */
const PIXELS = [
  { left: "8%", top: "14%", size: 10, color: "bg-pulse", delay: "0s" },
  { left: "22%", top: "4%", size: 7, color: "bg-volt", delay: "-1.5s" },
  { left: "86%", top: "10%", size: 9, color: "bg-lilac", delay: "-3s" },
  { left: "94%", top: "30%", size: 6, color: "bg-volt", delay: "-2s" },
  { left: "4%", top: "70%", size: 8, color: "bg-mint", delay: "-4s" },
  { left: "60%", top: "92%", size: 7, color: "bg-pulse", delay: "-1s" },
  { left: "78%", top: "84%", size: 10, color: "bg-butter", delay: "-5s" },
  { left: "40%", top: "0%", size: 6, color: "bg-sky", delay: "-2.5s" },
] as const;

/** Training first, wealth a close second: the phone + watch in action, a heartbeat line out of market candles. */
function HeroDevices({ hero, app }: { hero: Dictionary["hero"]; app: Dictionary["app"] }) {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-6">
      <svg viewBox="0 0 520 520" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <g opacity="0.4">
          {CANDLES.map((c) => (
            <g key={c.x}>
              <path d={`M${c.x + 7} ${c.open - 14} V${c.close + 14}`} stroke={c.color} strokeWidth="2" />
              <rect x={c.x} y={c.open} width="14" height={c.close - c.open} rx="2" fill={c.color} />
            </g>
          ))}
        </g>
        <path
          d="M0 262 H200 L215 262 L228 200 L244 330 L258 262 H300 L312 236 L324 286 L334 262 H520"
          stroke="#ccff00"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-draw [animation-delay:400ms]"
          opacity="0.5"
        />
      </svg>
      {PIXELS.map((p) => (
        <span
          key={`${p.left}-${p.top}`}
          aria-hidden="true"
          className={`absolute animate-float rounded-[2px] ${p.color} opacity-70`}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
        />
      ))}

      <div className="relative mx-auto w-fit" aria-hidden="true">
        <div className="pointer-events-none absolute inset-x-0 top-10 bottom-0 rounded-full bg-pulse/20 blur-[80px]" />
        <div className="relative -rotate-2">
          <PhoneMock dict={app.phone} />
        </div>
        <div className="absolute -right-16 -bottom-4 origin-bottom-right scale-[0.62] rotate-3 sm:-right-40 sm:scale-100">
          <WatchMock dict={app.watch} />
        </div>
        <div className="absolute -top-10 -right-12 hidden w-20 animate-float sm:block">
          <VVaker color="butter" sport="lifter" headgear="cap" accent="ocean" eyes="fired" mouth="teeth" energy={3} />
        </div>
      </div>

      <div className="absolute bottom-20 -left-2 w-44 -rotate-3 animate-float rounded-xl bg-mint p-3 text-night shadow-[0_18px_40px_-12px_rgb(91_208_138/0.55)] [animation-delay:-2s] sm:-left-16">
        <p className="font-display text-lg leading-tight font-bold">
          📈 <MoneyText template={hero.wealthChip} usd={1} />
        </p>
        <p className="mt-1 font-mono text-[0.58rem] leading-tight tracking-[0.06em] uppercase">{hero.wealthNote}</p>
      </div>
    </div>
  );
}
