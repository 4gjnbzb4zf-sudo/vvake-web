"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { CoachWhere, SessionFeel } from "@/lib/webapp/api";
import { webRouteForScreen } from "@/lib/webapp/suggest/steps";
import { SUGGEST_LEVELS } from "@/lib/webapp/suggest/suggest";
import { useApp } from "./AppContext";
import { Kicker, Small } from "./ui";

/**
 * Quiet (ADR-0062 §4.4): "How much should VVake suggest?" Guide me · Only the essentials · Quiet: nothing unless I
 * ask. Saved at once in this browser and with the account (prefs.suggest, newest wins), so every device follows.
 * Shown in You › settings and on the Your VVake summary.
 */
export function SuggestPicker({ className }: { className?: string }) {
  const { t, suggestLevel, setSuggestLevel } = useApp();
  const x = t.suggest;
  return (
    <div className={className}>
      <p className="mb-1 text-sm font-medium">{x.title}</p>
      <div role="radiogroup" aria-label={x.title} className="grid gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {SUGGEST_LEVELS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={suggestLevel === k}
            onClick={() => setSuggestLevel(k)}
            className={cn(
              "min-h-11 rounded-lg px-3 py-2 text-left",
              suggestLevel === k ? "bg-volt text-ink" : "text-text hover:bg-surface/60",
            )}
          >
            <span className="block text-sm font-semibold">{x.levels[k]}</span>
            <span className={cn("block text-xs", suggestLevel === k ? "text-ink/80" : "text-muted")}>{x.details[k]}</span>
          </button>
        ))}
      </div>
      <Small className="mt-1">{x.lead}</Small>
    </div>
  );
}

/**
 * "Replay tours" (ADR-0062 §14 A), next to the suggestion level: every first-time tour (the workout, the camera
 * workout, a training run) shows again the next time, on every device (the ledger's `tour:<activity>` restarted).
 */
export function ReplayTours({ className }: { className?: string }) {
  const { t, replayTours } = useApp();
  const [done, setDone] = useState(false);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <p role="status" className="flex-1 text-xs leading-4 text-muted">
        {done ? t.tours.replayed : t.tours.replayDetail}
      </p>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-50"
        disabled={done}
        onClick={() => {
          replayTours();
          setDone(true);
        }}
      >
        {t.tours.replay}
      </button>
    </div>
  );
}

const FEELS: SessionFeel[] = ["hard", "right", "easy"];

/**
 * "How did it feel?" after a webcam camera workout or a training run (the phone's SessionFeedback): one tap goes to
 * the coach with `context.feedback`; the coach's answer shows here, with a link to the plan when it proposes a
 * change. Optional; signed in only (the web app always is). Offline or no reply: "Thanks, noted."
 */
export function FeelAfter({
  sport,
  minutes,
  className,
  onFeel,
  where,
}: {
  sport: string;
  minutes: number;
  className?: string;
  /** The tap, for the next steps (a plan review after a hard or easy one). */
  onFeel?: (f: SessionFeel) => void;
  /** The coach's `context.where` (ADR-0062 §5): this summary and the session just done. */
  where?: CoachWhere;
}) {
  const { t, api, lang, prefs, go } = useApp();
  const x = t.feel;
  const [picked, setPicked] = useState<SessionFeel | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [proposal, setProposal] = useState(false);
  const [screen, setScreen] = useState<{ route: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (feel: SessionFeel) => {
    if (picked) return;
    setPicked(feel);
    onFeel?.(feel);
    setBusy(true);
    try {
      const r = await api.coachTalk({
        message: x.say[feel],
        context: {
          feedback: { feel, sport, minutes: Math.max(0, Math.round(minutes)) },
          ...(where ? { where: { ...where, ...(where.last ? { last: { ...where.last, feel } } : {}) } } : {}),
        },
        lang,
        units: prefs.units,
        clock: new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 ? "12h" : "24h",
        voice: false,
      });
      setReply(r.reply);
      setProposal(r.action?.type === "propose_plan");
      setScreen(openScreenOf(r.action));
    } catch {
      setReply(x.thanks);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={x.title} className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{x.title}</p>
      <div className="flex gap-1.5">
        {FEELS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={picked === f}
            disabled={!!picked && picked !== f}
            onClick={() => void send(f)}
            className={cn(
              "min-h-11 flex-1 rounded-xl border px-2 text-sm font-semibold transition-opacity",
              picked === f ? "border-lilac bg-lilac text-ink" : "border-line text-text",
              picked && picked !== f && "opacity-40",
            )}
          >
            {x[f]}
          </button>
        ))}
      </div>
      {busy && <Kicker tone="lilac">{t.coach.thinking}</Kicker>}
      {reply && (
        <p role="status" className="text-sm">
          {reply}
        </p>
      )}
      {proposal && (
        <button type="button" className="text-sm text-lilac-fg underline" onClick={() => go({ name: "plan" })}>
          {t.coach.proposal} ›
        </button>
      )}
      {screen && <OpenScreenButton route={screen.route} label={screen.label} />}
    </section>
  );
}

/** The coach's `open_screen` action (ADR-0062 §5) when the web has that screen, else null. Pure. */
export function openScreenOf(action: { type: string; route?: string | null; label?: string | null } | null | undefined) {
  if (action?.type !== "open_screen" || !action.route || !webRouteForScreen(action.route)) return null;
  return { route: action.route, label: (action.label ?? "").trim().slice(0, 60) };
}

/** A coach reply's button to a screen ("Where are my moves?" → My trainings). */
export function OpenScreenButton({ route, label }: { route: string; label: string }) {
  const { go, t } = useApp();
  const r = webRouteForScreen(route);
  if (!r) return null;
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center rounded-full border border-lilac-fg/50 px-4 text-sm font-semibold text-lilac-fg"
      onClick={() => go(r)}
    >
      {label || t.coach.openScreen} ›
    </button>
  );
}
