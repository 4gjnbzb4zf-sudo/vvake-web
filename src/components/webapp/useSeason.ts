"use client";

import { useCallback, useEffect, useState } from "react";
import { localTz } from "@/lib/webapp/api";
import type { SeasonAnswer } from "@/lib/webapp/season";
import { useApp } from "./AppContext";

/**
 * The season (GET /v1/season) shared by the Plan tab and the Season screens: the last answer stays in memory for the
 * visit (moving between screens shows it at once, then refreshes), and every change's answer (PUT, an edit, an undo)
 * replaces it, since each one sends the whole season back.
 */
let last: { userId: string; lang: string; week: number | undefined; answer: SeasonAnswer } | null = null;
const listeners = new Set<(a: SeasonAnswer) => void>();

/** `enabled` false: no request (a second week view that isn't shown). */
export function useSeason(week?: number, enabled = true) {
  const { api, lang, me } = useApp();
  const cached = last && last.userId === me.id && last.lang === lang && last.week === week ? last.answer : null;
  const [season, setSeason] = useState<SeasonAnswer | null>(cached);
  const [state, setState] = useState<"loading" | "ok" | "error">(cached ? "ok" : "loading");

  const adopt = useCallback(
    (a: SeasonAnswer, forWeek: number | undefined = week) => {
      last = { userId: me.id, lang, week: forWeek, answer: a };
      setSeason(a);
      setState("ok");
      if (forWeek === undefined) for (const l of listeners) l(a);
    },
    [me.id, lang, week],
  );

  const load = useCallback(async () => {
    try {
      adopt(await api.season(localTz(), lang, week), week);
    } catch {
      setState((s) => (s === "ok" ? s : "error"));
    }
  }, [api, lang, week, adopt]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, enabled]);

  // Another screen changed this week's season: follow it.
  useEffect(() => {
    if (week !== undefined) return;
    const l = (a: SeasonAnswer) => setSeason(a);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, [week]);

  return { season, state, load, adopt };
}
