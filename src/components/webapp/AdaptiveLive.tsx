"use client";

import { getAdaptiveDict } from "@/i18n/adaptive";
import { cn } from "@/lib/cn";
import { clock, pace } from "@/lib/webapp/format";
import { RPE_TAP, segmentWord, type AdaptiveSummary, type RpeTap, type SegmentKind } from "@/lib/webapp/adaptive/adaptiveSession";
import { adjustLine } from "@/lib/webapp/adaptive/workoutAdaptive";
import { useApp } from "./AppContext";
import { useWorkout, type AdaptiveLive } from "./WorkoutContext";
import { Btn, Card, Kicker, Small } from "./ui";

/**
 * The planned session's live panel on the web workout (ADR-0069 "In-session UX"): the segment word (Warm-up / Rep 2
 * of 5 / Recover / Steady / Cool-down), the target (zone with heart rate, else pace, else effort), time left or "until
 * your heart comes down", the status colour, what comes next; and the effort card (Easy / Moderate / Hard, one tap,
 * gone after 20 s) when the session asks. The summary card tells what was held and what was adjusted, in words.
 */

const STATUS_CLS = {
  in: "bg-mint/20 text-mint-fg",
  low: "bg-sky/20 text-sky-fg",
  high: "bg-butter/20 text-butter-fg",
  unknown: "bg-surface text-muted",
} as const;

export function AdaptivePanel({ live }: { live: AdaptiveLive }) {
  const { lang, prefs } = useApp();
  const wk = useWorkout();
  const x = getAdaptiveDict(lang).live;
  const v = live.view;
  const L = lang === "fr" ? "fr" : "en";
  const segName =
    v.kind === "work" && v.rep && v.reps ? x.rep.replace("{n}", String(v.rep)).replace("{m}", String(v.reps)) : segmentWord(v.kind, L);
  // The target: a zone only with heart rate; else the pace; else the effort out of 10.
  const target =
    live.hasHr && v.zone
      ? x.zone.replace("{n}", String(v.zone))
      : v.paceSPerKm
        ? pace(v.paceSPerKm, prefs.units)
        : x.effort.replace("{n}", String(v.rpe));
  const nextWord = (k: SegmentKind, z?: number) =>
    live.hasHr && z ? x.nextZone.replace("{what}", segmentWord(k, L)).replace("{n}", String(z)) : segmentWord(k, L);
  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      <div className={cn("rounded-xl px-3 py-2", STATUS_CLS[v.done ? "in" : v.status])}>
        <div className="flex items-baseline justify-between gap-2">
          <Kicker tone="volt">{x.kicker}</Kicker>
          {live.fixed && <span className="text-xs text-muted">{x.fixed}</span>}
        </div>
        {v.done ? (
          <p className="mt-1 text-sm font-semibold">{x.done}</p>
        ) : (
          <>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-display text-xl font-bold">{segName}</p>
              <p className="text-sm">
                <span className="text-muted">{x.target} </span>
                <span className="font-semibold">{target}</span>
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="tabular-nums">{v.untilRecovered ? x.untilRecovered : x.left.replace("{t}", clock(v.leftS))}</span>
              <span className="font-semibold">{x.status[v.status]}</span>
            </div>
            {v.next && <p className="mt-0.5 text-xs text-muted">{x.next.replace("{what}", nextWord(v.next.kind, v.next.zone))}</p>}
          </>
        )}
        {live.eased && <p className="mt-1 text-xs">{x.eased[live.eased]}</p>}
      </div>
      {live.asking && (
        <div className="rounded-xl bg-volt/15 px-3 py-2" role="group" aria-label={x.askTitle}>
          <p className="text-sm font-semibold">{x.askTitle}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(RPE_TAP) as RpeTap[]).map((k) => (
              <Btn key={k} variant={k === "moderate" ? "volt" : "ghost"} className="h-12 px-2" onClick={() => wk.answerEffort(k)}>
                {x.ask[k]}
              </Btn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EFFORT_WORD = { en: ["", "", "", "easy", "", "moderate", "", "hard"], fr: ["", "", "", "facile", "", "moyen", "", "dur"] };

export function AdaptiveSummaryCard({ summary }: { summary: AdaptiveSummary }) {
  const { lang } = useApp();
  const x = getAdaptiveDict(lang).summary;
  const line = adjustLine(summary, lang);
  const words = summary.rpe.map((n) => EFFORT_WORD[lang === "fr" ? "fr" : "en"][n] || `${n}/10`);
  return (
    <Card>
      <Kicker tone="volt">{x.title}</Kicker>
      {summary.workPlannedS > 0 && (
        <p className="mt-2 font-display text-lg font-semibold">
          {x.held
            .replace("{held}", String(Math.round(summary.workDoneS / 60)))
            .replace("{planned}", String(Math.round(summary.workPlannedS / 60)))}
        </p>
      )}
      <p className="mt-1 text-sm">{line ? x.adjust.replace("{line}", line) : summary.timing === "fixed" ? x.fixed : x.none}</p>
      {words.length > 0 && <Small className="mt-1">{x.effort.replace("{list}", words.join(", "))}</Small>}
    </Card>
  );
}
