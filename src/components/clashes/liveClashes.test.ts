import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import type { Clash } from "@/lib/clashes";
import { ClashBoardView, HomeLiveClashesView, type FeedState } from "./LiveClashes";

// Test fixtures only: the site never shows a clash the API didn't send.
const T0 = Date.parse("2026-10-14T10:00:00Z");
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const live: Clash = {
  id: "c1",
  status: "live",
  a: { city: "Testville", score: 12.4, startsAt: iso(T0 - H), endsAt: iso(T0 + 11 * H) },
  b: { city: "Sampleton", score: 9.8, startsAt: iso(T0 - H), endsAt: iso(T0 + 11 * H) },
  startsAt: iso(T0 - H),
  endsAt: iso(T0 + 2 * H + 5_000),
  durationHours: 12,
};
const upcoming: Clash = { ...live, id: "c2", status: "buildup", startsAt: iso(T0 + 3 * H), endsAt: iso(T0 + 15 * H) };
const provisional: Clash = { ...live, id: "c3", status: "provisional" };

const esc = (s: string) => s.replace(/'/g, "&#x27;");
const en = getDictionary("en").clashes;
const fr = getDictionary("fr").clashes;
const board = (state: FeedState, lang: "en" | "fr" = "en") =>
  renderToStaticMarkup(createElement(ClashBoardView, { state, now: T0, dict: lang === "en" ? en : fr, lang }));
const home = (state: FeedState) =>
  renderToStaticMarkup(createElement(HomeLiveClashesView, { state, now: T0, dict: en, lang: "en", href: "/en/clashes/" }));

describe("clashes page", () => {
  it("shows the empty state when no clash is on", () => {
    const html = board({ kind: "ready", clashes: [] });
    expect(html).toContain("No city clash right now. Challenge another city from the app.");
    expect(html).not.toContain("<article");
  });
  it("shows a short line when the feed can't load", () => {
    expect(board({ kind: "error" })).toContain(esc(en.error));
    expect(board({ kind: "error" }, "fr")).toContain(esc(fr.error));
  });
  it("renders each clash with cities, scores, status, clock and an accessible bar", () => {
    const html = board({ kind: "ready", clashes: [live, provisional, upcoming] });
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain("Testville");
    expect(html).toContain("12.4");
    expect(html).toContain("9.8");
    expect(html).toContain("Live");
    expect(html).toContain("Results coming");
    expect(html).toContain("Starting soon");
    expect(html).toContain("02:00:05 left");
    expect(html).toContain("Starts in 03:00:00");
    expect(html).toContain("Results soon");
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-label="Testville 12.4 to Sampleton 9.8"');
    expect(html).toContain("width:55.9%");
  });
  it("speaks French on the French page", () => {
    const html = board({ kind: "ready", clashes: [live] }, "fr");
    expect(html).toContain("En direct");
    expect(html).toContain("12,4");
    expect(html).toContain("Encore 02:00:05");
  });
});

describe("home section", () => {
  it("renders nothing while loading, on error, or with no clash", () => {
    expect(home({ kind: "loading" })).toBe("");
    expect(home({ kind: "error" })).toBe("");
    expect(home({ kind: "ready", clashes: [] })).toBe("");
  });
  it("features up to four clashes and links to the page", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...live, id: `m${i}` }));
    const html = home({ kind: "ready", clashes: many });
    expect(html).toContain('id="live-clashes"');
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html).toContain('href="/en/clashes/"');
  });
});
