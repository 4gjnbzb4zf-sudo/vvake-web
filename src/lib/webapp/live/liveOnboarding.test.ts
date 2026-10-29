import { describe, expect, it } from "vitest";
import { cleanAnswers, defaultAnswers } from "@/lib/webapp/tailor/tailor";
import { mergeCallAnswers, stepForField, webPermissionAnswer } from "./liveOnboarding";

describe("day-one call on the web fills the same cards", () => {
  it("applies the call's answer through the survey's own cleaning", () => {
    let a = defaultAnswers();
    a = mergeCallAnswers(a, { id: "goals", value: ["event"] });
    a = mergeCallAnswers(a, { id: "sports", value: ["run", "ride"] });
    expect(a.goals).toEqual(cleanAnswers({ ...a, goals: ["event"] }).goals);
    expect(a.sports).toEqual(["run", "ride"]);
    expect(a.sportMode).toBe("few");
  });
  it("ignores fields that aren't the survey's and invalid values", () => {
    const a = defaultAnswers();
    const b = mergeCallAnswers(a, { id: "wallet", value: "x" });
    expect(b).toEqual(cleanAnswers(a));
  });
  it("opens the card a field lives on", () => {
    expect(stepForField("eventDate")).toBe("eventDetails");
    expect(stepForField("style")).toBe("voice");
    expect(stepForField("goals")).toBe("goals");
    expect(stepForField("nope")).toBeNull();
  });
  it("answers Health as the phone app's", () => {
    expect(webPermissionAnswer("health")).toEqual({ status: "unavailable", where: "phone_app" });
    expect(webPermissionAnswer("location").status).toBe("unavailable");
  });
});
