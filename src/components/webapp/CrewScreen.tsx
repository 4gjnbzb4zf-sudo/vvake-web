"use client";

import { useEffect, useState } from "react";
import type { Clash } from "@/lib/webapp/api";
import { dayLabel, timeLabel } from "@/lib/webapp/format";
import { useApp } from "./AppContext";
import { Card, H1, Kicker, Note, Small } from "./ui";

/**
 * Crew & City (apps/mobile app/(tabs)/crew.tsx), the City Clash part: your city's clashes (GET /v1/clashes), live
 * scores, what's coming and recent results. Calling a city out, challenges, crews and rivals stay in the app.
 */
export function CrewScreen() {
  const { t, lang, me, api, fmt } = useApp();
  const [clashes, setClashes] = useState<Clash[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void api
      .clashes()
      .then((r) => setClashes(r.clashes))
      .catch(() => setError(true));
  }, [api]);

  const groups: { key: "live" | "upcoming" | "recent"; list: Clash[] }[] = [
    { key: "live", list: (clashes ?? []).filter((c) => c.status === "live" || c.status === "provisional") },
    { key: "upcoming", list: (clashes ?? []).filter((c) => c.status === "callout" || c.status === "buildup") },
    { key: "recent", list: (clashes ?? []).filter((c) => c.status === "final") },
  ];
  const statusLabel = (s: string) => (t.crew.status as Record<string, string>)[s] ?? s;

  return (
    <div className="space-y-4">
      <H1>{t.crew.title}</H1>
      <Small>{t.crew.lead}</Small>
      <Note tone={me.city ? "sky" : "butter"}>{me.city ? fmt(t.crew.yourCity, { city: me.city }) : t.crew.noCity}</Note>
      {!clashes && !error && <p className="text-muted">{t.common.loading}</p>}
      {error && <p className="text-muted">{t.common.error}</p>}
      {clashes && clashes.length === 0 && <Card>{t.crew.none}</Card>}
      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <section key={g.key} className="space-y-2">
              <Kicker tone={g.key === "live" ? "pulse" : "faint"}>{t.crew[g.key]}</Kicker>
              {g.list.map((c) => {
                const total = Math.max(1, c.a.score + c.b.score);
                const winner = c.result?.winnerSide === "a" ? c.a.city : c.result?.winnerSide === "b" ? c.b.city : null;
                return (
                  <Card key={c.id} tone={c.status === "live" ? "pulse" : undefined}>
                    <div className="flex items-center justify-between">
                      <Kicker tone={c.status === "live" ? "pulse" : "faint"}>{statusLabel(c.status)}</Kicker>
                      <Small>{`${dayLabel(c.startsAt, lang)} · ${timeLabel(c.startsAt, lang)}`}</Small>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                      <div>
                        <p className="font-display text-[15px] font-semibold">{c.a.city}</p>
                        <p className="font-display text-2xl font-bold text-volt-fg">{Math.round(c.a.score)}</p>
                        {typeof c.a.movers === "number" && <Small>{fmt(t.crew.movers, { n: c.a.movers })}</Small>}
                      </div>
                      <span className="text-sm text-faint">{t.crew.vs}</span>
                      <div>
                        <p className="font-display text-[15px] font-semibold">{c.b.city}</p>
                        <p className="font-display text-2xl font-bold text-pulse-fg">{Math.round(c.b.score)}</p>
                        {typeof c.b.movers === "number" && <Small>{fmt(t.crew.movers, { n: c.b.movers })}</Small>}
                      </div>
                    </div>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className="bg-volt" style={{ width: `${(c.a.score / total) * 100}%` }} />
                      <div className="bg-pulse" style={{ width: `${(c.b.score / total) * 100}%` }} />
                    </div>
                    {c.status === "final" && (
                      <p className="mt-2 text-sm font-semibold">{winner ? fmt(t.crew.winner, { city: winner }) : t.crew.draw}</p>
                    )}
                  </Card>
                );
              })}
            </section>
          ),
      )}
      <Note tone="butter">{t.crew.webNote}</Note>
      <Note>{t.crew.challengesNote}</Note>
    </div>
  );
}
