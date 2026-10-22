/**
 * "Get a better voice" (pure: voiceTip.test.ts): the first time this browser's own voice says a coach line, a tip
 * once (kept in localStorage; a browser that can't keep it shows it once per visit), with the steps for this device
 * to install a better system voice (a web page can't open the system settings).
 */

export const TIP_KEY = "vvake-voice-tip-v1";

type TipStorage = Pick<Storage, "getItem" | "setItem">;

let shownThisVisit = false;

/** True the first time only: the tip is due now (and is marked shown). */
export function takeVoiceTip(storage: TipStorage | null): boolean {
  if (shownThisVisit) return false;
  shownThisVisit = true;
  try {
    if (!storage) return true;
    if (storage.getItem(TIP_KEY)) return false;
    storage.setItem(TIP_KEY, "1");
    return true;
  } catch {
    // storage blocked (private mode, settings): once per visit
    return true;
  }
}

/** Tests only. */
export function resetVoiceTipForTests() {
  shownThisVisit = false;
}

export type VoicePlatform = "ios" | "mac" | "windows" | "android" | "other";

/** The device whose voice settings the tip points to (iPadOS says "Macintosh" but has touch). */
export function voicePlatform(ua: string, maxTouchPoints = 0): VoicePlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return maxTouchPoints > 1 ? "ios" : "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}
