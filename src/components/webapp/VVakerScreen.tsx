"use client";

import { useState } from "react";
import { useApp } from "./AppContext";
import { castSrc, resetVVakerCache, useVVakerSrc, VVakerImg } from "./MyVVaker";
import { CastGrid } from "./Onboarding";
import { Btn, Card, H1, Kicker, Small } from "./ui";

/**
 * Your VVaker (apps/mobile app/vvaker.tsx): the one on the account (your render, or the cast member), and the cast to
 * pick another (PATCH /v1/me castId: the phone and the watch follow, the latest choice wins). Building a custom look
 * and rendering it stay in the app.
 */
export function VVakerScreen() {
  const { t, me, setMe, api } = useApp();
  const mine = useVVakerSrc();
  const [pick, setPick] = useState(me.castId ?? "runner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      setMe(await api.patchMe({ castId: pick, vvakerUpdatedAt: new Date().toISOString() }));
      resetVVakerCache();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const changed = pick !== me.castId;
  return (
    <div className="space-y-4">
      <H1>{t.vvaker.title}</H1>
      <Small>{t.vvaker.lead}</Small>
      <Card>
        <Kicker tone="volt">{t.vvaker.current}</Kicker>
        <div className="mt-2 flex justify-center">
          <VVakerImg alt={me.name ?? ""} className="h-56 w-40" src={changed ? castSrc(pick) : mine.src} />
        </div>
      </Card>
      <CastGrid value={pick} onChange={setPick} />
      <div className="sticky bottom-20">
        <Btn big variant="volt" className="w-full" disabled={!changed || busy} onClick={() => void save()}>
          {busy ? t.common.saving : t.vvaker.pick}
        </Btn>
        {error && <p className="mt-2 text-sm text-down-fg">{t.common.error}</p>}
      </div>
    </div>
  );
}
