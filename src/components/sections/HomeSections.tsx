import { Section } from "@/components/ui/Section";
import { Shot } from "@/components/ui/Shot";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";

type Home = Dictionary["home"];

/**
 * The film, on request: native controls, no autoplay, nothing downloaded until play (preload="none"), captions in
 * the page's language and a transcript. No JavaScript.
 */
export function Film({ dict, locale }: { dict: Home["film"]; locale: Locale }) {
  return (
    <Section id="film" kicker={dict.kicker} title={dict.title} lead={dict.lead} nav={dict.kicker}>
      <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-night-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
        <video
          className="block aspect-video w-full bg-black object-cover"
          controls
          playsInline
          preload="none"
          poster="/film/vvake-film-poster.webp"
          aria-label={dict.label}
          width={1280}
          height={720}
        >
          <source src="/film/vvake-film-540.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/film/vvake-film-720.mp4" type="video/mp4" />
          <track kind="captions" src="/film/vvake-film.en.vtt" srcLang="en" label="English" default={locale === "en"} />
          <track kind="subtitles" src="/film/vvake-film.fr.vtt" srcLang="fr" label="Français" default={locale === "fr"} />
        </video>
      </div>
      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer hover:text-text">{dict.transcriptLabel}</summary>
        <ol className="mt-3 space-y-1 pl-1">
          {dict.transcript.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>
    </Section>
  );
}

const LOOP_SHOTS = [
  { name: "phone-04-plan", width: 560, height: 1214, frame: "phone" },
  { name: "watch-3-race", width: 360, height: 438, frame: "watch" },
  { name: "phone-10-you", width: 560, height: 1214, frame: "phone" },
] as const;

/** Plan → move → see progress, each with a real app screen. */
export function Loop({ dict, index }: { dict: Home["loop"]; index: string }) {
  return (
    <Section id="how-it-works" index={index} kicker={dict.kicker} title={dict.title} lead={dict.lead} layout="split">
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
        {dict.steps.map((step, i) => {
          const shot = LOOP_SHOTS[i]!;
          return (
            <li key={step.title} className="flex flex-col rounded-3xl border border-line bg-surface/60 p-6">
              <div className="flex h-[330px] items-center justify-center">
                <Shot
                  name={shot.name}
                  width={shot.width}
                  height={shot.height}
                  alt={step.alt}
                  className={cn(
                    "h-auto border border-line",
                    shot.frame === "phone" ? "w-[150px] rounded-[24px]" : "w-[190px] rounded-[40px]",
                  )}
                />
              </div>
              <p className="mt-6 font-mono text-xs tracking-[0.16em] uppercase">
                <span className="text-pulse-fg">{String(i + 1).padStart(2, "0")}</span>
                <span className="ml-2 text-faint">{step.label}</span>
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

const CREW = [
  { id: "runner-f", w: 101, going: true },
  { id: "coder-m", w: 98, going: true },
  { id: "hiker-f", w: 103, going: true },
  { id: "dancer-m", w: 97, going: true },
  { id: "boxer-f", w: 115, going: false },
] as const;

/**
 * A concrete crew: one weekly meetup, RSVPs, everyone at their own pace. Labelled as an example. One of the cast
 * beside it on wider screens (the site's own VVaker art, not a photo).
 */
export function CrewExample({ dict, index }: { dict: Home["crew"]; index: string }) {
  return (
    <Section id="your-crew" index={index} kicker={dict.kicker} title={dict.title} lead={dict.lead} layout="split">
      <div className="mt-10 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="relative hidden h-full min-h-[320px] items-end justify-center overflow-hidden rounded-3xl border border-line bg-surface/40 md:flex">
          <div aria-hidden="true" className="absolute inset-x-8 bottom-6 h-1/2 rounded-full bg-pulse/15 blur-[60px]" />
          <Shot name="cast-runner-m" width={224} height={420} alt={dict.imageAlt} className="relative h-[300px] w-auto" />
        </div>
        <div>
          <figure className="max-w-xl rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
            <p className="font-mono text-xs tracking-[0.16em] text-volt-fg uppercase">{dict.when}</p>
            <p className="mt-2 font-display text-xl font-semibold">{dict.what}</p>
            <div className="mt-6 flex items-end" aria-hidden="true">
              {CREW.map((m) => (
                <Shot
                  key={m.id}
                  name={`crew-${m.id}`}
                  width={m.w}
                  height={192}
                  alt=""
                  className={cn("-mr-3 h-[96px] w-auto", !m.going && "opacity-50")}
                />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{dict.going}</p>
              <span aria-hidden="true" className="rounded-full bg-pulse px-4 py-1.5 font-display text-sm font-semibold text-ink">
                ✓ {dict.rsvp}
              </span>
            </div>
            <figcaption className="mt-5 text-xs text-faint">{dict.note}</figcaption>
          </figure>
          <a
            href="#unlock"
            className="mt-6 inline-block font-display font-semibold text-pulse-fg underline decoration-pulse-fg/40 underline-offset-4 hover:decoration-pulse-fg"
          >
            {dict.cta} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </Section>
  );
}

/** City Clash as an illustration: how it works, two bars without numbers, never fake live scores. */
export function CityClash({ dict, index }: { dict: Home["clash"]; index: string }) {
  return (
    <Section id="city-clash" index={index} kicker={dict.kicker} title={dict.title} lead={dict.lead} layout="split">
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <figure className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
          <div aria-hidden="true" className="space-y-5">
            <ClashBar label={dict.you} width="w-[72%]" color="bg-pulse" />
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-line" />
              <span className="font-display text-2xl font-bold text-text italic">vs</span>
              <span className="rounded-full border border-line px-3 py-1 font-mono text-[0.68rem] tracking-[0.15em] text-muted uppercase">
                {dict.window}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <ClashBar label={dict.rival} width="w-[64%]" color="bg-calm" />
          </div>
          <figcaption className="mt-6 text-xs text-faint">{dict.note}</figcaption>
        </figure>
        <ol className="grid gap-3">
          {dict.steps.map((step) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface/60 p-5">
              <p className="font-display font-semibold">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function ClashBar({ label, width, color }: { label: string; width: string; color: string }) {
  return (
    <div>
      <p className="font-display text-lg font-semibold">{label}</p>
      <div className="stripe-bar mt-2 h-3 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full", width, color)} />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  now: "border-volt-fg/50 text-volt-fg",
  next: "border-sky-fg/50 text-sky-fg",
  maybe: "border-line text-muted",
};

/** Honest device status: in development, planned, under consideration. */
export function Devices({ dict, index }: { dict: Home["devices"]; index: string }) {
  return (
    <Section id="devices" index={index} kicker={dict.kicker} title={dict.title} lead={dict.lead} layout="split">
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {dict.groups.map((g) => (
          <li key={g.status} className="rounded-3xl border border-line bg-surface/60 p-6">
            <p className={cn("inline-flex rounded-full border px-3 py-1 font-mono text-xs tracking-[0.15em] uppercase", TONES[g.tone])}>
              {g.status}
            </p>
            <ul className="mt-4 space-y-2">
              {g.items.map((item) => (
                <li key={item} className="flex gap-2 leading-snug">
                  <span aria-hidden="true" className="text-faint">
                    ·
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-3xl text-sm text-faint">{dict.note}</p>
    </Section>
  );
}
