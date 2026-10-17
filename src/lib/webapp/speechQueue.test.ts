import { describe, expect, it } from "vitest";
import { cloudThenDevice, createConversationVoice, createSpeechQueue, type CloudEvents, type SpeechLine, type Timers } from "./speechQueue";

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

/** A line that logs what happens to it and ends when told. */
function line(log: string[], name: string, kind: SpeechLine["kind"], maxMs = 10_000) {
  let finish: (() => void) | null = null;
  const l: SpeechLine & { end(): void } = {
    kind,
    maxMs,
    start: (done) => {
      log.push(`start ${name}`);
      finish = done;
    },
    stop: () => log.push(`stop ${name}`),
    dropped: (why) => log.push(`drop ${name} ${why}`),
    end: () => finish?.(),
  };
  return l;
}

describe("one speech queue (the phone's rules)", () => {
  it("says one line at a time, conversation lines in order", () => {
    const { timers } = fakeTimers();
    const q = createSpeechQueue(timers);
    const log: string[] = [];
    const a = line(log, "a", "talk");
    const b = line(log, "b", "talk");
    expect(q.speak(a)).toBe("started");
    expect(q.speak(b)).toBe("queued");
    expect(log).toEqual(["start a"]);
    a.end();
    expect(log).toEqual(["start a", "start b"]);
  });

  it("the newest cue wins: one speaking is cut, one waiting is replaced", () => {
    const { timers } = fakeTimers();
    const q = createSpeechQueue(timers);
    const log: string[] = [];
    q.speak(line(log, "z2", "cue"));
    q.speak(line(log, "z3", "cue"));
    expect(log).toEqual(["start z2", "stop z2", "drop z2 replaced", "start z3"]);
  });

  it("a cue never cuts a conversation line: it waits behind it, and only the newest cue waits", () => {
    const { timers } = fakeTimers();
    const q = createSpeechQueue(timers);
    const log: string[] = [];
    const reply = line(log, "reply", "talk");
    q.speak(reply);
    q.speak(line(log, "km1", "cue"));
    q.speak(line(log, "km2", "cue"));
    expect(log).toEqual(["start reply", "drop km1 replaced"]);
    reply.end();
    expect(log).toEqual(["start reply", "drop km1 replaced", "start km2"]);
  });

  it("barge-in silences the line speaking and everything waiting", () => {
    const { timers } = fakeTimers();
    const q = createSpeechQueue(timers);
    const log: string[] = [];
    q.speak(line(log, "a", "talk"));
    q.speak(line(log, "b", "talk"));
    q.bargeIn();
    expect(log).toEqual(["start a", "stop a", "drop a barge", "drop b barge"]);
    expect(q.speaking).toBe(false);
    expect(q.waiting).toBe(0);
  });

  it("a line that never reports its end frees the queue after its guard", () => {
    const { timers, advance } = fakeTimers();
    const q = createSpeechQueue(timers);
    const log: string[] = [];
    q.speak(line(log, "stuck", "talk", 5000));
    q.speak(line(log, "next", "talk"));
    advance(5000);
    expect(log).toEqual(["start stuck", "stop stuck", "start next"]);
  });
});

/** A cloud player driven by the test. */
function cloud(log: string[]) {
  let ev: CloudEvents | null = null;
  return {
    play: (e: CloudEvents) => {
      ev = e;
      log.push("cloud fetch");
      return { stop: () => log.push("cloud stop") };
    },
    playing: () => ev!.playing(),
    ended: () => ev!.ended(),
    failed: () => ev!.failed(),
  };
}
const device = (log: string[], ends: { done?: () => void }) => (done: () => void) => {
  log.push("device speak");
  ends.done = done;
  return { stop: () => log.push("device stop") };
};

describe("cloudThenDevice: the coach's voice or the browser's, never both", () => {
  it("plays the recording when it starts in time", () => {
    const { timers, advance } = fakeTimers();
    const log: string[] = [];
    const c = cloud(log);
    let done = 0;
    cloudThenDevice({ playCloud: c.play, speakDevice: device(log, {}), startMs: 2500, timers }, () => done++);
    advance(1000);
    c.playing();
    advance(5000);
    c.ended();
    expect(log).toEqual(["cloud fetch"]);
    expect(done).toBe(1);
  });

  it("late: the browser voice takes the line, and the late recording is stopped the moment it plays", () => {
    const { timers, advance } = fakeTimers();
    const log: string[] = [];
    const c = cloud(log);
    const ends: { done?: () => void } = {};
    let done = 0;
    let fellBack = 0;
    cloudThenDevice(
      { playCloud: c.play, speakDevice: device(log, ends), startMs: 2500, timers, onFallback: () => fellBack++ },
      () => done++,
    );
    advance(2500);
    expect(log).toEqual(["cloud fetch", "cloud stop", "device speak"]);
    c.playing();
    expect(log).toEqual(["cloud fetch", "cloud stop", "device speak", "cloud stop"]);
    c.ended();
    expect(done).toBe(0);
    ends.done!();
    expect(done).toBe(1);
    expect(fellBack).toBe(1);
  });

  it("a recording that fails before starting (offline, no audio) falls back at once", () => {
    const { timers } = fakeTimers();
    const log: string[] = [];
    const c = cloud(log);
    cloudThenDevice({ playCloud: c.play, speakDevice: device(log, {}), startMs: 2500, timers }, () => undefined);
    c.failed();
    expect(log).toEqual(["cloud fetch", "cloud stop", "device speak"]);
  });

  it("a recording that fails after it started ends the line (no second voice repeating it)", () => {
    const { timers } = fakeTimers();
    const log: string[] = [];
    const c = cloud(log);
    let done = 0;
    cloudThenDevice({ playCloud: c.play, speakDevice: device(log, {}), startMs: 2500, timers }, () => done++);
    c.playing();
    c.failed();
    expect(log).toEqual(["cloud fetch"]);
    expect(done).toBe(1);
  });

  it("no recording: straight to the browser voice", () => {
    const log: string[] = [];
    cloudThenDevice({ playCloud: null, speakDevice: device(log, {}), startMs: 2500 }, () => undefined);
    expect(log).toEqual(["device speak"]);
  });

  it("stop silences whichever voice has it", () => {
    const { timers, advance } = fakeTimers();
    const log: string[] = [];
    const c = cloud(log);
    const h = cloudThenDevice({ playCloud: c.play, speakDevice: device(log, {}), startMs: 2500, timers }, () => undefined);
    advance(3000);
    h.stop();
    expect(log).toEqual(["cloud fetch", "cloud stop", "device speak", "cloud stop", "device stop"]);
  });
});

describe("one voice through a coach conversation", () => {
  it("keeps the coach's voice until a reply can't come, then the browser's for the rest", () => {
    const v = createConversationVoice();
    v.begin(true);
    expect(v.cloud).toBe(true);
    v.fellBack();
    v.begin(true);
    expect(v.cloud).toBe(false);
    v.end();
    v.begin(true);
    expect(v.cloud).toBe(true);
  });
  it("never plays audio in another voice than the conversation's first", () => {
    const v = createConversationVoice();
    v.begin(true);
    expect(v.accepts("aaa")).toBe(true);
    expect(v.accepts("aaa")).toBe(true);
    expect(v.accepts("bbb")).toBe(false);
    expect(v.accepts(undefined)).toBe(true);
  });
  it("the account's device voice: never the cloud", () => {
    const v = createConversationVoice();
    v.begin(false);
    expect(v.cloud).toBe(false);
  });
});
