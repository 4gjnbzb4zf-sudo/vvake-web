"use client";

import { cn } from "@/lib/cn";
import type { CardTurn, WebCardPlan } from "@/lib/webapp/coach/webActions";
import { resultLine } from "@/lib/webapp/coach/webActions";
import { useApp } from "./AppContext";
import { Btn, Small } from "./ui";

/**
 * The coach's action card in the chat (ADR-0063): "Start Run · 30 min easy · [Start] [Not now]". The title, the detail
 * and the buttons' words are the server's (in the athlete's language); nothing runs before the tap. When the web can't
 * run it now (a workout is on, the camera is off, it starts on the phone) the card says why, with no fake button.
 */
export function CoachActionCard({
  act,
  plan,
  local,
  onConfirm,
  onCancel,
}: {
  act: CardTurn;
  plan: WebCardPlan;
  /** Made on this device because the coach couldn't be reached. */
  local?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, lang, go } = useApp();
  const a = act.action;
  const L = lang === "fr" ? "fr" : "en";
  const open = act.state === "pending" || act.state === "busy";
  const status =
    act.state === "done"
      ? t.coach.action.done
      : act.state === "cancelled"
        ? t.coach.action.cancelled
        : act.state === "failed"
          ? t.coach.action.failed
          : null;
  return (
    <div
      className={cn("mt-2 ml-2 max-w-[85%] rounded-2xl border px-4 py-3", open ? "border-volt/60 bg-surface" : "border-line bg-surface/60")}
      role="group"
      aria-label={a.card.title}
    >
      <Small className="text-xs tracking-wide text-lilac-fg uppercase">{t.coach.action.label}</Small>
      <p className="mt-1 font-display text-base font-semibold">{a.card.title}</p>
      {a.card.detail && <p className="mt-0.5 text-sm text-faint">{a.card.detail}</p>}
      {open && plan.kind === "run" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="volt" disabled={act.state === "busy"} onClick={onConfirm}>
            {a.card.confirm}
          </Btn>
          <Btn variant="ghost" disabled={act.state === "busy"} onClick={onCancel}>
            {a.card.cancel}
          </Btn>
        </div>
      )}
      {open && plan.kind === "line" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm">{resultLine(a, { ok: false, reason: plan.reason }, L)}</p>
          {plan.turnOnCamera && (
            <Btn variant="ghost" onClick={() => go({ name: "features" })}>
              {t.coach.action.turnOnCamera}
            </Btn>
          )}
        </div>
      )}
      {act.state === "expired" && <Small className="mt-2">{t.coach.action.expired}</Small>}
      {status && <Small className="mt-2">{status}</Small>}
      {local && open && <Small className="mt-2">{t.coach.action.local}</Small>}
    </div>
  );
}
