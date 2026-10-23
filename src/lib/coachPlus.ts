/**
 * Is VVake Coach Plus on for this account? (ADR-0051: VVake Coach Plus and Coach Premium; early testers get Premium.)
 * Plus is active while `plusUntil` is in the future; Premium and early testers are Plus too. An API that sends no
 * `plusUntil` falls back to the plan or tier ("plus", "premium", or "pro" before the rename). Pure (coachPlus.test.ts).
 */
export interface PlusFields {
  plan?: string | null;
  plusUntil?: string | null;
  tier?: string | null;
  earlyTester?: boolean | null;
}

const PAID = new Set(["plus", "premium", "pro"]);

export function coachPlusActive(me: PlusFields | null | undefined, now: number = Date.now()): boolean {
  if (!me) return false;
  if (me.earlyTester === true) return true;
  if (me.plusUntil) {
    const t = Date.parse(me.plusUntil);
    if (Number.isFinite(t)) return t > now;
  }
  return PAID.has(me.tier ?? "") || PAID.has(me.plan ?? "");
}
