"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";

type Style = keyof Dictionary["coach"]["styles"];
type Vibe = keyof Dictionary["coach"]["vibes"];

/**
 * Browser text-to-speech (demo only; the app uses licensed studio voices). Kept close to natural:
 * small rate/pitch nudges, the device's best voice, and a different good voice per style.
 */
const VOICE: Record<Style, { rate: number; pitch: number; pick: number }> = {
  hype: { rate: 1.08, pitch: 1.05, pick: 0 },
  calm: { rate: 0.95, pitch: 1, pick: 1 },
  drill: { rate: 1.05, pitch: 0.95, pick: 2 },
  funny: { rate: 1.04, pitch: 1.08, pick: 3 },
  zen: { rate: 0.9, pitch: 0.98, pick: 1 },
  pro: { rate: 1, pitch: 1, pick: 0 },
};
/** macOS novelty voices and other robotic ones. */
const BLOCKED =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|compact|espeak/i;

function rankVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (/natural|neural|premium|enhanced|siri/i.test(v.name)) score += 6;
  if (/google/i.test(v.name)) score += 4;
  if (/samantha|ava|allison|daniel|karen|moira|serena|tom|evan|zoe|am[ée]lie|aur[ée]lie|thomas|audrey|marie|denise|henri/i.test(v.name))
    score += 2;
  if (!v.localService) score += 1; // cloud voices are usually the nicer ones
  return score;
}

/** The device's good voices for this language, best first (varied by region accent). */
function bestVoices(lang: string): SpeechSynthesisVoice[] {
  const all = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang) && !BLOCKED.test(v.name));
  return all.sort((a, b) => rankVoice(b) - rankVoice(a));
}
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
  const [kept, setKept] = useState<string[]>(dict.memory.notes.map((n) => n.id));
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
    const voices = bestVoices(lang === "fr" ? "fr" : "en");
    const top = voices.slice(0, 4);
    const voice = top[VOICE[style].pick % Math.max(1, top.length)];
    if (voice) u.voice = voice;
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
          <p className="-mt-3 text-xs text-faint">{dict.demoNote}</p>
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
      <div className="mt-8 rounded-[2rem] border border-lilac/40 bg-gradient-to-br from-lilac/10 to-transparent p-6 sm:p-8">
        <h3 className="font-display text-2xl font-semibold">🧠 {dict.memory.title}</h3>
        <p className="mt-2 max-w-3xl leading-relaxed text-muted">{dict.memory.body}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-night/60 p-5">
            <p className="font-mono text-[0.7rem] tracking-[0.14em] text-faint uppercase">{dict.memory.notesTitle}</p>
            <ul className="mt-3 space-y-2">
              {dict.memory.notes
                .filter((n) => kept.includes(n.id))
                .map((n) => (
                  <li key={n.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 px-3 py-2">
                    <span aria-hidden="true" className="text-lg">
                      {n.icon}
                    </span>
                    <div className="flex-1">
                      <p className="font-mono text-[0.6rem] tracking-[0.1em] text-lilac uppercase">{n.topic}</p>
                      <p className="text-sm">{n.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKept((k) => k.filter((id) => id !== n.id))}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-down/60 hover:text-down"
                    >
                      ✕ {dict.memory.forget}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-night/60 p-5" aria-live="polite">
            <p className="font-mono text-[0.7rem] tracking-[0.14em] text-faint uppercase">📞 {dict.memory.followTitle}</p>
            <ul className="mt-3 space-y-2">
              {(["p", "c", "g", "m"] as const)
                .filter((id) => kept.includes(id))
                .map((id) => (
                  <li key={id} className="animate-rise rounded-2xl rounded-tl-sm bg-surface px-3 py-2 text-sm">
                    {dict.memory.followups[id]}
                  </li>
                ))}
              {kept.length === 0 && <li className="text-sm text-muted">{dict.memory.empty}</li>}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-faint">🔒 {dict.memory.privacy}</p>
      </div>
    </Section>
  );
}
