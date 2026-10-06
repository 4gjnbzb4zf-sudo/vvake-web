import { Section } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { otherLocale, quote, type VoiceCommand, type VoiceGroup, type VoiceSiri, type VoiceTip } from "@/lib/voiceCommands";

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

/** Spoken examples: the page's language first, the other language smaller underneath. */
function Examples({ examples, lang, dict }: { examples: VoiceCommand["examples"]; lang: Locale; dict: Dictionary["voice"] }) {
  const other = otherLocale(lang);
  return (
    <>
      <p className="mt-4 font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.say}</p>
      <ul className="mt-2 space-y-1.5">
        {examples[lang].map((e) => (
          <li key={e} className="font-display text-text">
            {quote(e, lang)}
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">{dict.otherLanguage}</p>
      <ul lang={other} className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
        {examples[other].map((e) => (
          <li key={e}>{quote(e, other)}</li>
        ))}
      </ul>
    </>
  );
}

/** Ways of speaking that work with every command: say the name or not, chain several commands. */
export function VoiceTips({ tips, index, lang, dict }: { tips: VoiceTip[]; index: string; lang: Locale; dict: Dictionary["voice"] }) {
  return (
    <Section id="tips" index={index} kicker={dict.kicker} title={dict.tips.title} lead={dict.tips.lead}>
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {tips.map((t) => (
          <li key={t.key} className="flex flex-col rounded-2xl border border-volt-fg/30 bg-surface/60 p-6" data-tip={t.key}>
            <h3 className="font-display text-lg font-semibold">{t.title[lang]}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.detail[lang]}</p>
            <Examples examples={t.examples} lang={lang} dict={dict} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CommandCard({ command, lang, dict }: { command: VoiceCommand; lang: Locale; dict: Dictionary["voice"] }) {
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
      <Examples examples={command.examples} lang={lang} dict={dict} />
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

/** "Hey Siri, " + the phrase, its first word in lower case unless it's VVake's name. */
export const heySiri = (hey: string, phrase: string) =>
  `${hey}${phrase.startsWith("VVake") ? phrase : phrase.charAt(0).toLowerCase() + phrase.slice(1)}`;

/**
 * "Hey Siri, Wake skip song": the phrases Siri understands with no setup (the apps' App Shortcuts), how to say
 * VVake's name for Siri, and the actions that live in the Shortcuts app.
 */
export function VoiceSiriSection({ siri, index, lang, dict }: { siri: VoiceSiri; index: string; lang: Locale; dict: Dictionary["voice"] }) {
  return (
    <Section id="siri" index={index} kicker={dict.kicker} title={siri.note.title[lang]} lead={siri.note.detail[lang]}>
      <div className="mt-10 rounded-2xl border border-lilac-fg/40 bg-surface/60 p-6" data-siri="names">
        <h3 className="font-display text-lg font-semibold">{dict.siri.namesTitle}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{siri.note.name[lang]}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {siri.names.map((n) => (
            <li key={n.name} className="rounded-full border border-line px-3 py-1 text-sm">
              <span className="font-display font-semibold">{n.name}</span>{" "}
              <span className="text-muted">
                {dict.siri.sounds} {quote(n.hint[lang], lang)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {siri.shortcuts.map((s) => {
          const where = [s.phone && dict.phone, s.watch && dict.watch].filter((w): w is string => Boolean(w));
          return (
            <li key={s.key} className="flex flex-col rounded-2xl border border-line bg-surface/60 p-6" data-siri={s.key}>
              <h3 className="font-display text-lg font-semibold">{s.title[lang]}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="sr-only">{dict.worksOn}</span>
                {where.map((w) => (
                  <Chip key={w}>{w}</Chip>
                ))}
              </div>
              <Examples
                examples={{
                  en: s.examples.en.map((e) => heySiri(dict.siri.hey.en, e)),
                  fr: s.examples.fr.map((e) => heySiri(dict.siri.hey.fr, e)),
                }}
                lang={lang}
                dict={dict}
              />
            </li>
          );
        })}
      </ul>
      {siri.more.length > 0 && (
        <p className="mt-6 text-sm leading-relaxed text-muted" data-siri="more">
          <span className="font-semibold text-text">{dict.siri.moreTitle}</span> {siri.more.map((m) => m.title[lang]).join(" · ")}
        </p>
      )}
    </Section>
  );
}
