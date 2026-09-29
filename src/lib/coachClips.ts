/**
 * Recorded coach voice samples in /public/coach, named `<lang>-<gender>-<style>.mp3`
 * (e.g. en-female-hype.mp3). Clips play on every browser; when a clip is missing, the demo falls
 * back to the browser's own voice. List the files here once they're recorded (licensed voices only).
 */
export const COACH_CLIPS: ReadonlySet<string> = new Set<string>([]);

export const clipName = (lang: string, gender: string, style: string) => `${lang}-${gender}-${style}.mp3`;
