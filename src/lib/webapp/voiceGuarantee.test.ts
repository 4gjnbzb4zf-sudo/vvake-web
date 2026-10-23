import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/rewardsApi";
import { playFirst, type LinePlayer, type VoiceSource } from "./lineRoute";
import { cloudThenDevice, type Timers } from "./speechQueue";
import {
  createSourceLog,
  currentReason,
  deviceAllowed,
  failureReason,
  FAILURE_TTL_MS,
  guaranteedMode,
  lineChunks,
  type KeyValueStore,
  type VoiceReason,
} from "./voiceGuarantee";
import { cameraLikelyLines, workoutLikelyLines } from "./voiceLikely";

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    set: (fn, ms) => {
      const id = ++seq;
      due.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (h) => void due.delete(h as number),
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...due.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      due.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  return { timers, advance };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const player: LinePlayer = {
  play(_urls, ev) {
    queueMicrotask(() => ev.playing());
    return { stop: () => undefined };
  },
};

/** A source whose audio comes when the test says. */
function slowSource(name: VoiceSource["name"] = "recorded") {
  let give: (u: string[] | null) => void = () => undefined;
  const src: VoiceSource = { name, resolve: () => new Promise((r) => (give = r)) };
  return { src, give: (u: string[] | null) => give(u) };
}

/** One line through the real route: the coach's sources, then (only if allowed) the browser voice. */
function line(o: { plus: boolean; reason: () => VoiceReason; sources: VoiceSource[]; startMs?: number; timers: Timers }) {
  const said: string[] = [];
  const cloud = playFirst(o.sources, player, { timers: o.timers, onSource: (n) => said.push(n) });
  cloudThenDevice(
    {
      playCloud: cloud,
      speakDevice: (done) => {
        said.push("device");
        done();
        return { stop: () => undefined };
      },
      startMs: o.startMs ?? 3000,
      timers: o.timers,
      onFallback: () => said.push(`fallback:${o.reason()}`),
      ...(o.plus ? { mayFallback: () => deviceAllowed(true, o.reason()), onSkip: () => said.push(`skipped:${o.reason()}`) } : {}),
    },
    () => said.push("done"),
  );
  return said;
}

describe("the coach-voice guarantee (Plus / Premium)", () => {
  it("Plus with audio available never routes to the browser voice, even when it is slow to come", async () => {
    const { timers, advance } = fakeTimers();
    const rec = slowSource();
    const said = line({ plus: true, reason: () => "no-audio", sources: [rec.src], timers });
    advance(10_000); // well past startMs: a free account would have fallen back
    expect(said).toEqual([]);
    rec.give(["audio"]);
    await flush();
    expect(said).toEqual(["recorded"]);
  });

  it("a free account still gets the browser voice when the recording is slow (unchanged)", async () => {
    const { timers, advance } = fakeTimers();
    const rec = slowSource();
    const said = line({ plus: false, reason: () => "slow", sources: [rec.src], timers });
    advance(3_000);
    expect(said).toContain("device");
  });

  it("Plus: the stitched line plays when the recording has none, never the browser", async () => {
    const { timers } = fakeTimers();
    const said = line({
      plus: true,
      reason: () => "no-audio",
      sources: [
        { name: "recorded", resolve: async () => null },
        { name: "stitched", resolve: async () => ["st"] },
      ],
      timers,
    });
    await flush();
    await flush();
    expect(said).toEqual(["stitched"]);
  });

  it("Plus: no coach audio and no offline/quota reason: the line is skipped, not said by the browser", async () => {
    const { timers } = fakeTimers();
    const said = line({ plus: true, reason: () => "no-audio", sources: [{ name: "recorded", resolve: async () => null }], timers });
    await flush();
    expect(said).toEqual(["skipped:no-audio", "done"]);
    expect(said).not.toContain("device");
  });

  it("Plus: the browser voice only with an offline, quota or server reason", async () => {
    for (const reason of ["offline", "quota", "server"] as const) {
      const { timers } = fakeTimers();
      const said = line({ plus: true, reason: () => reason, sources: [{ name: "recorded", resolve: async () => null }], timers });
      await flush();
      expect(said).toEqual([`fallback:${reason}`, "device", "done"]);
    }
    for (const reason of ["no-audio", "slow", "device", "unknown"] as const) expect(deviceAllowed(true, reason)).toBe(false);
    for (const reason of ["no-audio", "slow", "device", "unknown", "offline"] as const) expect(deviceAllowed(false, reason)).toBe(true);
  });

  it("Plus offline with a slow source: the browser voice may take it once its start time is up", async () => {
    const { timers, advance } = fakeTimers();
    const rec = slowSource();
    const said = line({ plus: true, reason: () => "offline", sources: [rec.src], timers });
    advance(3_000);
    expect(said).toEqual(["fallback:offline", "device", "done"]);
  });

  it("Plus ignores a device-voice choice; free keeps it", () => {
    expect(guaranteedMode(true, "device", true)).toBe("coach");
    expect(guaranteedMode(true, "device", false)).toBe("device");
    expect(guaranteedMode(false, "coach", true)).toBe("off");
    expect(guaranteedMode(true, undefined, false)).toBe("coach");
  });
});

describe("why the coach's voice couldn't say a line", () => {
  it("reads offline, quota and server failures", () => {
    expect(failureReason(new ApiError(429, "rate", ""), true)).toBe("quota");
    expect(failureReason(new ApiError(503, "x", ""), true)).toBe("server");
    expect(failureReason(new ApiError(0, "network", "network"), true)).toBe("offline");
    expect(failureReason(new TypeError("fetch"), true)).toBe("offline");
    expect(failureReason(new ApiError(400, "bad", ""), true)).toBe("unknown");
    expect(failureReason(new ApiError(429, "rate", ""), false)).toBe("offline");
  });
  it("a failure counts for a while, offline always wins", () => {
    const last = { reason: "quota" as const, at: 1000 };
    expect(currentReason(true, last, 1000 + FAILURE_TTL_MS - 1)).toBe("quota");
    expect(currentReason(true, last, 1000 + FAILURE_TTL_MS)).toBe("no-audio");
    expect(currentReason(false, last, 1000)).toBe("offline");
    expect(currentReason(true, null, 0)).toBe("no-audio");
  });
});

describe("long lines and likely lines", () => {
  it("cuts a reply at sentence ends into parts of at most 200 characters", () => {
    const s = "Great run today. ".repeat(30);
    const parts = lineChunks(s);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 200)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(s.trim().replace(/\s+/g, " "));
    expect(lineChunks("Short.")).toEqual(["Short."]);
    expect(lineChunks("x".repeat(450)).every((p) => p.length <= 200)).toBe(true);
  });
  it("a workout's and a camera session's likely lines", () => {
    const w = workoutLikelyLines("en");
    expect(w).toContain("5 minutes in. Nice work.");
    expect(w).toContain("10 minutes in, zone 2. Nice work.");
    expect(new Set(w).size).toBe(w.length);
    const cam = cameraLikelyLines(
      [
        { move: "squat", reps: 15, restS: 45 },
        { move: "squat", reps: 12 },
      ],
      "en",
    );
    expect(cam.map((c) => c.text)).toEqual(["Squat. 15 reps.", "Rest 45 seconds. Next: Squat.", "Squat. 12 reps."]);
    expect(cameraLikelyLines(null, "fr")).toEqual([]);
  });
});

describe("the source log", () => {
  it("counts lines by source, keeps the last ones, survives a reload, tells the last fallback", () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
    const log = createSourceLog(store, 5);
    log.note("recorded");
    log.note("synth");
    log.note("device", "offline");
    log.note("stitched");
    expect(log.counts()).toEqual({ recorded: 1, synth: 1, stitched: 1, device: 1, skipped: 0 });
    expect(log.lastFallback()?.reason).toBe("offline");
    const again = createSourceLog(store, 5);
    expect(again.counts().device).toBe(1);
    for (let i = 0; i < 6; i++) again.note("recorded");
    expect(again.entries().length).toBe(5);
    expect(createSourceLog({ getItem: () => "{bad", setItem: () => undefined }).counts().recorded).toBe(0);
  });
});
