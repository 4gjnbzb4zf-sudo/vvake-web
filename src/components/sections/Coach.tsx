"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import { cn } from "@/lib/cn";
import { COACH_CLIPS, clipName, vibeClipName } from "@/lib/coachClips";
import { usePersona } from "@/lib/prefs";
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
  // Installed voices are reliable; Chrome's online voices can end silently without speaking.
  if (v.localService) score += 5;
  if (/premium|enhanced|natural|neural|siri/i.test(v.name)) score += 4;
  if (/samantha|ava|allison|daniel|karen|moira|serena|tom|evan|zoe|am[ée]lie|aur[ée]lie|thomas|audrey|marie|denise|henri/i.test(v.name))
    score += 2;
  if (/google/i.test(v.name)) score += 1;
  return score;
}

type Gender = "female" | "male";
/** Browsers don't expose a voice's gender, so we match well-known voice names (and "Female"/"Male" labels). */
const GENDER: Record<Gender, RegExp> = {
  female:
    /female|samantha|ava|allison|karen|moira|serena|zoe|victoria|susan|tessa|fiona|veena|am[ée]lie|aur[ée]lie|audrey|marie|denise|julie|google us english|google français|microsoft (aria|jenny|zira|hortense|denise)/i,
  male: /(?<!fe)male|daniel|alex|tom|evan|aaron|arthur|rishi|oliver|thomas|henri|nicolas|paul|microsoft (guy|david|mark|henri|paul)/i,
};

/** The device's good voices for this language and gender, best first. */
function bestVoices(lang: string, gender: Gender): { voices: SpeechSynthesisVoice[]; matched: boolean } {
  const all = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang) && !BLOCKED.test(v.name))
    .sort((a, b) => rankVoice(b) - rankVoice(a));
  const matched = all.filter((v) => GENDER[gender].test(v.name));
  return matched.length ? { voices: matched, matched: true } : { voices: all, matched: false };
}

export function Coach({ dict, index }: { dict: Dictionary["coach"]; index: string }) {
  const { lang } = useParams<{ lang: string }>();
  const [style, setStyle] = useState<Style>("hype");
  const [vibe, setVibe] = useState<Vibe>("morning-energy");
  const [speaking, setSpeaking] = useState(false);
  const [silent, setSilent] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const anyStarted = useRef(false);
  const [gender, setGender] = useState<Gender>("female");
  // The caller is the player's own VVaker from the persona generator.
  const persona = usePersona();
  const [kept, setKept] = useState<string[]>(dict.memory.notes.map((n) => n.id));
  const lines = dict.styles[style].lines.map((l, i) => (i === 0 ? dict.vibes[vibe].prefix + l : l));

  const play = () => {
    if (typeof window === "undefined") return;
    setSilent(false);
    if (speaking) {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    // 1. Recorded clip (works on every browser).
    // The vibe's opening words play first, then the style's lines, in the same voice.
    const code = lang === "fr" ? "fr" : "en";
    const clip = clipName(code, gender, style);
    if (COACH_CLIPS.has(clip)) {
      const intro = vibeClipName(code, gender, style, vibe);
      const queue = [...(COACH_CLIPS.has(intro) ? [intro] : []), clip];
      const next = () => {
        const name = queue.shift();
        if (!name) return setSpeaking(false);
        const a = new Audio(`/coach/${name}`);
        audio.current = a;
        a.onended = next;
        a.onerror = () => setSpeaking(false);
        void a.play().catch(() => setSpeaking(false));
      };
      setSpeaking(true);
      next();
      return;
    }
    // 2. Browser voice, with a watchdog: some engines (e.g. Chrome on macOS) end without ever speaking.
    if (!("speechSynthesis" in window)) {
      setSilent(true);
      return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    synth.resume();

    const { voices, matched } = bestVoices(lang === "fr" ? "fr" : "en", gender);
    const top = voices.slice(0, 3);
    const preferred = top[VOICE[style].pick % Math.max(1, top.length)];
    // Online voices (e.g. Google's) sound best but can fail: fall back to a voice installed on the device.
    const local =
      voices.find((v) => v.localService) ??
      window.speechSynthesis.getVoices().find((v) => v.localService && v.lang.startsWith(lang === "fr" ? "fr" : "en"));

    const speakLines = (voice: SpeechSynthesisVoice | undefined, retried: boolean) => {
      lines.forEach((text, i) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice?.lang ?? (lang === "fr" ? "fr-FR" : "en-US");
        if (voice) u.voice = voice;
        u.rate = VOICE[style].rate;
        // No named voice of that gender on this device: nudge the pitch instead.
        u.pitch = VOICE[style].pitch * (matched ? 1 : gender === "male" ? 0.85 : 1.12);
        let started = false;
        u.onstart = () => {
          started = true;
          anyStarted.current = true;
        };
        u.onend = () => {
          // Ended without ever starting = the voice failed silently: retry once with an installed voice.
          if (!started && !retried && local && voice !== local) {
            synth.cancel();
            speakLines(local, true);
            return;
          }
          if (i === lines.length - 1) setSpeaking(false);
        };
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          if (!retried && voice && !voice.localService && local) {
            synth.cancel();
            speakLines(local, true);
          } else {
            setSpeaking(false);
          }
        };
        synth.speak(u);
      });
    };

    anyStarted.current = false;
    setSpeaking(true);
    speakLines(preferred, false);
    window.setTimeout(() => {
      if (anyStarted.current || synth.speaking) return;
      synth.cancel();
      setSpeaking(false);
      setSilent(true);
    }, 1500);
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
            <VVaker sport={persona.sport} title={persona.name || undefined} className="relative h-32 w-auto" />
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
            <legend className="text-sm font-semibold">{dict.voiceLabel}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["female", "male"] as const).map((g) => (
                <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)} className={chip(gender === g)}>
                  {dict.voices[g]}
                </button>
              ))}
            </div>
          </fieldset>
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
          {silent && (
            <p role="status" className="-mt-3 rounded-xl border border-butter/40 bg-butter/10 px-3 py-2 text-xs text-butter">
              {dict.voiceUnavailable}
            </p>
          )}
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
