import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const STEPS_PROGRESS = 6412 / 6500;
const RING = 2 * Math.PI * 70;

/** A day of cheers and nudges: morning call → zone cheers → desk nudge → steps → Rally → PB → wind-down. */
export function DayLoop({ dict, index }: { dict: Dictionary["day"]; index: string }) {
  return (
    <Section id="day" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.35fr_1fr]">
        <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[3.9rem] before:w-px before:bg-line">
          {dict.moments.map((m) => {
            const watch = m.device === "watch";
            return (
              <li key={m.time} className="relative grid grid-cols-[3.25rem_1fr] items-start gap-5">
                <span className="pt-3 text-right font-mono text-xs text-faint">{m.time}</span>
                <div
                  className={`relative flex gap-3 border p-3.5 transition-transform duration-300 hover:-translate-y-0.5 ${
                    watch ? "max-w-sm rounded-[1.6rem] border-line bg-black" : "rounded-2xl border-line bg-surface"
                  }`}
                >
                  <span className="absolute top-4 -left-[0.95rem] h-2.5 w-2.5 rounded-full bg-pulse ring-4 ring-night" aria-hidden="true" />
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night-2 text-xl">
                    {m.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold">{m.title}</span>
                      <span className="rounded-full border border-line px-1.5 py-px font-mono text-[0.6rem] text-faint">{m.on}</span>
                    </p>
                    <p className="text-sm text-muted">{m.body}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="lg:sticky lg:top-24">
          <div className="rounded-[2rem] border border-line bg-surface/70 p-6 text-center">
            <svg
              viewBox="0 0 180 180"
              className="mx-auto h-48 w-48"
              role="img"
              aria-label={`${dict.steps.label}: ${dict.steps.value} ${dict.steps.goal}`}
            >
              <circle cx="90" cy="90" r="70" fill="none" stroke="#22262b" strokeWidth="14" />
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke="url(#steps-grad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - STEPS_PROGRESS)}
                transform="rotate(-90 90 90)"
              />
              <defs>
                <linearGradient id="steps-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff3d6e" />
                  <stop offset="1" stopColor="#ccff00" />
                </linearGradient>
              </defs>
              <text x="90" y="100" textAnchor="middle" className="fill-text font-display" fontSize="30" fontWeight="700">
                {dict.steps.value}
              </text>
            </svg>
            <p className="mt-1 font-mono text-xs text-muted">{dict.steps.goal}</p>
            <p className="mt-2 font-mono text-xs tracking-[0.16em] text-volt uppercase">👟 {dict.steps.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{dict.steps.note}</p>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {dict.cheers.map((c) => (
              <li key={c} className="rounded-full border border-pulse/30 bg-pulse/10 px-3 py-1 font-mono text-xs text-pulse-soft">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
