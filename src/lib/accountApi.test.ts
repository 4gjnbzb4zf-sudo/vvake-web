import { describe, expect, it } from "vitest";
import { getAccountDict } from "@/i18n/account";
import {
  coachTier,
  confirmed,
  connectNotice,
  DEFAULT_CALL_WINDOWS,
  DEFAULT_REMINDERS,
  fromHhmm,
  liveMinutes,
  meSchema,
  remindersOf,
  sortedMeals,
  SPOTIFY_ROUTE_SYNC,
  spotifyRouteOf,
  toHhmm,
  validWindows,
  withoutConnectParams,
  withoutPick,
  withPick,
  type Pulse,
} from "./accountApi";

describe("account page helpers", () => {
  it("reads the account leniently: odd fields are dropped, never an error", () => {
    const me = meSchema.parse({
      id: "u1",
      name: 3,
      plan: "plus",
      coach: { chattiness: "chatty", callWindows: "nope" },
      prefs: { lang: "fr", reminders: { bad: true } },
    });
    expect(me.name).toBeNull();
    expect(me.coach?.chattiness).toBe("chatty");
    expect(me.coach?.callWindows).toBeNull();
    expect(me.prefs?.lang).toBe("fr");
    expect(me.prefs?.reminders).toBeNull();
  });

  it("reminders: the account's, else the app's defaults, as a copy", () => {
    const d = remindersOf(null);
    expect(d).toEqual(DEFAULT_REMINDERS);
    d.meals.push(1);
    expect(DEFAULT_REMINDERS.meals).toHaveLength(3);
    const me = meSchema.parse({
      id: "u",
      prefs: {
        reminders: {
          rhythmOn: true,
          waterOn: true,
          mealsOn: false,
          sleepOn: true,
          wakeMinutes: 405,
          meals: [480],
          dailyMove: { remind: true, at: 840 },
        },
      },
    });
    expect(remindersOf(me)).toMatchObject({ rhythmOn: true, wakeMinutes: 405, dailyMove: { remind: true, at: 840 }, pulseAlerts: false });
  });

  it("times: HH:MM both ways, the app's past-midnight steps wrapped", () => {
    expect(toHhmm(450)).toBe("07:30");
    expect(toHhmm(-15)).toBe("23:45");
    expect(toHhmm(1440 + 60)).toBe("01:00");
    expect(fromHhmm("19:30")).toBe(1170);
    expect(fromHhmm("24:00")).toBeNull();
    expect(sortedMeals([1170, 480, 750])).toEqual([480, 750, 1170]);
  });

  it("call windows: up to two, 30 minutes or more, inside the day", () => {
    expect(validWindows(DEFAULT_CALL_WINDOWS)).toBe(true);
    expect(validWindows([[600, 620]])).toBe(false);
    expect(
      validWindows([
        [0, 60],
        [100, 200],
        [300, 400],
      ]),
    ).toBe(false);
    expect(validWindows([[1400, 1500]])).toBe(false);
  });

  it("OAuth notices from the redirect, and the URL cleaned of them", () => {
    expect(connectNotice("?google=ok")).toBe("googleOk");
    expect(connectNotice("?google=error")).toBe("googleError");
    expect(connectNotice("?spotify=plus")).toBe("spotifyPlus");
    expect(connectNotice("?spotify=ok")).toBe("spotifyOk");
    expect(connectNotice("?x=1")).toBeNull();
    expect(withoutConnectParams("https://vvake.com/en/account/?spotify=ok&a=1#coach")).toBe("https://vvake.com/en/account/?a=1#coach");
  });

  it("live coach minutes: what's left rounded down", () => {
    expect(liveMinutes({ limitS: 900, usedS: 100, remainingS: 800 })).toEqual({ left: 13, limit: 15, pack: 0 });
    expect(liveMinutes({ limitS: 900, usedS: 950 })).toEqual({ left: 0, limit: 15, pack: 0 });
    expect(liveMinutes({ limitS: 0 })).toBeNull();
    // ADR-0051: pack minutes after the week's, free accounts with a pack too.
    expect(liveMinutes({ limitS: 900, usedS: 180, remainingS: 1320, weekRemainingS: 720, packS: 600 })).toEqual({
      left: 12,
      limit: 15,
      pack: 10,
    });
    expect(liveMinutes({ limitS: 0, remainingS: 300, weekRemainingS: 0, packS: 300 })).toEqual({ left: 0, limit: 0, pack: 5 });
    expect(liveMinutes(null)).toBeNull();
  });

  it("My Pulse: removing the Brand Team's stock drops the team; adding checks ticker, duplicates, the cap", () => {
    const p: Pulse = {
      watchlist: [
        { symbol: "NKE", kind: "stock" },
        { symbol: "BTC", kind: "crypto" },
      ],
      brandTeam: "NKE",
    };
    expect(withoutPick(p, "NKE", "stock")).toEqual({ watchlist: [{ symbol: "BTC", kind: "crypto" }], brandTeam: null });
    expect(withoutPick(p, "BTC", "crypto").brandTeam).toBe("NKE");
    expect(withPick(p, " aapl ", "stock")?.at(-1)).toEqual({ symbol: "AAPL", kind: "stock" });
    expect(withPick(p, "nke", "stock")).toBeNull();
    expect(withPick(p, "not a ticker", "stock")).toBeNull();
    const full: Pulse = { watchlist: Array.from({ length: 8 }, (_, i) => ({ symbol: `S${i}`, kind: "stock" })) };
    expect(withPick(full, "NEW", "stock")).toBeNull();
  });

  it("Spotify route: read from the account's { route, at } (or a plain string), unknown ones ignored; the page writes it", () => {
    expect(spotifyRouteOf({ route: { route: "auto", at: 1 } })).toBe("auto");
    expect(spotifyRouteOf({ route: null })).toBeNull();
    expect(spotifyRouteOf({ route: "watch" })).toBe("watch");
    expect(spotifyRouteOf({ route: "moon" })).toBeNull();
    expect(spotifyRouteOf(null)).toBeNull();
    expect(SPOTIFY_ROUTE_SYNC).toBeTypeOf("function");
  });

  it("typed confirmations, and the fresh start list matches the app's (6 reset, 6 kept, both languages)", () => {
    expect(confirmed(" fresh ", "FRESH")).toBe(true);
    expect(confirmed("fres", "FRESH")).toBe(false);
    for (const l of ["en", "fr"] as const) {
      const d = getAccountDict(l).data;
      expect(d.resetItems).toHaveLength(6);
      expect(d.stayItems).toHaveLength(6);
    }
    expect(getAccountDict("en").data.resetItems[0]).toBe("Your schedule and plan");
    expect(getAccountDict("fr").data.resetItems[0]).toBe("Ton programme et ton plan");
  });
});

describe("coachTier", () => {
  it("reads premium, the legacy pro, plus and the plan fallback", () => {
    expect(coachTier({ plan: "plus", tier: "premium" })).toBe("premium");
    expect(coachTier({ plan: "plus", tier: "pro" })).toBe("premium");
    expect(coachTier({ plan: "plus", tier: "plus" })).toBe("plus");
    expect(coachTier({ plan: "plus" })).toBe("plus");
    expect(coachTier({ plan: "free", tier: "free" })).toBe("free");
    expect(coachTier({})).toBe("free");
    expect(coachTier({ plan: "plus", earlyTester: true })).toBe("premium");
  });

  it("/v1/me carries the tier and the early tester flag", () => {
    const me = meSchema.parse({ id: "u1", plan: "plus", tier: "premium", earlyTester: true });
    expect(me.earlyTester).toBe(true);
    expect(coachTier(me)).toBe("premium");
    expect(meSchema.parse({ id: "u2" }).earlyTester).toBeUndefined();
  });
});
