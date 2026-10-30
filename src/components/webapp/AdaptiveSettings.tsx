"use client";

import { useState } from "react";
import { getAdaptiveDict } from "@/i18n/adaptive";
import { RPE_CHECK_MODES, SESSION_TIMINGS, type RpeCheckMode, type SessionTiming } from "@/lib/webapp/adaptive/adaptiveSession";
import { adaptiveOn, nextAdaptivePrefs, parseAdaptivePrefs } from "@/lib/webapp/adaptive/progressApi";
import { useApp } from "./AppContext";
import { H2, Segmented, Small } from "./ui";

/**
 * Planned sessions (ADR-0069): Session timing Adaptive / Fixed and Effort checks Auto / On / Off, the account's
 * `prefs.adaptive` (newest `at` wins on every device). Shown once the API has adaptive coaching.
 */
export function AdaptiveSettings({ className }: { className?: string }) {
  const { lang, me, setMe, api } = useApp();
  const [msg, setMsg] = useState<{ ok: boolean } | null>(null);
  if (!adaptiveOn(me)) return null;
  const x = getAdaptiveDict(lang).settings;
  const cur = parseAdaptivePrefs(me.prefs?.adaptive);
  const save = async (patch: { timing?: SessionTiming; rpeChecks?: RpeCheckMode }) => {
    const adaptive = nextAdaptivePrefs(me.prefs?.adaptive, patch);
    const before = me;
    setMe({ ...me, prefs: { ...me.prefs, adaptive } });
    try {
      setMe(await api.patchMe({ prefs: { adaptive } }));
      setMsg({ ok: true });
    } catch {
      setMe(before);
      setMsg({ ok: false });
    }
  };
  return (
    <div className={className}>
      <H2>{x.title}</H2>
      <p className="mt-3 mb-1 text-sm font-medium">{x.timing}</p>
      <Segmented
        label={x.timing}
        value={cur?.timing ?? "adaptive"}
        options={SESSION_TIMINGS.map((k) => ({ value: k, label: x.timings[k] }))}
        onChange={(timing) => void save({ timing })}
      />
      <Small className="mt-1">{x.timingLead}</Small>
      <p className="mt-4 mb-1 text-sm font-medium">{x.rpe}</p>
      <Segmented
        label={x.rpe}
        value={cur?.rpeChecks ?? "auto"}
        options={RPE_CHECK_MODES.map((k) => ({ value: k, label: x.rpeModes[k] }))}
        onChange={(rpeChecks) => void save({ rpeChecks })}
      />
      <Small className="mt-1">{x.rpeLead}</Small>
      {msg && (
        <p role="status" className={msg.ok ? "mt-1 text-xs text-mint-fg" : "mt-1 text-xs text-down-fg"}>
          {msg.ok ? x.saved : x.error}
        </p>
      )}
    </div>
  );
}
