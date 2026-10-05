import { describe, expect, it } from "vitest";
import { claudeAppUrl, claudeRedirect, parseClaudeCode } from "./claudeLink";

describe("Claude Code links", () => {
  it("reads a code from a hash or a path, with or without the dash, case-insensitively", () => {
    expect(parseClaudeCode("#x7k2-9qpr")).toBe("X7K2-9QPR");
    expect(parseClaudeCode("#X7K29QPR")).toBe("X7K2-9QPR");
    expect(parseClaudeCode("/claude/X7K2-9QPR/")).toBe("X7K2-9QPR");
    expect(parseClaudeCode("")).toBeNull();
    expect(parseClaudeCode("#X7K2-9QPL")).toBeNull(); // L isn't in the alphabet
    expect(parseClaudeCode("#ABCD-EFGI")).toBeNull(); // nor I
    expect(parseClaudeCode("#X7K2-9QP")).toBeNull();
    expect(parseClaudeCode("#<script>")).toBeNull();
  });

  it("sends /claude/<code> to the localized fallback page, nothing else", () => {
    expect(claudeRedirect("/claude/x7k2-9qpr", "fr")).toBe("/fr/claude/#X7K2-9QPR");
    expect(claudeRedirect("/claude/X7K29QPR/", "en")).toBe("/en/claude/#X7K29QPR");
    expect(claudeRedirect("/c/ABCD2345", "en")).toBeNull();
    expect(claudeRedirect("/claude/", "en")).toBeNull();
  });

  it("builds the app's custom-scheme link", () => {
    expect(claudeAppUrl("vvake", "X7K2-9QPR")).toBe("vvake://claude/X7K2-9QPR");
  });
});
