"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { nextSteps, STEP_DEFS, type Moment, type Step } from "@/lib/webapp/suggest/nextStep";
import { tourKey, tourSeen, webRouteForStep, type StepTarget, type TourId } from "@/lib/webapp/suggest/steps";
import { useApp } from "./AppContext";
import { useSeason } from "./useSeason";
import { useWorkout } from "./WorkoutContext";
import { Kicker } from "./ui";

/**
 * Next steps after a session (VVFit ADR-0062 §4, the phone's NextSteps row): game-core's engine picks at most one
 * primary and two secondary steps for the moment (Only the essentials: the primary alone; Quiet: none), from the
 * steps the web has a screen for. One tap opens it (accepted), ✕ says "not this" (dismissed), leaving the screen
 * without a tap counts as ignored; the ledger learns from all three (dismissed twice: muted 60 days). The steps are
 * picked from the ledger as it was when the summary opened, so recording "shown" never hides them under their own cap.
 */
export function NextStepsRow({
  moment,
  target,
  onLeave,
  onHere,
  className,
}: {
  /** The moment, built from what the web knows (suggest/steps.ts); null while the summary isn't saved yet. */
  moment: Moment | null;
  target?: StepTarget;
  /** Called before a step opens another screen (the GPS summary closes itself). */
  onLeave?: () => void;
  /** A step done right here from the tap (the .ics download of "Add it to your calendar?"): true when handled. */
  onHere?: (s: Step) => boolean;
  className?: string;
}) {
  const { t, lang, go, fmt, steps, recordSteps, suggestLevel, featureOn } = useApp();
  const wk = useWorkout();
  const inWorkout = !!wk.w;
  const [ledger] = useState(() => steps);
  const [now] = useState(() => new Date());
  const [gone, setGone] = useState<readonly string[]>([]);
  const key = JSON.stringify({ moment, target });
  const picked = useMemo<Step[]>(() => {
    if (!moment) return [];
    const defs = STEP_DEFS.filter((d) => webRouteForStep({ route: d.route, params: d.params ? d.params(moment) : {} }, target) !== null);
    const r = nextSteps(moment, { level: suggestLevel, featureOn, ledger, now, inWorkout, lang }, defs);
    return r.primary ? [r.primary, ...r.more] : [];
    // `key` stands for the moment and the target (new objects on every render of the summary).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, suggestLevel, featureOn, ledger, now, inWorkout, lang]);
  const visible = picked.filter((s) => !gone.includes(s.id));

  // Shown once each; on leaving, the ones shown and never answered are "ignored".
  const shown = useRef(new Set<string>());
  const answered = useRef(new Set<string>());
  const record = useRef(recordSteps);
  useEffect(() => {
    record.current = recordSteps;
  }, [recordSteps]);
  const ids = visible.map((s) => s.id).join(",");
  useEffect(() => {
    const fresh = ids ? ids.split(",").filter((id) => !shown.current.has(id)) : [];
    for (const id of fresh) shown.current.add(id);
    if (fresh.length) record.current(fresh.map((id) => ({ id, ev: "shown" as const })));
  }, [ids]);
  useEffect(() => {
    const s = shown.current;
    const a = answered.current;
    return () => {
      const left = [...s].filter((id) => !a.has(id));
      if (left.length) record.current(left.map((id) => ({ id, ev: "ignored" as const })));
    };
  }, []);

  if (!visible.length) return null;
  const open = (s: Step) => {
    const r = webRouteForStep(s, target);
    answered.current.add(s.id);
    recordSteps([{ id: s.id, ev: "accepted" }]);
    if (onHere?.(s)) return setGone((g) => [...g, s.id]);
    if (!r) return;
    onLeave?.();
    go(r);
  };
  const dismiss = (s: Step) => {
    answered.current.add(s.id);
    recordSteps([{ id: s.id, ev: "dismissed" }]);
    setGone((g) => [...g, s.id]);
  };
  return (
    <section aria-label={t.steps.title} className={cn("space-y-2", className)}>
      <Kicker tone="volt">{t.steps.title}</Kicker>
      <ul className="flex flex-wrap gap-2">
        {visible.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "inline-flex max-w-full items-stretch overflow-hidden rounded-2xl border",
              i === 0 ? "border-volt bg-volt text-ink" : "border-line bg-surface text-text",
            )}
          >
            <button type="button" className="min-h-11 px-4 py-2 text-left text-sm font-semibold" onClick={() => open(s)}>
              {s.text}
            </button>
            <button
              type="button"
              aria-label={fmt(t.steps.notThis, { step: s.text })}
              className={cn("min-h-11 w-11 shrink-0 border-l text-sm", i === 0 ? "border-ink/20 text-ink/70" : "border-line text-muted")}
              onClick={() => dismiss(s)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Whether the athlete has a season plan, for the moment's `hasPlan` (undefined until known, or when Plan is off). */
export function useHasPlan(): boolean | undefined {
  const { featureOn, suggests } = useApp();
  const wanted = featureOn("plan") && suggests("next_step");
  const { season } = useSeason(undefined, wanted);
  return wanted && season ? !!season.plan : undefined;
}

// ── First-time tours ─────────────────────────────────────────────────────────────────────────────────────────────

export interface TourCard {
  /** The `data-tour` value of the control the card points at; a card whose control isn't on screen is left out. */
  anchor: string;
  title: string;
  body: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * A first-time tour (ADR-0062 §14 A): up to three cards, each highlighting the real control it explains, shown before
 * the activity starts and never during a workout or in Quiet. Skippable (Skip, Escape), shown once (`tour:<id>` in the
 * step ledger: shown, then accepted when finished or dismissed when skipped); You › "Replay tours" brings them back.
 * Motion follows prefers-reduced-motion.
 */
export function Tour({ id, cards }: { id: TourId; cards: readonly TourCard[] }) {
  const { t, fmt, steps, recordSteps, suggests } = useApp();
  const wk = useWorkout();
  const [wanted] = useState(() => suggests("tour", { inWorkout: !!wk.w }) && !tourSeen(steps, id));
  const [list, setList] = useState<TourCard[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const titleId = useId();
  const action = useRef<HTMLButtonElement>(null);

  // Start once the screen is laid out, with the cards whose control is there.
  useEffect(() => {
    if (!wanted) return;
    const timer = window.setTimeout(() => {
      const here = cards.filter((c) => document.querySelector(`[data-tour="${c.anchor}"]`)).slice(0, 3);
      if (!here.length) return;
      setList(here);
      recordSteps([{ id: tourKey(id), ev: "shown" }]);
    }, 400);
    return () => window.clearTimeout(timer);
    // Once per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const card = list?.[i] ?? null;
  const measure = useCallback(() => {
    if (!card) return;
    const el = document.querySelector(`[data-tour="${card.anchor}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [card]);
  useLayoutEffect(() => {
    if (!card) return;
    const el = document.querySelector(`[data-tour="${card.anchor}"]`);
    el?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    const frame = window.requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, reducedMotion() ? 0 : 450);
    action.current?.focus({ preventScroll: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [card, measure]);
  useEffect(() => {
    if (!card) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [card, measure]);

  const close = useCallback(
    (how: "accepted" | "dismissed") => {
      setList(null);
      recordSteps([{ id: tourKey(id), ev: how }]);
    },
    [id, recordSteps],
  );
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("dismissed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, close]);

  if (!list || !card) return null;
  const last = i === list.length - 1;
  const pad = 8;
  // The card sits away from the highlighted control: below it when it's in the top half, else above.
  const cardAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* Holds every tap until the tour is done or skipped (never starts anything by accident). */}
      <div className="absolute inset-0" aria-hidden onClick={() => action.current?.focus()} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-volt motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62)",
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/60" />
      )}
      <div
        className={cn(
          "absolute inset-x-4 mx-auto max-w-md rounded-2xl border border-line bg-night-2 p-4 shadow-xl",
          cardAtTop ? "top-[max(env(safe-area-inset-top),1rem)]" : "bottom-[max(env(safe-area-inset-bottom),1rem)]",
        )}
      >
        <Kicker tone="volt">
          {t.tours.label} · {fmt(t.tours.of, { n: i + 1, total: list.length })}
        </Kicker>
        <p id={titleId} className="mt-2 font-display text-lg font-semibold">
          {card.title}
        </p>
        <p className="mt-1 text-sm text-muted">{card.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" className="min-h-11 px-2 text-sm text-muted underline" onClick={() => close("dismissed")}>
            {t.tours.skip}
          </button>
          <button
            ref={action}
            type="button"
            className="min-h-11 rounded-xl bg-volt px-5 font-display text-sm font-semibold text-ink"
            onClick={() => (last ? close("accepted") : setI(i + 1))}
          >
            {last ? t.tours.done : t.tours.next}
          </button>
        </div>
      </div>
    </div>
  );
}
