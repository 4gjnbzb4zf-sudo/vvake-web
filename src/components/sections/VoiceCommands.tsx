import { Section } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { otherLocale, quote, type VoiceCommand, type VoiceGroup } from "@/lib/voiceCommands";

/** How talking to VVake works: press the mic, speak, it shows what it understood and runs it. */
export function VoiceHow({ dict, index }: { dict: Dictionary["voice"]; index: string }) {
  return (
    <Section id="how" index={index} kicker={dict.kicker} title={dict.how.title}>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dict.how.items.map((item, i) => (
          <li key={item.h} className="rounded-2xl border border-line bg-surface/60 p-6">
            <p className="font-mono text-xs text-pulse-fg">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 font-display text-lg font-semibold">{item.h}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.p}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Chip({ children, tone = "muted" }: { children: string; tone?: "muted" | "butter" }) {
  return (
    <span
      className={
        tone === "butter"
          ? "rounded-full border border-butter-fg/40 bg-butter/10 px-2.5 py-0.5 font-mono text-[0.7rem] text-butter-fg"
          : "rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.7rem] text-muted"
      }
    >
      {children}
    </span>
  );
}

function CommandCard({ command, lang, dict }: { command: VoiceCommand; lang: Locale; dict: Dictionary["voice"] }) {
  const other = otherLocale(lang);
  const where = [command.phone && dict.phone, command.watch && dict.watch].filter((w): w is string => Boolean(w));
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface/60 p-6" data-intent={command.intent}>
      <h3 className="font-display text-lg font-semibold">{command.title[lang]}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{command.detail[lang]}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="sr-only">{dict.worksOn}</span>
        {where.map((w) => (
          <Chip key={w}>{w}</Chip>
        ))}
        {command.inWorkout && <Chip>{dict.inWorkout}</Chip>}
        {command.confirm && <Chip tone="butter">{dict.confirm}</Chip>}
      </div>
      <p className="mt-4 font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.say}</p>
      <ul className="mt-2 space-y-1.5">
        {command.examples[lang].map((e) => (
          <li key={e} className="font-display text-text">
            {quote(e, lang)}
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">{dict.otherLanguage}</p>
      <ul lang={other} className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
        {command.examples[other].map((e) => (
          <li key={e}>{quote(e, other)}</li>
        ))}
      </ul>
    </li>
  );
}

/** One category of commands, numbered after the "how it works" section. */
export function VoiceGroupSection({
  group,
  index,
  lang,
  dict,
}: {
  group: VoiceGroup;
  index: string;
  lang: Locale;
  dict: Dictionary["voice"];
}) {
  return (
    <Section id={`voice-${group.category.key}`} index={index} kicker={dict.kicker} title={group.category.title[lang]}>
      <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {group.commands.map((c) => (
          <CommandCard key={c.intent} command={c} lang={lang} dict={dict} />
        ))}
      </ul>
    </Section>
  );
}
