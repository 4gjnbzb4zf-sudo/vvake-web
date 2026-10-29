import { describe, expect, it } from "vitest";
import { VVAKER_NAME_MAX, vvakerIssueText, vvakerRequestIssues } from "./vvakerCheck";

// The otter swimmer: the same literal as VVFit packages/game-core/test/vvakerRequest.test.ts (shared vectors).
const code = "VVP-gd0000-10-0";

const CASES: [string, { name?: string | null; code?: string | null }, ReturnType<typeof vvakerRequestIssues>][] = [
  ["valid", { name: "Nova", code }, null],
  ["name with spaces around", { name: "  Nova  ", code }, null],
  ["emoji name", { name: "Nova 🔥", code }, null],
  ["missing name", { name: "", code }, { field: "name", key: "nameMissing" }],
  ["blank name", { name: "   ", code }, { field: "name", key: "nameMissing" }],
  ["null name", { name: null, code }, { field: "name", key: "nameMissing" }],
  ["no name at all", { code }, { field: "name", key: "nameMissing" }],
  ["name too long", { name: "x".repeat(VVAKER_NAME_MAX + 1), code }, { field: "name", key: "nameTooLong" }],
  ["24 emoji fit", { name: "🔥".repeat(VVAKER_NAME_MAX), code }, null],
  ["line break in name", { name: "No\nva", code }, { field: "name", key: "nameInvalid" }],
  ["missing code", { name: "Nova", code: "" }, { field: "code", key: "codeMissing" }],
  ["bad code", { name: "Nova", code: "VVP-nope" }, { field: "code", key: "codeInvalid" }],
  ["lower-case code with spaces", { name: "Nova", code: ` ${code.toLowerCase()} ` }, null],
  ["name first when both are wrong", { name: "", code: "nope" }, { field: "name", key: "nameMissing" }],
];

describe("vvakerRequestIssues (mirror of game-core)", () => {
  it.each(CASES)("%s", (_, req, want) => {
    expect(vvakerRequestIssues(req)).toEqual(want);
  });

  it("checks the name only when given if it is not required", () => {
    expect(vvakerRequestIssues({ code }, { requireName: false })).toBeNull();
    expect(vvakerRequestIssues({ name: " ", code }, { requireName: false })).toEqual({ field: "name", key: "nameMissing" });
  });

  it("says why in English and in French (tu)", () => {
    expect(vvakerIssueText({ field: "name", key: "nameMissing" }, "en")).toBe("Give your VVaker a name");
    expect(vvakerIssueText("nameMissing", "fr")).toBe("Donne un nom à ton VVaker");
  });
});
