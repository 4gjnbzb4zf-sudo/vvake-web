"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

type Style = keyof Dictionary["coach"]["styles"];
type Vibe = keyof Dictionary["coach"]["vibes"];

/** Browser text-to-speech settings per style (demo only; the app uses its own licensed voices). */
const VOICE: Record<Style, { rate: number; pitch: number }> = {
  hype: { rate: 1.15, pitch: 1.25 },
  calm: { rate: 0.92, pitch: 1 },
  drill: { rate: 1.08, pitch: 0.7 },
  funny: { rate: 1.05, pitch: 1.45 },
  zen: { rate: 0.8, pitch: 0.9 },
  pro: { rate: 1, pitch: 1 },
};
const LOOK: Record<
  Style,
  { color: "candy" | "sky" | "coral" | "butter" | "lilac" | "mint"; eyes: "fired" | "happy" | "star" | "sleepy" | "pixel" }
> = {
  hype: { color: "candy", eyes: "star" },
  calm: { color: "sky", eyes: "happy" },
  drill: { color: "coral", eyes: "fired" },
  funny: { color: "butter", eyes: "star" },
  zen: { color: "lilac", eyes: "sleepy" },
  pro: { color: "mint", eyes: "pixel" },
};

export function Coach({ dict, index }: { dict: Dictionary["coach"]; index: string }) {
  const { lang } = useParams<{ lang: string }>();
  const [style, setStyle] = useState<Style>("hype");
  const [vibe, setVibe] = useState<Vibe>("morning-energy");
  const [speaking, setSpeaking] = useState(false);
  const lines = dict.styles[style].lines.map((l, i) => (i === 0 ? dict.vibes[vibe].prefix + l : l));

  const play = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(lines.join(" "));
    u.lang = lang === "fr" ? "fr-FR" : "en-US";
    u.rate = VOICE[style].rate;
    u.pitch = VOICE[style].pitch;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm transition-colors",
      on ? "border-volt bg-volt text-night" : "border-line text-muted hover:text-text",
    );

  return (
    <Section id="coach" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        {/* incoming call */}
        <div className="mx-auto w-full max-w-sm rounded-[2.4rem] border-[7px] border-[#202428] bg-gradient-to-b from-lilac/20 to-night p-6 text-center shadow-2xl">
          <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">{dict.call.incoming}</p>
          <div className="relative mx-auto mt-5 flex h-40 w-40 items-center justify-center">
            <span className={cn("absolute inset-0 rounded-full border-2 border-volt/60", speaking ? "animate-ping" : "animate-pulse")} />
            <span className="absolute inset-3 rounded-full bg-surface" />
            <VVaker sport="runner" {...LOOK[style]} mouth="grin" className="relative h-32 w-auto" />
          </div>
          <p className="mt-4 font-display text-xl font-semibold">{dict.call.who}</p>
          <p className="font-mono text-xs text-volt">
            {dict.styles[style].name} · {dict.vibes[vibe].name}
          </p>
          <ul className="mt-5 space-y-2 text-left" aria-live="polite">
            {lines.map((l, i) => (
              <li
                key={`${style}-${vibe}-${i}`}
                className="animate-rise rounded-2xl rounded-tl-sm bg-surface px-3 py-2 text-sm"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {l}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center gap-6" aria-hidden="true">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-down text-xl">✕</span>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-up text-xl">📞</span>
          </div>
        </div>

        {/* choices */}
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold">{dict.styleLabel}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(dict.styles) as Style[]).map((s) => (
                <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)} className={chip(style === s)}>
                  {dict.styles[s].name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">{dict.vibeLabel}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(dict.vibes) as Vibe[]).map((v) => (
                <button key={v} type="button" aria-pressed={vibe === v} onClick={() => setVibe(v)} className={chip(vibe === v)}>
                  {dict.vibes[v].name}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={play}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-volt px-5 font-display text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
          >
            {speaking ? "■" : "▶"} {speaking ? dict.stop : dict.play}
          </button>
          <ul className="space-y-2 rounded-3xl border border-line bg-surface/60 p-5 text-sm text-muted">
            {dict.rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-volt" aria-hidden="true">
                  ✓
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
