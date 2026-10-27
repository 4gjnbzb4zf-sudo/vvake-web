import { describe, expect, it } from "vitest";
import { defaultAnswers, profileFromPrefs, tailorFromAnswers, answersForPreset } from "./tailor";
import { ACCOUNT_SECTION_FEATURE, cleanOverrides, nextTailorPrefs, parseTailorPrefs, webTabs } from "./prefs";
import { ACCOUNT_SECTIONS } from "@/components/account/shared";

const AT = "2026-10-27T10:00:00.000Z";

describe("Your VVake prefs on the web", () => {
  it("reads the account's prefs.tailor and refuses anything else", () => {
    expect(parseTailorPrefs(undefined)).toBeNull();
    expect(parseTailorPrefs({ v: 2, tailorOn: true, answers: {}, at: AT })).toBeNull();
    expect(parseTailorPrefs({ v: 1, tailorOn: "yes", answers: {}, at: AT })).toBeNull();
    expect(parseTailorPrefs({ v: 1, tailorOn: true, answers: {}, at: "yesterday" })).toBeNull();
    const p = parseTailorPrefs({
      v: 1,
      tailorOn: true,
      answers: { goals: ["home", "bogus"] },
      overrides: { rewards: true, nope: 1 },
      at: AT,
    });
    expect(p).toMatchObject({ v: 1, tailorOn: true, source: "picked", at: AT, overrides: { rewards: true } });
    expect(p!.answers.goals).toEqual(["home"]);
  });

  it("is today's web while the switch is off", () => {
    const off = parseTailorPrefs({ v: 1, tailorOn: false, answers: defaultAnswers(), at: AT });
    expect(profileFromPrefs(off)).toBeNull();
    expect(profileFromPrefs({ ...off!, tailorOn: true })).not.toBeNull();
  });

  it("stamps a newer `at` than the one it replaces and keeps what it doesn't change", () => {
    const prev = parseTailorPrefs({
      v: 1,
      tailorOn: true,
      answers: defaultAnswers(),
      overrides: { rewards: true },
      source: "inferred",
      at: AT,
    })!;
    const next = nextTailorPrefs(prev, { tailorOn: false }, Date.parse(AT) - 5000);
    expect(Date.parse(next.at)).toBeGreaterThan(Date.parse(AT));
    expect(next).toMatchObject({ tailorOn: false, overrides: { rewards: true }, source: "inferred" });
    const picked = nextTailorPrefs(prev, { answers: { ...defaultAnswers(), goals: ["event"] }, overrides: {} });
    expect(picked.source).toBe("picked");
    expect(picked.overrides).toBeUndefined();
    expect(nextTailorPrefs(null, {}).tailorOn).toBe(false);
    expect(cleanOverrides({ plan: false, x: true })).toEqual({ plan: false });
  });

  it("maps the profile's tabs to the web's", () => {
    const home = tailorFromAnswers(answersForPreset("home_workouts"));
    expect(webTabs(home.tabs)).toEqual(["today", "trainings", "coach", "you"]);
    const all = tailorFromAnswers(answersForPreset("everything"));
    expect(webTabs(all.tabs)).toEqual(["today", "plan", "crew", "coach", "you"]);
  });

  it("gives every account section a feature or none", () => {
    expect(Object.keys(ACCOUNT_SECTION_FEATURE).sort()).toEqual([...ACCOUNT_SECTIONS].sort());
  });
});
