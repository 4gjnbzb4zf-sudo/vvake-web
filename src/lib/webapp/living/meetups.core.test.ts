// Copied from VVFit packages/game-core/test/meetups.test.ts (3e812ccd 2026-10-30) by scripts/sync-living-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import {
  canInvite,
  checkMeetup,
  dueMeetupReminder,
  hereAllowed,
  isMeetupPointSet,
  joinDecision,
  meetupIcs,
  meetupPhase,
  meetupProblemText,
  meetupPushText,
  meetupReminders,
  MEETUP_POINT_SETS,
  MEETUP_REPORT_REASONS,
  MEETUP_REPORT_REASON_TEXT,
  MEETUP_TEXT,
  placeSetsFor,
  type MeetupProblem,
} from "./index";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-10-28T12:00:00Z");

describe("checkMeetup", () => {
  const ok = {
    sport: "run",
    startMs: NOW + DAY,
    durationMin: 60,
    pointKey: "n123",
    level: " easy  pace ",
    maxPeople: 6,
    invitees: ["b", "c", "b"],
  };
  const p = (x: Partial<typeof ok>) => {
    const r = checkMeetup({ ...ok, ...x }, NOW);
    return r.ok ? null : r.problem;
  };

  it("accepts a meetup, cleans the level, dedupes invitees, keys the point", () => {
    expect(checkMeetup(ok, NOW)).toEqual({ ok: true, pointKey: "osm:node/123", mode: "place", level: "easy pace", invitees: ["b", "c"] });
    expect(checkMeetup({ ...ok, level: "", pointKey: "gh:f25dvkh" }, NOW)).toMatchObject({ ok: true, level: null, pointKey: "gh:f25dvkh" });
  });

  it("future (≥ 15 min), ≤ 30 days, sane duration and size, someone invited, a public point key", () => {
    expect(p({ startMs: NOW + 10 * MIN })).toBe("start_past");
    expect(p({ startMs: NOW - HOUR })).toBe("start_past");
    expect(p({ startMs: NOW + 31 * DAY })).toBe("start_far");
    expect(p({ startMs: NOW + 30 * DAY })).toBeNull();
    expect(p({ durationMin: 10 })).toBe("duration");
    expect(p({ durationMin: 601 })).toBe("duration");
    expect(p({ maxPeople: 1 })).toBe("people");
    expect(p({ maxPeople: 21 })).toBe("people");
    expect(p({ invitees: [] })).toBe("invitees");
    expect(p({ invitees: Array.from({ length: 20 }, (_, i) => `u${i}`) })).toBe("invitees");
    // Never free coordinates.
    expect(p({ pointKey: "45.5,-73.6" })).toBe("point");
    expect(p({ sport: "RUN" })).toBe("sport");
    expect(p({ level: "x".repeat(61) })).toBe("level_long");
    expect(p({ level: "text me 0612345678" })).toBe("contact");
  });

  it("every problem has EN and FR words", () => {
    const all: MeetupProblem[] = [
      "sport",
      "start_past",
      "start_far",
      "duration",
      "people",
      "invitees",
      "point",
      "level_long",
      "empty",
      "link",
      "contact",
      "markup",
      "money",
      "abuse",
    ];
    for (const pr of all) for (const l of ["en", "fr"] as const) expect(meetupProblemText(pr, l).length).toBeGreaterThan(3);
    for (const r of MEETUP_REPORT_REASONS) expect(MEETUP_REPORT_REASON_TEXT[r].fr).toBeTruthy();
    for (const v of Object.values(MEETUP_TEXT)) expect(v.en && v.fr).toBeTruthy();
  });
});

