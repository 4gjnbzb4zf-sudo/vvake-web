"use client";

import { cn } from "@/lib/cn";
import type { CardTurn, WebCardPlan } from "@/lib/webapp/coach/webActions";
import { resultLine } from "@/lib/webapp/coach/webActions";
import { runsOnArrival } from "@/lib/webapp/coach/talkFlow";
import { directionsUrl } from "@/lib/webapp/places";
import { getTalkDict } from "@/i18n/talk";
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
  onAllowPlaces,
}: {
  act: CardTurn;
  plan: WebCardPlan;
  /** Made on this device because the coach couldn't be reached. */
  local?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** show_places: the athlete allowed the location (the card's own ask). */
  onAllowPlaces?: () => void;
}) {
  const { t, lang, go, prefs } = useApp();
  const units = prefs.units;
  const tk = getTalkDict(lang);
  const a = act.action;
  // Pause / resume, summaries, places: they answer, so no Yes / Not now (ADR-0068).
  const answers = runsOnArrival(a);
  const L = lang === "fr" ? "fr" : "en";
  const open = act.state === "pending" || act.state === "busy";
  const status =
    answers && act.state !== "failed"
      ? null
      : act.state === "done"
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
      {a.card.detail && <p className="mt-0.5 text-sm whitespace-pre-line text-faint">{a.card.detail}</p>}
      {a.type === "show_summary" && !a.card.detail && <Small className="mt-1">{tk.summaryNone}</Small>}
      {a.type === "show_places" && act.places && <Places view={act.places} onAllow={onAllowPlaces} units={units} />}
      {open && plan.kind === "run" && !answers && (
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

/** The places an outing card found: the location ask first, then 1-3 places with directions (ADR-0068). */
function Places({ view, onAllow, units }: { view: NonNullable<CardTurn["places"]>; onAllow?: () => void; units: "metric" | "imperial" }) {
  const { lang } = useApp();
  const tk = getTalkDict(lang).places;
  const km = (v: number) => (units === "imperial" ? `${(v / 1.609).toFixed(1)} mi` : String(v)).replace(".", lang === "fr" ? "," : ".");
  const unit = (s: string) => (units === "imperial" ? s.replace(" km", "") : s);
  const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);
  if (view.kind === "ask")
    return (
      <div className="mt-2 space-y-2">
        <p className="text-sm">{tk.ask}</p>
        {onAllow && (
          <Btn variant="volt" onClick={onAllow}>
            {tk.allow}
          </Btn>
        )}
      </div>
    );
  if (view.kind === "searching") return <Small className="mt-2">{tk.searching}</Small>;
  if (view.kind === "busy") return <Small className="mt-2">{tk.busy}</Small>;
  if (view.kind === "none") return null;
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2">
        {view.items.map((p) => (
          <li key={`${p.name}-${p.lat}`} className="rounded-xl border border-line px-3 py-2">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-faint">
              {[
                unit(tk.away.replace("{km}", km(p.awayKm))),
                p.loopKm ? unit(tk.loop.replace("{km}", km(p.loopKm))) : "",
                p.minutes ? tk.time.replace("{t}", dur(p.minutes)) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <a
              className="mt-1 inline-block text-sm text-sky-fg underline"
              href={directionsUrl(
                { lat: p.lat, lon: p.lon, name: p.name },
                /iPhone|iPad|Mac/.test(navigator.userAgent) ? "apple" : "google",
                p.awayKm * 1000,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tk.directions}
            </a>
          </li>
        ))}
      </ul>
      <Small>{tk.offline}</Small>
    </div>
  );
}
