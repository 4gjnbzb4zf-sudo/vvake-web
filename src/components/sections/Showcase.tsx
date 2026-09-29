"use client";

import { useEffect, useState } from "react";
import { MoneyText } from "@/components/ui/Money";
import { Container } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

const HREFS = ["#rivalries", "#crew", "#rwa", "#pulse"] as const;
const TONES = ["from-pulse/25", "from-lilac/25", "from-volt/15", "from-mint/20"] as const;
const TAG = ["bg-pulse", "bg-lilac", "bg-volt", "bg-mint"] as const;
const ROTATE_MS = 5500;

function Compete() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex items-end gap-2">
        <VVaker sport="runner" color="candy" eyes="fired" mouth="grin" fan="lyon-football" className="h-36 w-auto sm:h-44" />
        <span className="mb-16 -skew-x-6 font-display text-3xl font-bold text-pulse-fg italic">VS</span>
        <VVaker sport="boxer" color="coral" eyes="fired" mouth="teeth" className="h-36 w-auto -scale-x-100 sm:h-44" />
      </div>
      <div className="mt-2 w-full max-w-sm">
        <div className="flex justify-between font-display text-sm font-semibold">
          <span>
            Lyon <span className="text-pulse-fg">61.3</span>
          </span>
          <span>
            <span className="text-muted">58.9</span> St-Étienne
          </span>
        </div>
        <div className="stripe-bar mt-1.5 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-[51%] animate-pulse rounded-full bg-pulse" />
        </div>
      </div>
    </div>
  );
}

function Crew() {
  return (
    <div className="flex h-full items-end justify-center -space-x-6">
      <VVaker sport="runner" color="mint" headgear="cap" accent="volt" className="h-32 w-auto sm:h-40" />
      <VVaker sport="roller" color="candy" headgear="helmet" eyes="star" className="h-32 w-auto sm:h-40" />
      <VVaker sport="walker" color="sky" eyes="happy" className="h-32 w-auto sm:h-40" />
      <VVaker sport="baller" color="butter" headgear="beanie" className="h-32 w-auto sm:h-40" />
    </div>
  );
}

function Web3() {
  return (
    <div className="flex h-full flex-col justify-center">
      <svg viewBox="0 0 480 160" className="w-full" aria-hidden="true">
        {[40, 70, 100, 130, 160].map((x, i) => (
          <g key={x} opacity={0.9 - i * 0.12}>
            <path d={`M${x + 7} ${40 + i * 8} V${120 - i * 4}`} stroke={i % 2 ? "#5bd08a" : "#e07856"} strokeWidth="2" />
            <rect x={x} y={58 + ((i * 17) % 30)} width="14" height={30} rx="2" fill={i % 2 ? "#5bd08a" : "#e07856"} />
          </g>
        ))}
        <path
          d="M190 90 H250 L262 90 L274 40 L290 140 L304 90 H350 L360 70 L372 110 L382 90 H470"
          stroke="#ccff00"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-draw"
        />
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-2 font-mono text-[0.7rem]">
        {["Tokenized stocks", "On-chain fee split", "Robinhood Chain", "0% team tokens"].map((c) => (
          <span key={c} className="rounded-full border border-volt-fg/40 bg-volt/10 px-2.5 py-1 text-volt-fg">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function Invest() {
  const rows = [
    { s: "NKE", c: "−4.1%", down: true, note: "Rally ⚡" },
    { s: "BTC", c: "+7.5%", down: false, note: "" },
    { s: "LULU", c: "+3.4%", down: false, note: "" },
  ];
  return (
    <div className="flex h-full items-center justify-center gap-4">
      <ul className="w-56 space-y-2">
        {rows.map((r) => (
          <li key={r.s} className="flex items-center justify-between rounded-xl border border-line bg-night/70 px-3 py-2 font-mono text-sm">
            <span>{r.s}</span>
            <span className={r.down ? "text-down-fg" : "text-up-fg"}>
              {r.c} {r.note && <span className="ml-1 text-xs text-pulse-fg">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden rotate-3 rounded-2xl bg-mint p-4 text-ink shadow-[0_18px_40px_-12px_rgb(91_208_138/0.55)] sm:block">
        <p className="font-display text-2xl leading-tight font-bold">
          📈 <MoneyText template="{money}" usd={1} />
        </p>
        <p className="font-mono text-[0.6rem] tracking-[0.08em] uppercase">/ workout</p>
      </div>
    </div>
  );
}

const VISUALS = [Compete, Crew, Web3, Invest] as const;

/** Rotating highlights under the hero: compete, crew, RWA × web3, Sweat & Invest. */
export function Showcase({ dict }: { dict: Dictionary["showcase"] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (paused || hovered || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % dict.slides.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, hovered, dict.slides.length]);

  const slide = dict.slides[active]!;
  const Visual = VISUALS[active]!;
  return (
    <section aria-roledescription="carousel" aria-label={dict.label} className="py-8">
      <Container>
        <div
          className={cn(
            "relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br to-surface/40 transition-colors duration-700",
            TONES[active],
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          <div
            key={active}
            className="grid min-h-[26rem] animate-rise items-center gap-6 p-6 sm:min-h-[22rem] sm:p-10 lg:grid-cols-[1fr_1.1fr]"
            aria-live="polite"
          >
            <div>
              <span
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.12em] text-ink uppercase",
                  TAG[active],
                )}
              >
                {slide.tag}
              </span>
              <h2 className="mt-4 font-display text-3xl leading-tight font-bold sm:text-4xl">{slide.title}</h2>
              <p className="mt-3 max-w-lg leading-relaxed text-muted">
                <MoneyText template={slide.body} usd={1} />
              </p>
              <a
                href={HREFS[active]}
                className="mt-6 inline-flex h-11 items-center rounded-xl bg-text px-5 font-display text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
              >
                {slide.cta} →
              </a>
            </div>
            <div className="h-56 sm:h-64" aria-hidden="true">
              <Visual />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-line/60 px-6 py-3 sm:px-10">
            <div role="tablist" aria-label={dict.label} className="flex flex-1 gap-2">
              {dict.slides.map((s, i) => (
                <button
                  key={s.tag}
                  role="tab"
                  type="button"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className="group flex-1 text-left"
                >
                  <span className="block h-1 overflow-hidden rounded-full bg-line">
                    <span
                      key={`${active}-${paused || hovered}`}
                      className={cn(
                        "block h-full rounded-full",
                        TAG[i],
                        i < active ? "w-full" : i === active ? (paused || hovered ? "w-1/2" : "vv-progress") : "w-0",
                      )}
                      style={i === active ? { animationDuration: `${ROTATE_MS}ms` } : undefined}
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 hidden font-mono text-[0.65rem] tracking-[0.1em] uppercase sm:block",
                      i === active ? "text-text" : "text-faint group-hover:text-muted",
                    )}
                  >
                    {s.tag}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-muted hover:text-text"
              aria-label={paused ? dict.play : dict.pause}
            >
              {paused ? "▶" : "❚❚"}
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
