import type { ReactNode } from "react";
import { fmt } from "@/i18n/webapp";
import type { TrainingsDict } from "@/i18n/trainings";
import { count, setRows, trainingFacts, type TrainingStats } from "@/lib/trainings/data";
import type { Training } from "@/lib/webapp/camera/cameraTraining";
import { cn } from "@/lib/cn";

const ZONE_TONE: Record<number, string> = {
  1: "bg-sky/20 text-sky-fg",
  2: "bg-volt/20 text-volt-fg",
  3: "bg-butter/25 text-butter-fg",
  4: "bg-pulse/25 text-pulse-fg",
  5: "bg-down/25 text-down-fg",
};

/**
 * A training as the share page and the web app show it: name, who made it, level and time, the sets (move, target,
 * zone or effort, rest), and the numbers (aggregates only: people who trained it, total reps, heart points, coach
 * score). Nothing about who did what.
 */
export function TrainingView({
  training: t,
  creator,
  stats,
  lang,
  d,
  className,
}: {
  training: Training;
  creator?: ReactNode;
  stats?: TrainingStats | null;
  lang: "en" | "fr";
  d: TrainingsDict["share"];
  className?: string;
}) {
  const facts = trainingFacts(t);
  const rows = setRows(t, lang);
  return (
    <div className={cn("text-left", className)}>
      <p className="font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">{d.kicker}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight font-semibold break-words sm:text-4xl">{t.name}</h1>
      {creator && <div className="mt-2 text-muted">{creator}</div>}
      <p className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-line px-3 py-1">{d.level[t.level]}</span>
        <span className="rounded-full border border-line px-3 py-1 tabular-nums">
          {fmt(d.facts, { min: facts.minutes, sets: facts.sets })}
        </span>
        {t.rounds > 1 && <span className="rounded-full border border-line px-3 py-1">{fmt(d.rounds, { n: t.rounds })}</span>}
        {t.rest === "fixed" && <span className="rounded-full border border-line px-3 py-1">{d.fixedRests}</span>}
      </p>
      {t.description && <p className="mt-4 leading-relaxed whitespace-pre-line text-muted">{t.description}</p>}
      {t.tags?.length ? (
        <p className="mt-3 flex flex-wrap gap-2 text-xs text-faint">
          {t.tags.map((g) => (
            <span key={g}>#{g}</span>
          ))}
        </p>
      ) : null}

      <h2 className="mt-6 font-mono text-xs tracking-[0.16em] text-faint uppercase">{d.sets}</h2>
      <ol className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="w-6 shrink-0 text-sm text-faint tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold break-words">{r.name}</span>
              {r.custom && <span className="ml-2 rounded-full bg-sky/20 px-2 py-0.5 text-[11px] text-sky-fg">{d.taught}</span>}
              <span className="block text-sm text-muted tabular-nums">
                {r.target}
                {r.restS !== null && r.restS > 0 ? ` · ${fmt(d.rest, { s: r.restS })}` : ""}
              </span>
            </span>
            {r.intensity && (
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", r.zone ? ZONE_TONE[r.zone] : "bg-surface-2 text-text")}>
                {r.intensity}
              </span>
            )}
          </li>
        ))}
      </ol>
      {t.rounds > 1 && t.roundRestS ? <p className="mt-2 text-sm text-muted">{fmt(d.roundRest, { s: t.roundRestS })}</p> : null}
      {rows.some((r) => r.zone) && <p className="mt-2 text-xs text-faint">{d.zonesNote}</p>}
      {t.moves.some((m) => m.by?.name) && (
        <p className="mt-2 text-xs text-faint">
          {t.moves
            .filter((m) => m.by?.name)
            .map((m) => `${m.name}: ${fmt(d.taughtBy, { name: m.by!.name })}`)
            .join(" · ")}
        </p>
      )}

      {stats && (
        <>
          <h2 className="mt-6 font-mono text-xs tracking-[0.16em] text-faint uppercase">{d.stats}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                [d.athletes, stats.athletes],
                [d.totalReps, stats.totalReps],
                [d.heartPoints, stats.heartPoints],
                [d.coachScore, stats.coachScore],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{count(v, lang)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/** A training in a list: name, time and level, who made it, how many trained it. */
export function TrainingCardRow({
  name,
  minutes,
  level,
  creator,
  athletes,
  d,
  lang,
  href,
  onClick,
}: {
  name: string;
  minutes: number | null;
  level: Training["level"];
  creator?: string | null;
  athletes: number;
  d: TrainingsDict;
  lang: "en" | "fr";
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="block font-semibold break-words">{name}</span>
      <span className="block text-sm text-muted">
        {minutes ? fmt(d.app.card, { min: minutes, level: d.share.level[level] }) : d.share.level[level]}
        {creator ? ` · ${creator}` : ""}
        {athletes > 0 ? ` · ${fmt(d.app.athletes, { n: count(athletes, lang) })}` : ""}
      </span>
    </>
  );
  const cls = "block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:border-pulse/60";
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
