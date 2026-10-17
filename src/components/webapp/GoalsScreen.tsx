"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { WebAppDict } from "@/i18n/webapp";
import { fmt } from "@/i18n/webapp";
import { goalProgress, MAX_GOALS, validGoal, type GoalKind, type WebGoal } from "@/lib/webapp/goals";
import { QUICK_SPORTS, sportLabel, uuid } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { Bar, Btn, Card, Field, H1, inputCls, Kicker, Note, Segmented, Small } from "./ui";
import { useNow } from "./useNow";

/** "3 sessions a week for 4 weeks · Run". */
export function goalTitle(g: WebGoal, t: WebAppDict, lang: Locale): string {
  const base =
    g.kind === "consistency"
      ? fmt(t.goals.title_consistency, { n: g.target, w: g.span })
      : g.kind === "sessions"
        ? fmt(t.goals.title_sessions, { n: g.target, d: g.span })
        : fmt(t.goals.title_distance, { n: g.target, d: g.span });
  return g.sport ? `${base} · ${sportLabel(g.sport, lang)}` : base;
}

const DEFAULTS: Record<GoalKind, { target: number; span: number }> = {
  consistency: { target: 3, span: 4 },
  sessions: { target: 12, span: 30 },
  distance: { target: 50, span: 30 },
};

export function GoalForm({ onAdd }: { onAdd: (g: Omit<WebGoal, "id" | "startMs">) => void }) {
  const { t, lang } = useApp();
  const [kind, setKind] = useState<GoalKind>("consistency");
  const [target, setTarget] = useState(String(DEFAULTS.consistency.target));
  const [span, setSpan] = useState(String(DEFAULTS.consistency.span));
  const [sport, setSport] = useState("");
  const candidate = { id: "x", startMs: 0, kind, target: Number(target), span: Number(span), ...(sport ? { sport } : {}) };
  const ok = validGoal(candidate);
  return (
    <div className="space-y-3">
      <Field label={t.goals.kind}>
        <Segmented
          label={t.goals.kind}
          value={kind}
          options={(["consistency", "sessions", "distance"] as const).map((k) => ({ value: k, label: t.goals.kinds[k] }))}
          onChange={(k) => {
            setKind(k);
            setTarget(String(DEFAULTS[k].target));
            setSpan(String(DEFAULTS[k].span));
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.goals.target[kind]}>
          <input
            className={inputCls}
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
        </Field>
        <Field label={t.goals.span[kind]}>
          <input
            className={inputCls}
            inputMode="numeric"
            value={span}
            onChange={(e) => setSpan(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </Field>
      </div>
      <Field label={t.goals.sport}>
        <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">{t.goals.anySport}</option>
          {QUICK_SPORTS.map((s) => (
            <option key={s} value={s}>
              {sportLabel(s, lang)}
            </option>
          ))}
        </select>
      </Field>
      <Btn
        variant="volt"
        className="w-full"
        disabled={!ok}
        onClick={() => ok && onAdd({ kind, target: Number(target), span: Number(span), ...(sport ? { sport } : {}) })}
      >
        {t.goals.add}
      </Btn>
    </div>
  );
}

/** Your goals (apps/mobile app/goals.tsx): progress from every session on the account, add and remove. */
export function GoalsScreen() {
  const { t, lang, goals, setGoals, sessions } = useApp();
  const [adding, setAdding] = useState(goals.length === 0);
  const items = useMemo(
    () => sessions.map((s) => ({ sport: s.sport, startMs: Date.parse(s.startedAt), distanceM: s.distanceM ?? undefined })),
    [sessions],
  );
  const now = useNow();
  return (
    <div className="space-y-4">
      <H1>{t.goals.title}</H1>
      <Small>{t.goals.lead}</Small>
      {goals.map((g) => {
        const p = goalProgress(g, items, now);
        return (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-medium">{goalTitle(g, t, lang)}</p>
              <Small>{`${p.done} / ${p.target}`}</Small>
            </div>
            <div className="mt-2">
              <Bar fraction={p.fraction} tone={p.status === "reached" ? "mint" : p.status === "ended" || !p.onTrack ? "butter" : "volt"} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Kicker tone={p.status === "reached" ? "mint" : p.status === "ended" ? "butter" : "faint"}>
                {p.status === "reached" ? t.goals.reached : p.status === "ended" ? t.goals.ended : fmt(t.today.daysLeft, { n: p.daysLeft })}
              </Kicker>
              <button type="button" className="h-11 px-2 text-sm text-down-fg" onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>
                {t.goals.remove}
              </button>
            </div>
          </Card>
        );
      })}
      {goals.length < MAX_GOALS ? (
        adding ? (
          <Card>
            <GoalForm
              onAdd={(g) => {
                setGoals([...goals, { ...g, id: uuid(), startMs: Date.now() }]);
                setAdding(false);
              }}
            />
          </Card>
        ) : (
          <Btn variant="ghost" className="w-full" onClick={() => setAdding(true)}>
            + {t.goals.add}
          </Btn>
        )
      ) : (
        <Small>{t.goals.max}</Small>
      )}
      <Note>{t.goals.weightNote}</Note>
    </div>
  );
}
