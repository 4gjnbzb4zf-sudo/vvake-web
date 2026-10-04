import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { Shot } from "@/components/ui/Shot";
import type { Dictionary } from "@/i18n/dictionaries";
import { HeroPersona } from "./HeroPersona";
import { HeroTrio } from "./HeroTrio";

/** Floating voxel "pixels" around the devices: deterministic positions so SSR and client match. CSS only. */
const PIXELS = [
  { left: "8%", top: "14%", size: 10, color: "bg-pulse", delay: "0s" },
  { left: "22%", top: "4%", size: 7, color: "bg-volt", delay: "-1.5s" },
  { left: "86%", top: "10%", size: 9, color: "bg-lilac", delay: "-3s" },
  { left: "94%", top: "30%", size: 6, color: "bg-volt", delay: "-2s" },
  { left: "4%", top: "70%", size: 8, color: "bg-mint", delay: "-4s" },
  { left: "78%", top: "84%", size: 10, color: "bg-butter", delay: "-5s" },
] as const;

/**
 * The first screen has one job: say what VVake is (an AI fitness coach: your coach, your crew, your city) and offer
 * early access or the film. The devices show real app screens, not mockups. Server-rendered; the only client code is
 * the random cast duo on large screens.
 */
export function Hero({ dict }: { dict: Dictionary["hero"] }) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="bg-voxel-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-pulse/15 blur-[120px]" />

      <Container className="relative grid items-center gap-12 pt-6 pb-16 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:pb-24">
        {/* No entrance animation on the text: it's the largest paint on phones and should show at once. */}
        <div>
          <HeroTrio />
          <p className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-surface/70 py-1.5 pr-3 pl-2 text-[13px] text-muted">
            {/* "VVake Fit · say it…" with the sign as the W: [hand]ake Fit, no repeated VV. */}
            <span className="ml-1.5 inline-flex items-end whitespace-nowrap">
              <span className="sr-only">{dict.pronounce}</span>
              <LogoMark className="mr-px h-[1.45em] shrink-0 text-text" />
              <span aria-hidden="true">{dict.pronounce.replace(/^VV/, "")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-volt-fg">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-volt" />
              {dict.status}
            </span>
          </p>

          <h1 id="hero-title" className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:mt-8 sm:text-7xl">
            {dict.title.map((line, i) => (
              <span key={line} className={i === dict.title.length - 1 ? "text-gradient-pulse block pb-2" : "block text-text"}>
                {line}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{dict.lead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#unlock">{dict.ctaPrimary}</ButtonLink>
            <ButtonLink href="#film" variant="ghost">
              ▶ {dict.ctaSecondary}
            </ButtonLink>
          </div>
        </div>

        <HeroDevices dict={dict} />
      </Container>
    </section>
  );
}

/** A real iPhone screen and a real Apple Watch screen, with two of the cast in front on large screens. */
function HeroDevices({ dict }: { dict: Dictionary["hero"] }) {
  return (
    <figure className="relative mx-auto w-full max-w-[600px] pb-6">
      <svg viewBox="0 0 520 520" className="absolute inset-0 h-full w-full" aria-hidden="true">
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

      {/* A woman and a man of the cast in front of the phone (large screens; phones get the trio above the title).
          Lazy, so phones never download them. */}
      <div className="absolute bottom-10 -left-6 z-10 hidden h-[68%] drop-shadow-[0_30px_40px_rgb(0_0_0/0.6)] lg:block" aria-hidden="true">
        <HeroPersona />
      </div>

      <div className="relative mx-auto w-fit lg:mr-20">
        <div className="pointer-events-none absolute inset-x-0 top-10 bottom-0 rounded-full bg-pulse/20 blur-[80px]" />
        <div className="relative w-[230px] -rotate-2 rounded-[40px] border-[7px] border-[#1c1f24] bg-black p-1 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] sm:w-[260px]">
          <Shot name="phone-02-home" width={560} height={1214} alt={dict.phoneAlt} className="block h-auto w-full rounded-[32px]" />
        </div>
        <div className="absolute -right-10 -bottom-6 w-[118px] rotate-3 rounded-[34px] border-[6px] border-[#8a8f96] bg-black p-1 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] sm:-right-24 sm:w-[150px]">
          <Shot name="watch-3-race" width={360} height={438} alt={dict.watchAlt} className="block h-auto w-full rounded-[26px]" />
        </div>
      </div>
      <figcaption className="relative z-20 mt-10 text-center font-mono text-[0.68rem] tracking-[0.14em] text-faint uppercase lg:pl-40 lg:text-right">
        {dict.shots}
      </figcaption>
    </figure>
  );
}
