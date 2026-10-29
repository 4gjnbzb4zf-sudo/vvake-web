import { describe, expect, it } from "vitest";
import { getTailorDict } from "@/i18n/tailor";
import { getWebAppDict } from "@/i18n/webapp";
import { quickSportsFor } from "../workout";
import { nextTailorPrefs, parseTailorPrefs } from "./prefs";
import { defaultAnswers, makeMainSport, profileFromPrefs, tapSport } from "./tailor";

// Build 56: the first sport tapped is the main one, on the web as on the apps, never re-sorted.
const picks = (keys: string[], o?: Parameters<typeof tapSport>[2]) => keys.reduce<string[]>((l, k) => tapSport(l, k, o), []);

describe("sports in tap order on the web", () => {
  it("keeps the tap order through the prefs sent to the account and read back", () => {
    const answers = { ...defaultAnswers(), sportMode: "few" as const, sports: picks(["yoga", "swim", "run"]) };
    const sent = nextTailorPrefs(null, { answers, tailorOn: true }, Date.parse("2026-10-29T10:00:00Z"));
    const back = parseTailorPrefs(JSON.parse(JSON.stringify(sent)));
    expect(back?.answers.sports).toEqual(["yoga", "swim", "run"]);
    expect(profileFromPrefs(back)?.sports[0]).toBe("yoga");
    expect(makeMainSport(back!.answers.sports, "run")).toEqual(["run", "yoga", "swim"]);
  });

  it("onboarding: the preselected Run never outranks the first tap", () => {
    expect(tapSport(["run"], "swim", { max: 3, preset: true })).toEqual(["swim", "run"]);
    expect(picks(["swim", "ride", "yoga", "hike"], { max: 3 })).toEqual(["swim", "yoga", "hike"]);
  });

  it("the workout picker shows your sports first, main first", () => {
    expect(quickSportsFor(["yoga", "swim", "quidditch"]).slice(0, 3)).toEqual(["yoga", "swim", "run"]);
    expect(quickSportsFor()).toEqual(["run", "walk", "ride", "hike", "strength", "yoga", "dance", "boxing"]);
  });

  it("names the Main badge in English and French", () => {
    for (const l of ["en", "fr"] as const) {
      expect(getTailorDict(l).survey.sportMain).toBeTruthy();
      expect(getTailorDict(l).survey.makeMain).toBeTruthy();
      expect(getWebAppDict(l).onboarding.moves.main).toBeTruthy();
    }
    expect(getTailorDict("fr").survey.sportMain).not.toBe(getTailorDict("en").survey.sportMain);
  });
});