describe("meeting points", () => {
  it("public kinds only: car parks, trailheads, parks, tracks, sports centres; no gyms, studios, routes", () => {
    const ids = MEETUP_POINT_SETS.map((s) => s.id);
    for (const id of ["parkings", "trailheads", "parks", "tracks", "sports_centres", "pitch.tennis"]) expect(ids, id).toContain(id);
    for (const id of ["gyms", "studios", "dance_studios", "hiking_routes", "cycleways"]) expect(ids, id).not.toContain(id);
    expect(isMeetupPointSet("parkings")).toBe(true);
    expect(isMeetupPointSet("gyms")).toBe(false);
    expect(placeSetsFor("meet").map((s) => s.id)).toEqual(["parkings", "trailheads", "parks", "sports_centres"]);
  });
});

describe("who and when", () => {
  it("invite friends/crew/rivals only, never yourself or someone blocked", () => {
    const friends = new Set(["b", "c"]);
    const blocked = new Set(["c"]);
    expect(canInvite("a", "b", friends, blocked)).toBe(true);
    expect(canInvite("a", "c", friends, blocked)).toBe(false);
    expect(canInvite("a", "z", friends, blocked)).toBe(false);
    expect(canInvite("a", "a", new Set(["a"]), blocked)).toBe(false);
  });

  it("join: invited, room left, not over, not blocked with the host", () => {
    const base = { phase: "planned" as const, invited: true, joined: false, going: 2, maxPeople: 3, blockedWithHost: false };
    expect(joinDecision(base)).toBe("ok");
    expect(joinDecision({ ...base, invited: false })).toBe("not_invited");
    expect(joinDecision({ ...base, going: 3 })).toBe("full");
    expect(joinDecision({ ...base, going: 3, joined: true })).toBe("ok");
    expect(joinDecision({ ...base, phase: "cancelled" })).toBe("closed");
    expect(joinDecision({ ...base, phase: "done" })).toBe("closed");
    expect(joinDecision({ ...base, blockedWithHost: true })).toBe("blocked");
  });

  it('phase from the clock; "I\'m here" from 30 min before to the end, for people in', () => {
    const m = { status: "planned" as const, startMs: NOW, durationMin: 60 };
    expect(meetupPhase(m, NOW - 3 * HOUR)).toBe("planned");
    expect(meetupPhase(m, NOW - HOUR)).toBe("soon");
    expect(meetupPhase(m, NOW + MIN)).toBe("now");
    expect(meetupPhase(m, NOW + HOUR)).toBe("done");
    expect(meetupPhase({ ...m, status: "cancelled" }, NOW - DAY)).toBe("cancelled");
    expect(hereAllowed(m, true, NOW - 31 * MIN)).toBe(false);
    expect(hereAllowed(m, true, NOW - 30 * MIN)).toBe(true);
    expect(hereAllowed(m, true, NOW + 59 * MIN)).toBe(true);
    expect(hereAllowed(m, true, NOW + 60 * MIN)).toBe(false);
    expect(hereAllowed(m, false, NOW)).toBe(false);
    expect(hereAllowed({ ...m, status: "cancelled" }, true, NOW)).toBe(false);
  });
});

