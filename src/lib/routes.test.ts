import { describe, expect, it } from "vitest";
import { sectionHref } from "./routes";

describe("sectionHref", () => {
  it("points each section at its page", () => {
    expect(sectionHref("en", "coach")).toBe("/en/tour/#coach");
    expect(sectionHref("fr", "crew")).toBe("/fr/tour/#crew");
    expect(sectionHref("en", "rwa")).toBe("/en/backers/#rwa");
  });
  it("keeps the waitlist on the current page", () => {
    expect(sectionHref("en", "unlock")).toBe("#unlock");
  });
});
