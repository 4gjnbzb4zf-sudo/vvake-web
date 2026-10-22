"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { onBrowserVoice, onVoicePack, voicePackState } from "@/lib/webapp/coachAudio";
import { takeVoiceTip, voicePlatform, type VoicePlatform } from "@/lib/webapp/voiceTip";
import { useApp } from "./AppContext";
import { Btn, Small } from "./ui";

const PLATFORMS: Exclude<VoicePlatform, "other">[] = ["ios", "mac", "windows", "android"];

function thisPlatform(): VoicePlatform {
  try {
    return voicePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  } catch {
    return "other";
  }
}

function tipStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The steps for this device first, then the others behind "Steps for every device". */
function Steps() {
  const { t } = useApp();
  const v = t.voiceTip;
  const [platform] = useState(thisPlatform);
  return (
    <>
      <p className="mt-2 text-sm">{v.steps[platform]}</p>
      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-sky-fg">{v.allDevices}</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {PLATFORMS.filter((p) => p !== platform).map((p) => (
            <li key={p}>{v.steps[p]}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

/**
 * The first time this browser's own voice says a coach line: "Get a better voice", once (voiceTip.ts), on any screen
 * (the workout screens too), until it's dismissed.
 */
export function VoiceTipToast() {
  const { t } = useApp();
  const v = t.voiceTip;
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      onBrowserVoice(() => {
        if (takeVoiceTip(tipStorage())) setOpen(true);
      }),
    [],
  );
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div role="status" aria-live="polite" className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-lg">
        <p className="font-display font-semibold">{v.title}</p>
        <Small className="mt-1">{v.lead}</Small>
        <Steps />
        <Small className="mt-2">{v.pack}</Small>
        <Btn variant="ghost" className="mt-3" onClick={() => setOpen(false)}>
          {v.dismiss}
        </Btn>
      </div>
    </div>
  );
}

/** You → Voice coach: the coach's voice pack in this browser and how to get a better device voice. */
export function BetterVoice() {
  const { t } = useApp();
  const v = t.voiceTip;
  const pack = useSyncExternalStore(onVoicePack, voicePackState, () => "off" as const);
  return (
    <div className="mt-4">
      <p className="mb-1 text-sm font-medium">{v.rowTitle}</p>
      {pack !== "off" && <Small>{pack === "ready" ? v.packReady : pack === "loading" ? v.packLoading : v.packPending}</Small>}
      <Small className="mt-1">{v.rowDetail}</Small>
      <Steps />
      <Small className="mt-1">{v.pack}</Small>
    </div>
  );
}
