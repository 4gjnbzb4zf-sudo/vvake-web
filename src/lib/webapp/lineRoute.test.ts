import { describe, expect, it } from "vitest";
import { playFirst, recordedBudget, type LinePlayer, type VoiceSource } from "./lineRoute";
import { cloudThenDevice, type CloudEvents, type Timers } from "./speechQueue";

/** Timers moved by hand. */
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

/** A player that records what it played and lets the test say how each play goes. */
function fakePlayer(behaviour: (url: string) => "plays" | "fails" | "silent" = () => "plays") {
  const log: string[] = [];
  const player: LinePlayer = {
    play(urls, ev) {
      log.push(`play ${urls.join("+")}`);
      const b = behaviour(urls[0]!);
      if (b === "plays") queueMicrotask(() => ev.playing());
      if (b === "fails") queueMicrotask(() => ev.failed());
      return { stop: () => log.push(`stop ${urls.join("+")}`) };
    },
  };
  return { player, log };
}

const source = (name: VoiceSource["name"], urls: string[] | null, delayMs = 0, budgetMs?: number): VoiceSource => ({
  name,
  resolve: () => new Promise((r) => (delayMs ? setTimeout(() => r(urls), delayMs) : r(urls))),
  ...(budgetMs !== undefined ? { budgetMs } : {}),
});

function events() {
  const log: string[] = [];
  const ev: CloudEvents = { playing: () => log.push("playing"), ended: () => log.push("ended"), failed: () => log.push("failed") };
  return { ev, log };
}

describe("a line's voice: recording, then stitched, then the browser voice", () => {
  it("the recording plays when it has one; the stitched line is never played", async () => {
    const { player, log } = fakePlayer();
    const { ev, log: evs } = events();
    const heard: string[] = [];
    playFirst([source("recorded", ["rec"]), source("stitched", ["st"])], player, { onSource: (n) => heard.push(n) })!(ev);
    await flush();
    expect(log).toEqual(["play rec"]);
    expect(evs).toEqual(["playing"]);
    expect(heard).toEqual(["recorded"]);
  });

  it("no recording (offline, not registered, no quota): the stitched line plays", async () => {
    const { player, log } = fakePlayer();
    const { ev, log: evs } = events();
    playFirst([source("recorded", null), source("stitched", ["st"])], player)!(ev);
    await flush();
    expect(log).toEqual(["play st"]);
    expect(evs).toEqual(["playing"]);
  });

  it("a recording that fails before playing hands over to the stitched line", async () => {
    const { player, log } = fakePlayer((u) => (u === "rec" ? "fails" : "plays"));
    const { ev, log: evs } = events();
    playFirst([source("recorded", ["rec"]), source("stitched", ["st"])], player)!(ev);
    await flush();
    await flush();
    expect(log).toEqual(["play rec", "stop rec", "play st"]);
    expect(evs).toEqual(["playing"]);
  });

  it("a slow recording: the stitched line starts when its budget runs out, the late recording is never played", async () => {
    const { timers, advance } = fakeTimers();
    const { player, log } = fakePlayer();
    const { ev, log: evs } = events();
    let answer: (u: string[] | null) => void = () => undefined;
    const slow: VoiceSource = { name: "recorded", resolve: () => new Promise((r) => (answer = r)), budgetMs: recordedBudget(3000) };
    playFirst([slow, source("stitched", ["st"])], player, { timers })!(ev);
    advance(2399);
    await flush();
    expect(log).toEqual([]);
    advance(1);
    await flush();
    expect(log).toEqual(["play st"]);
    answer(["rec"]);
    await flush();
    expect(log).toEqual(["play st"]);
    expect(evs).toEqual(["playing"]);
  });

  it("neither: failed, so the browser voice says it (through cloudThenDevice)", async () => {
    const { player } = fakePlayer();
    const said: string[] = [];
    cloudThenDevice(
      {
        playCloud: playFirst([source("recorded", null), source("stitched", null)], player),
        speakDevice: (d) => {
          said.push("device");
          d();
          return { stop: () => undefined };
        },
        startMs: 3000,
      },
      () => said.push("done"),
    );
    await flush();
    expect(said).toEqual(["device", "done"]);
  });

  it("no source at all (the device voice mode): no cloud half", () => {
    expect(playFirst([], fakePlayer().player)).toBeNull();
  });

  it("stop (barge-in, hush) silences the source playing and nothing else starts", async () => {
    const { player, log } = fakePlayer((u) => (u === "rec" ? "silent" : "plays"));
    const { ev, log: evs } = events();
    const h = playFirst([source("recorded", ["rec"]), source("stitched", ["st"])], player)!(ev);
    await flush();
    h.stop();
    await flush();
    expect(log).toEqual(["play rec", "stop rec"]);
    expect(evs).toEqual([]);
  });

  it("a stitched line starts at once: the recording's budget leaves it time", () => {
    expect(recordedBudget(3000)).toBe(2400);
    expect(recordedBudget(2500)).toBe(1900);
    expect(recordedBudget(450)).toBe(300);
  });
});
