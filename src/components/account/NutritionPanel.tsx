"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NutritionProfileForm } from "@/components/webapp/NutritionSettings";
import { Section } from "@/components/ui/Section";
import { getNutritionDict } from "@/i18n/nutrition";
import { cleanNutritionProfile, defaultNutritionProfile, newerNutritionProfile, type NutritionProfile } from "@/lib/webapp/nutrition/core";
import { nutritionApi } from "@/lib/webapp/nutrition/nutritionApi";
import { buttonClass } from "@/components/ui/Button";
import { sectionIndex, type PanelProps } from "./shared";

/**
 * Nutrition on vvake.com/account (ADR-0070, optional): the web app's Settings › Nutrition form (goal, how you eat,
 * allergies, intolerances, dislikes, cooking time, budget, meals, servings, the age question, Hide numbers, calm mode,
 * photo asks, country and region), saved with PUT /v1/nutrition/profile (newest `at` wins). Off: one line and a
 * button to turn it on; nothing else.
 */
export function NutritionSection(p: PanelProps) {
  const { session, lang, me } = p;
  const tn = getNutritionDict(lang);
  const api = useMemo(() => nutritionApi(session), [session]);
  const fromMe = useMemo(() => {
    const raw = me.prefs?.nutrition;
    return raw ? cleanNutritionProfile(raw) : null;
  }, [me.prefs]);
  const [profile, setProfile] = useState<NutritionProfile | null>(fromMe);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .profile()
      .then(
        (raw) =>
          live && setProfile((cur) => newerNutritionProfile(cur, raw ? cleanNutritionProfile(raw) : null) ?? defaultNutritionProfile()),
      )
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [api]);

  const save = useCallback(
    async (change: Partial<NutritionProfile>) => {
      const prev = profile ?? defaultNutritionProfile();
      const next = cleanNutritionProfile({ ...prev, ...change, at: Math.max(Date.now(), prev.at + 1) });
      setProfile(next);
      try {
        const back = await api.saveProfile(next);
        if (back) setProfile(cleanNutritionProfile(back));
        return true;
      } catch {
        return false;
      }
    },
    [api, profile],
  );

  return (
    <Section id="nutrition" index={sectionIndex("nutrition")} kicker={tn.kicker} title={tn.title} lead={tn.lead}>
      <div className="mt-8 max-w-3xl space-y-4">
        {!profile ? (
          <p className="text-muted">{failed ? tn.error : tn.loading}</p>
        ) : !profile.on ? (
          <>
            <p>{tn.off}</p>
            <p className="text-sm text-muted">{tn.settings.disclaimer}</p>
            <button type="button" className={buttonClass("primary")} onClick={() => void save({ on: true })}>
              {tn.turnOn}
            </button>
          </>
        ) : (
          <>
            <NutritionProfileForm profile={profile} save={save} tn={tn} lang={lang} />
            <button type="button" className={buttonClass("ghost")} onClick={() => void save({ on: false })}>
              {tn.settings.turnOff}
            </button>
          </>
        )}
      </div>
    </Section>
  );
}
