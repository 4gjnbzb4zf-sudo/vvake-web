"use client";

import { useEffect, useState } from "react";
import { COACH_VOICE_GENDERS, previewPath, type CoachVoiceGender, type CoachVoices } from "@/lib/coachVoices";
import { previewVoiceOf, unlockAudio } from "@/lib/webapp/coachAudio";
import { useApp } from "./AppContext";
import { Btn, Segmented, Small } from "./ui";

/**
 * Coach voice: Woman / Man (ADR-0056), each with "Hear it" (its recorded preview line from GET /v1/voice/voices,
 * through the app's one speech queue; the browser voice of that gender when the recording can't play). The You tab
 * and onboarding use it; saving is the caller's.
 */
export function CoachVoicePicker({ value, onChange }: { value: CoachVoiceGender; onChange: (v: CoachVoiceGender) => void }) {
  const { t, api, lang } = useApp();
  const [list, setList] = useState<CoachVoices | null>(null);
  const [hearing, setHearing] = useState<{ gender: CoachVoiceGender; by: "coach" | "device" } | null>(null);

  useEffect(() => {
    let live = true;
    api
      .coachVoices(lang)
      .then((l) => live && setList(l))
      .catch(() => live && setList(null));
    return () => {
      live = false;
    };
  }, [api, lang]);

  const hear = (g: CoachVoiceGender) => {
    // The tap unlocks the page's audio (Safari), then the line plays through the one queue.
    unlockAudio();
    setHearing(null);
    const v = list?.voices.find((x) => x.gender === g);
    previewVoiceOf(g, previewPath(list, g), (by) => setHearing({ gender: g, by }), v?.preview?.text);
  };

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{t.you.coachVoice}</p>
      <Segmented
        label={t.you.coachVoice}
        value={value}
        options={COACH_VOICE_GENDERS.map((g) => ({ value: g, label: t.you.coachVoices[g] }))}
        onChange={onChange}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {COACH_VOICE_GENDERS.map((g) => (
          <Btn key={g} variant="ghost" className="h-11" onClick={() => hear(g)} aria-label={`${t.you.hearIt}: ${t.you.coachVoices[g]}`}>
            ▶ {t.you.hearIt} · {t.you.coachVoices[g]}
          </Btn>
        ))}
      </div>
      <Small className="mt-1">
        {hearing?.by === "coach" ? t.you.hearingCoach : hearing?.by === "device" ? t.you.hearingDevice : t.you.coachVoiceDetail}
      </Small>
    </div>
  );
}
