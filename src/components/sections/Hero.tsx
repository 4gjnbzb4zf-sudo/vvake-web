import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Marquee } from "@/components/ui/Marquee";
import { Container } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";
import { getCity, RIVALRIES } from "@/lib/cities";
import { AnthemRotator } from "./AnthemRotator";

interface HeroProps {
  dict: Dictionary["hero"];
  highlights: Dictionary["highlights"];
}

export function Hero({ dict, highlights }: HeroProps) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="bg-voxel-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-pulse/15 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 -bottom-40 h-[380px] w-[520px] rounded-full bg-volt/10 blur-[120px]" />

      <Container className="relative grid items-center gap-14 pt-16 pb-16 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
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
        </div>

        <HeroCrew sticker={highlights.sticker} />
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

/** Three VVakers over a candlestick line that turns into a heartbeat: "the market wakes, we move". */
function HeroCrew({ sticker }: { sticker: Dictionary["highlights"]["sticker"] }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <svg viewBox="0 0 520 520" className="absolute inset-0 h-full w-full" aria-hidden="true">
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

      {PIXELS.map((p) => (
        <span
          key={`${p.left}-${p.top}`}
          aria-hidden="true"
          className={`absolute animate-float rounded-[2px] ${p.color} opacity-80 shadow-[0_0_12px_rgb(255_255_255/0.25)]`}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay }}
        />
      ))}

      <div className="absolute top-[34%] left-[2%] w-[40%] animate-float [animation-delay:-2s]" aria-hidden="true">
        <VVaker color="mint" sport="coder" headgear="headphones" accent="volt" eyes="happy" mouth="calm" energy={2} />
      </div>
      <div className="absolute top-[6%] left-[28%] w-[48%] animate-float" aria-hidden="true">
        <VVaker color="candy" sport="runner" accessory="bib" bib={1} energy={4} />
      </div>
      <div className="absolute top-[36%] right-[0%] w-[40%] animate-float [animation-delay:-4s]" aria-hidden="true">
        <VVaker color="butter" sport="lifter" headgear="cap" accent="ocean" eyes="fired" mouth="teeth" energy={3} />
      </div>

      <div className="absolute top-[2%] right-[-2%] w-36 rotate-6 rounded-lg bg-volt p-3.5 text-night shadow-[0_18px_40px_-12px_rgb(204_255_0/0.55)] sm:right-[-6%] sm:w-40">
        <p className="font-mono text-[0.6rem] leading-tight tracking-[0.12em] uppercase">{sticker.label}</p>
        <p className="mt-1 font-display text-5xl leading-none font-bold">{sticker.value}</p>
        <p className="mt-2 font-mono text-[0.6rem] leading-tight tracking-[0.12em] uppercase">{sticker.note}</p>
      </div>
    </div>
  );
}