describe("reminders", () => {
  it("2 h and 15 min before in the day", () => {
    const start = Date.parse("2026-10-31T16:00:00Z");
    expect(meetupReminders(start, 0, NOW)).toEqual([
      { kind: "two_hours", atMs: start - 2 * HOUR },
      { kind: "fifteen_min", atMs: start - 15 * MIN },
    ]);
  });

  it("an early meetup: the 2-hour one moves to 20:00 the evening before (quiet hours, local time)", () => {
    // 07:30 in Montréal (UTC−4) = 11:30Z; 2 h before is 05:30 local, in quiet hours.
    const start = Date.parse("2026-10-31T11:30:00Z");
    const r = meetupReminders(start, -240, NOW);
    expect(r.map((x) => x.kind)).toEqual(["evening_before", "fifteen_min"]);
    expect(new Date(r[0]!.atMs).toISOString()).toBe("2026-10-31T00:00:00.000Z"); // 20:00 local on the 30th
  });

  it("a meetup at 23:30 keeps its 15-minute reminder (the athlete chose that time)", () => {
    const start = Date.parse("2026-10-31T23:30:00Z");
    expect(meetupReminders(start, 0, NOW).map((x) => x.kind)).toEqual(["two_hours", "fifteen_min"]);
    // A 22:10 start: the 15-min reminder at 21:55 is not quiet; at 07:10 the 15-min one (06:55) is quiet but the start isn't.
    const morning = Date.parse("2026-10-31T07:10:00Z");
    expect(meetupReminders(morning, 0, NOW).map((x) => x.kind)).toEqual(["evening_before"]);
  });

  it("only reminders after joining, only the latest due, never after the start", () => {
    const start = NOW + 3 * HOUR;
    expect(meetupReminders(start, 0, NOW + 90 * MIN).map((x) => x.kind)).toEqual(["fifteen_min"]);
    expect(dueMeetupReminder(start, 0, NOW, [], NOW + HOUR + MIN)?.kind).toBe("two_hours");
    expect(dueMeetupReminder(start, 0, NOW, ["two_hours"], NOW + HOUR + MIN)).toBeNull();
    // Cron was down between the two: only the 15-minute one goes.
    expect(dueMeetupReminder(start, 0, NOW, [], start - 10 * MIN)?.kind).toBe("fifteen_min");
    expect(dueMeetupReminder(start, 0, NOW, ["fifteen_min"], start - 5 * MIN)).toBeNull();
    expect(dueMeetupReminder(start, 0, NOW, [], start + MIN)).toBeNull();
  });
});

describe("copy", () => {
  it("pushes in EN and FR with the host, sport, time and place", () => {
    const v = { host: "Ana", sport: "run", when: "Sat 9:00", place: "Parc Laurier" };
    expect(meetupPushText("invite", v, "en")).toEqual({ title: "Ana invites you: run", body: "Sat 9:00 · Parc Laurier. Are you in?" });
    expect(meetupPushText("invite", { ...v, when: "sam. 9 h" }, "fr").title).toBe("Ana t’invite : course");
    for (const k of ["two_hours", "evening_before", "fifteen_min", "cancelled", "changed"] as const)
      for (const l of ["en", "fr"] as const) {
        const t = meetupPushText(k, v, l);
        expect(t.title.length && t.body.length).toBeTruthy();
      }
  });
});

describe("meetupIcs (RFC 5545)", () => {
  const ics = meetupIcs({
    id: "m1",
    sport: "run",
    startMs: Date.parse("2026-10-31T13:00:00Z"),
    durationMin: 75,
    status: "planned",
    place: "Parc Laurier, entrée nord; côté rue",
    lat: 45.5321234,
    lon: -73.5811,
    level: "Easy, 6:00/km",
    nowMs: NOW,
    lang: "en",
  });

  it("one event, UTC times, CRLF, escaped text, geo, an alarm", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:meetup-m1@vvake.com\r\n");
    expect(ics).toContain("DTSTART:20261031T130000Z\r\n");
    expect(ics).toContain("DTEND:20261031T141500Z\r\n");
    expect(ics).toContain("DTSTAMP:20261028T120000Z\r\n");
    expect(ics).toContain("LOCATION:Parc Laurier\\, entrée nord\\; côté rue\r\n");
    expect(ics).toContain("GEO:45.53212;-73.58110\r\n");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("SUMMARY:Run · VVake meetup");
    // No bare LF, no line over 75 octets.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("nothing personal: no attendee, organizer, e-mail", () => {
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|mailto|@(?!vvake\.com)/);
  });

  it("cancelled and French", () => {
    const fr = meetupIcs({
      id: "m2",
      sport: "hike",
      startMs: NOW + DAY,
      durationMin: 120,
      status: "cancelled",
      place: "Départ de sentier",
      nowMs: NOW,
      lang: "fr",
      sequence: 2,
    });
    expect(fr).toContain("STATUS:CANCELLED");
    expect(fr).toContain("SEQUENCE:2");
    expect(fr).toContain("SUMMARY:Randonnée · rendez-vous VVake");
    expect(fr).not.toContain("GEO:");
  });
});
