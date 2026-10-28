"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { SessionFeel } from "@/lib/webapp/api";
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

const FEELS: SessionFeel[] = ["hard", "right", "easy"];

/**
 * "How did it feel?" after a webcam camera workout or a training run (the phone's SessionFeedback): one tap goes to
 * the coach with `context.feedback`; the coach's answer shows here, with a link to the plan when it proposes a
 * change. Optional; signed in only (the web app always is). Offline or no reply: "Thanks, noted."
 */
export function FeelAfter({ sport, minutes, className }: { sport: string; minutes: number; className?: string }) {
  const { t, api, lang, prefs, go } = useApp();
  const x = t.feel;
  const [picked, setPicked] = useState<SessionFeel | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [proposal, setProposal] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (feel: SessionFeel) => {
    if (picked) return;
    setPicked(feel);
    setBusy(true);
    try {
      const r = await api.coachTalk({
        message: x.say[feel],
        context: { feedback: { feel, sport, minutes: Math.max(0, Math.round(minutes)) } },
        lang,
        units: prefs.units,
        clock: new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 ? "12h" : "24h",
        voice: false,
      });
      setReply(r.reply);
      setProposal(r.action?.type === "propose_plan");
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
    </section>
  );
}
