"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adaptiveOn, progressApi, type Progress } from "@/lib/webapp/adaptive/progressApi";
import { useApp } from "./AppContext";

/**
 * GET /v1/athlete/progress shared by Your progress, Today's one line and the workout's start (the day's readiness):
 * the last answer stays in memory for the visit (10 minutes), every screen sees a reload. Nothing is asked when the API
 * hasn't got adaptive coaching (`features.adaptive`), and a failure just shows nothing.
 */
let last: { userId: string; key: string; at: number; answer: Progress } | null = null;
const listeners = new Set<(p: Progress) => void>();
const FRESH_MS = 10 * 60_000;

/** The cached readiness (for the workout's start), or null. */
export const cachedReadiness = (userId: string) => (last && last.userId === userId ? (last.answer.readiness?.level ?? null) : null);

export function useProgress(enabled = true) {
  const { session, me, lang, prefs } = useApp();
  const on = enabled && adaptiveOn(me);
  const api = useMemo(() => progressApi(session), [session]);
  const key = `${lang}/${prefs.units}`;
  const cached = last && last.userId === me.id && last.key === key ? last.answer : null;
  const [progress, setProgress] = useState<Progress | null>(cached);
  const [state, setState] = useState<"loading" | "ok" | "error" | "off">(!on ? "off" : cached ? "ok" : "loading");

  const load = useCallback(
    async (force = false) => {
      if (!on) return;
      if (!force && last && last.userId === me.id && last.key === key && Date.now() - last.at < FRESH_MS) {
        setProgress(last.answer);
        setState("ok");
        return;
      }
      try {
        const p = await api.progress(lang, prefs.units);
        last = { userId: me.id, key, at: Date.now(), answer: p };
        for (const l of listeners) l(p);
        setState("ok");
      } catch {
        setState((s) => (s === "ok" ? s : "error"));
      }
    },
    [on, api, lang, prefs.units, me.id, key],
  );

  useEffect(() => {
    const l = (p: Progress) => setProgress(p);
    listeners.add(l);
    const id = window.setTimeout(() => void load(), 0);
    return () => {
      listeners.delete(l);
      window.clearTimeout(id);
    };
  }, [load]);

  return { progress, state, reload: () => load(true), api, on };
}
