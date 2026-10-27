// Cut from VVFit packages/game-core/src/voiceCommands.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
const COMBINING = /[̀-ͯ]/g;

export function normalizeVoice(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
