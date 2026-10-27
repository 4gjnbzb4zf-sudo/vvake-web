import { describe, expect, it } from "vitest";
import golden from "../fixtures/tailor-golden.json";
import {
  inferAnswers,
  inferredOverrides,
  notificationAllowed,
  previewChanges,
  shouldSuggestReview,
  tailorCoachLine,
  tailorFromAnswers,
  todayNextAction,
  upsellAllowed,
  visibleSteps,
  type TailorAnswers,
  type TailorFeature,
  type TailorNotifyKind,
  type TailorOptions,
  type TailorProfile,
  type TailorUsage30,
} from "./tailor";

/**
 * The web tailors what the phone, the watches and the server tailor: the golden cases game-core writes for the ports
 * (VVFit packages/game-core/test/fixtures/tailor-golden.json, copied by scripts/sync-tailor-core.ts). The copy reads
 * GPS sports from this site's catalog export (tailorSports.ts), so these cases also check the two catalogs agree.
 */
type Case = { name: string; answers: TailorAnswers; opts?: TailorOptions; steps: string[]; profile: TailorProfile };
const profiles = golden.profiles as unknown as Case[];
const byName = (n: string) => {
  const c = profiles.find((p) => p.name === n);
  if (!c) throw new Error(`no golden profile ${n}`);
  return tailorFromAnswers(c.answers, c.opts);
};

describe("tailor parity with game-core", () => {
  it("gives the same profile and steps for every answer set", () => {
    expect(profiles.length).toBeGreaterThan(10);
    for (const c of profiles) {
      expect(tailorFromAnswers(c.answers, c.opts), c.name).toEqual(c.profile);
      expect(visibleSteps(c.answers), c.name).toEqual(c.steps);
    }
  });

  it("decides notifications the same way", () => {
    for (const n of golden.notify as {
      profile: string;
      kind: TailorNotifyKind;
      sentToday: number;
      localMinute?: number;
      decision: string;
    }[]) {
      const p = n.profile === "none" ? null : byName(n.profile);
      const got = notificationAllowed(p, n.kind, n.sentToday, n.localMinute !== undefined ? { localMinute: n.localMinute } : {});
      expect(got, `${n.profile} ${n.kind} ${n.sentToday} ${n.localMinute ?? "-"}`).toBe(n.decision);
    }
  });

  it("allows upsells, picks Today's action and previews changes the same way", () => {
    for (const u of golden.upsell as { profile: string; surface: TailorFeature | "you" | "core"; allowed: boolean }[])
      expect(upsellAllowed(byName(u.profile), u.surface), `${u.profile} ${u.surface}`).toBe(u.allowed);
    for (const a of golden.nextAction as { profile: string; day: { planned: boolean; restDay?: boolean }; action: string }[])
      expect(todayNextAction(byName(a.profile), a.day), `${a.profile} ${JSON.stringify(a.day)}`).toBe(a.action);
    for (const p of golden.preview)
      expect(previewChanges(byName(p.before), byName(p.after)), `${p.before} → ${p.after}`).toEqual(p.changes);
    expect(previewChanges(null, byName(golden.previewFromNone.after))).toEqual(golden.previewFromNone.changes);
  });

  it("infers answers, suggests reviews and writes the coach line the same way", () => {
    for (const c of golden.infer as unknown as {
      name: string;
      usage: TailorUsage30;
      answers: TailorAnswers;
      overrides: Record<string, boolean>;
      profile: TailorProfile;
    }[]) {
      expect(inferAnswers(c.usage), c.name).toEqual(c.answers);
      expect(inferredOverrides(c.usage), c.name).toEqual(c.overrides);
      expect(tailorFromAnswers(c.answers, { overrides: c.overrides, deskLinked: c.usage.desk.linked }), c.name).toEqual(c.profile);
    }
    const usages = new Map((golden.infer as unknown as { name: string; usage: TailorUsage30 }[]).map((x) => [x.name, x.usage]));
    for (const r of golden.review as unknown as {
      profile: string;
      usage: string;
      lastReviewAt: string | null;
      profileAt: string | null;
      review: unknown;
    }[])
      expect(
        shouldSuggestReview(byName(r.profile), usages.get(r.usage)!, r.lastReviewAt, golden.now, r.profileAt),
        `${r.profile} ${r.usage}`,
      ).toEqual(r.review);
    for (const l of golden.coachLine) expect(tailorCoachLine(byName(l.profile)), l.profile).toBe(l.line);
  });
});
