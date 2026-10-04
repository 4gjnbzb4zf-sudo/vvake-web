/**
 * The home page's sample week: deliberately simple display logic, NOT the coach's plan engine
 * (VVFit packages/game-core plan.ts). Selected days × minutes; a lighter week is ~75% of the minutes,
 * rounded to 5 and never under 10.
 */
export function sessionMinutes(minutes: number, lighter: boolean): number {
  if (!lighter) return minutes;
  return Math.max(10, Math.round((minutes * 0.75) / 5) * 5);
}

export function sampleWeek(days: readonly boolean[], minutes: number, lighter: boolean) {
  const each = sessionMinutes(minutes, lighter);
  const sessions = days.filter(Boolean).length;
  return { each, sessions, total: sessions * each };
}
