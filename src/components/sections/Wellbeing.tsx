import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const TINTS = ["border-sky/40", "border-butter/40", "border-calm/50", "border-lilac/40"] as const;

/** Everyday wellbeing nudges: opt-in, no calories, no weight goals, wellness not medical advice. */
export function Wellbeing({ dict, index }: { dict: Dictionary["wellbeing"]; index: string }) {
  return (
    <Section id="wellbeing" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Lock-screen style notification stack */}
        <div className="relative rounded-[2.2rem] border border-line bg-gradient-to-b from-night-2 to-night p-5 sm:p-6" aria-hidden="true">
          <p className="text-center font-display text-5xl font-bold text-text/90">12:30</p>
          <p className="mt-1 text-center font-mono text-xs text-faint">VVake</p>
          <ul className="mt-6 space-y-3">
            {dict.notifications.map((n, i) => (
              <li
                key={n.title}
                className={`flex gap-3 rounded-2xl border ${TINTS[i % TINTS.length]} bg-surface/90 p-3.5 backdrop-blur ${i % 2 ? "sm:ml-6" : "sm:mr-6"}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night text-xl">{n.icon}</span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {dict.items.map((item) => (
              <li key={item.title} className="rounded-3xl border border-line bg-surface/60 p-5">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-wrap gap-2">
            {dict.promises.map((p) => (
              <li key={p} className="rounded-full border border-calm/40 bg-calm/10 px-3.5 py-1.5 font-mono text-xs text-calm">
                ♥ {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
