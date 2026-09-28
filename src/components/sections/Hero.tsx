import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";
import { AnthemRotator } from "./AnthemRotator";

export function Hero({ dict }: { dict: Dictionary["hero"] }) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="bg-voxel-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-pulse/15 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 -bottom-40 h-[380px] w-[520px] rounded-full bg-volt/10 blur-[120px]" />

      <Container className="relative grid items-center gap-14 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:pb-28">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/70 py-1.5 pr-4 pl-2 text-sm text-muted">
            <LogoMark className="h-5" />
            <span>{dict.pronounce}</span>
          </p>

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
            <ButtonLink href="#story" variant="ghost">
              {dict.ctaSecondary}
            </ButtonLink>
          </div>

          <ul className="mt-10 flex flex-wrap gap-2">
            {dict.chips.map((chip) => (
              <li key={chip} className="rounded-full border border-line bg-surface/60 px-3.5 py-1.5 font-mono text-xs text-muted">
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <HeroCrew />
      </Container>
    </section>
  );
}

const DOWN = "#e07856";
const UP = "#5bd08a";
const CANDLES = [
  { x: 40, open: 250, close: 290, color: DOWN },
  { x: 70, open: 230, close: 280, color: UP },
  { x: 100, open: 260, close: 300, color: DOWN },
  { x: 130, open: 240, close: 270, color: DOWN },
] as const;

/** Three VVakers over a candlestick line that turns into a heartbeat: "the market wakes, we move". */
function HeroCrew() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" aria-hidden="true">
      <svg viewBox="0 0 520 520" className="absolute inset-0 h-full w-full">
        <g opacity="0.55">
          {CANDLES.map((c) => (
            <g key={c.x}>
              <path d={`M${c.x + 7} ${c.open - 14} V${c.close + 14}`} stroke={c.color} strokeWidth="2" />
              <rect x={c.x} y={c.open} width="14" height={c.close - c.open} rx="2" fill={c.color} />
            </g>
          ))}
        </g>
        <path
          d="M150 262 H200 L215 262 L228 200 L244 330 L258 262 H300 L312 236 L324 286 L334 262 H500"
          stroke="#ccff00"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-draw [animation-delay:400ms]"
          opacity="0.9"
        />
      </svg>
      <div className="absolute top-[34%] left-[2%] w-[40%] animate-float [animation-delay:-2s]">
        <VVaker color="mint" sport="coder" headgear="headphones" mood="zen" energy={2} />
      </div>
      <div className="absolute top-[6%] left-[28%] w-[48%] animate-float">
        <VVaker color="candy" sport="runner" headgear="none" mood="fresh" energy={4} />
      </div>
      <div className="absolute top-[36%] right-[0%] w-[40%] animate-float [animation-delay:-4s]">
        <VVaker color="butter" sport="lifter" headgear="cap" mood="fired" energy={3} />
      </div>
    </div>
  );
}
