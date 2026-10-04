import { describe, expect, it } from "vitest";
import { sectionHref } from "./routes";

describe("sectionHref", () => {
  it("points each section at its page", () => {
    expect(sectionHref("en", "coach")).toBe("/en/app/#coach");
    expect(sectionHref("fr", "crew")).toBe("/fr/app/#crew");
    expect(sectionHref("en", "rwa")).toBe("/en/backers/#rwa");
  });
  it("keeps the waitlist on the current page", () => {
    expect(sectionHref("en", "unlock")).toBe("#unlock");
  });
});
