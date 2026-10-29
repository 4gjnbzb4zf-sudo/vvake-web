import { describe, expect, it, vi } from "vitest";
import {
  fallbackFor,
  LiveCallClient,
  liveCallAllowed,
  onboardingCallOffered,
  ticketFallback,
  type LiveClientDeps,
  type LivePlayer,
  type LiveSocketEvents,
  type LiveStt,
  type LiveSttEvents,
} from "./liveCallClient";
import type { LiveServerMsg } from "./liveCallProtocol";

/** A fake server on the other end of the socket, a fake recogniser, a fake player and manual timers. */
function rig(o: Partial<LiveClientDeps> & { sttOk?: boolean; ticketOff?: string; ticketThrows?: { status?: number } } = {}) {
  const sent: Record<string, unknown>[] = [];
  let sockEv: LiveSocketEvents | null = null;
  let sttEv: LiveSttEvents | null = null;
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let tid = 0;
  const stt = { started: 0, resets: 0, paused: 0, resumed: 0, stopped: 0 };
  const sttImpl: LiveStt = {
    start: async (ev) => {
      stt.started++;
      sttEv = ev;
      return o.sttOk ?? true;
    },
    reset: () => void stt.resets++,
    pause: () => void stt.paused++,
    resume: () => void stt.resumed++,
    stop: () => void stt.stopped++,
  };
  const play = {
    chunks: [] as string[],
    said: [] as string[],
    lines: [] as string[],
    stops: [] as (number | null)[],
    busy: false,
    heard: 1200,
  };
  let idle: (() => void) | null = null;
  const player: LivePlayer = {
    push: (turn, seq, _f, data) => {
      play.chunks.push(`${turn}:${seq}:${data}`);
      play.busy = true;
    },
    line: (_t, text) => {
      play.lines.push(text);
      play.busy = true;
    },
    say: (_t, text) => void play.said.push(text),
    stop: (turn) => {
      play.stops.push(turn);
      play.busy = false;
      return play.heard;
    },
    busy: () => play.busy,
    onIdle: (cb) => void (idle = cb),
  };
  const states: string[] = [];
  const tools: { name: string; args: Record<string, unknown> }[] = [];
  const deps: LiveClientDeps = {
    mode: "call",
    hello: { lang: "en", stt: "device", audioFormat: "mp3" },
    online: () => true,
    ticket: async () => {
      if (o.ticketThrows) throw o.ticketThrows;
      return o.ticketOff ? { off: o.ticketOff } : { ticket: "t1", url: "wss://x/ws?ticket=t1" };
    },
    socketUrl: (t) => t.url!,
    openSocket: (_url, ev) => {
      sockEv = ev;
      return { send: (d) => void sent.push(JSON.parse(d) as Record<string, unknown>), close: () => undefined };
    },
    stt: sttImpl,
    player,
    onTool: async (name, args) => {
      tools.push({ name, args });
      return name === "show_permission" ? { status: "granted", health: { stepsPerDay: [7000, 8000] } } : undefined;
    },
    onState: (s) => states.push(s.phase),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms, id: ++tid });
      return tid;
    },
    clearTimer: (h) => {
      const i = timers.findIndex((x) => x.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
    ...o,
  };
  let now = 1000;
  const client = new LiveCallClient(deps, () => now);
  const server = async (m: LiveServerMsg) => {
    sockEv!.message(JSON.stringify(m));
    await new Promise((r) => setTimeout(r, 0));
  };
  return {
    client,
    sent,
    stt,
    play,
    tools,
    states,
    server,
    open: () => sockEv!.open(),
    drop: () => sockEv!.close(),
    stt_: () => sttEv!,
    idle: () => idle?.(),
    fire: (ms?: number) => {
      const due = timers.filter((x) => ms === undefined || x.ms === ms);
      for (const x of due) {
        timers.splice(timers.indexOf(x), 1);
        x.fn();
      }
    },
    tick: (ms: number) => void (now += ms),
  };
}

const live = async (r: ReturnType<typeof rig>) => {
  await r.client.start();
  r.open();
  await r.server({ type: "ready", callId: "c1", mode: "call", voice: "en-woman", leftS: 300 });
};

describe("live call client (fake server)", () => {
  it("opens with a ticket, says hello, starts listening on ready", async () => {
    const r = rig();
    await live(r);
    expect(r.sent[0]).toMatchObject({ type: "hello", mode: "call", lang: "en", stt: "device" });
    expect(r.stt.started).toBe(1);
    expect(r.client.state.phase).toBe("listening");
    expect(r.client.state.meter).toEqual({ usedS: 0, leftS: 300, warn: false });
  });

  it("plays the coach's audio, shows its words, and listens again when the turn is played", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "caption", turn: 1, text: "Hi! How was the run?", say: "cloud" });
    await r.server({ type: "audio", turn: 1, seq: 0, format: "mp3", data: "AAA", durMs: 400 });
    await r.server({ type: "audio", turn: 1, seq: 1, format: "mp3", data: "BBB", durMs: 400 });
    expect(r.play.chunks).toEqual(["1:0:AAA", "1:1:BBB"]);
    expect(r.client.state.phase).toBe("speaking");
    expect(r.client.state.captions).toEqual([{ who: "coach", turn: 1, text: "Hi! How was the run?" }]);
    await r.server({ type: "turn_end", turn: 1 });
    expect(r.client.state.phase).toBe("speaking"); // still playing
    r.play.busy = false;
    r.idle();
    expect(r.client.state.phase).toBe("listening");
  });

  it("barge-in: the athlete's words stop playback at once, interrupt goes up with heardMs, late audio is dropped", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "caption", turn: 2, text: "Today I'd like you to", say: "cloud" });
    await r.server({ type: "audio", turn: 2, seq: 0, format: "mp3", data: "AAA", durMs: 500 });
    r.stt_().partial("wait");
    expect(r.play.stops).toEqual([2]);
    expect(r.sent.find((m) => m.type === "interrupt")).toEqual({ type: "interrupt", heardMs: 1200 });
    expect(r.client.state.captions[0]!.cut).toBe(true);
    expect(r.client.state.bargeIns).toBe(1);
    await r.server({ type: "audio", turn: 2, seq: 1, format: "mp3", data: "LATE", durMs: 500 });
    expect(r.play.chunks).toEqual(["2:0:AAA"]);
    // The turn ends when the words stop changing: one final goes up.
    r.fire(700);
    expect(r.sent.filter((m) => m.type === "text" && m.final)).toEqual([{ type: "text", final: true, text: "wait" }]);
    expect(r.client.state.phase).toBe("thinking");
    expect(r.stt.resets).toBe(1);
  });

  it("on a phone speaker one word doesn't barge in (echo), two do", async () => {
    const r = rig({ bargeWords: 2 });
    await live(r);
    await r.server({ type: "audio", turn: 1, seq: 0, format: "mp3", data: "AAA", durMs: 500 });
    r.stt_().partial("so");
    expect(r.play.stops).toEqual([]);
    r.stt_().partial("so wait");
    expect(r.play.stops).toEqual([1]);
  });

  it("a server stop (cloud STT heard the athlete) silences without a second interrupt", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "audio", turn: 3, seq: 0, format: "mp3", data: "AAA", durMs: 500 });
    await r.server({ type: "stop", turn: 3 });
    expect(r.play.stops).toEqual([3]);
    expect(r.sent.some((m) => m.type === "interrupt")).toBe(false);
  });

  it("show_permission pauses the mic, waits for the athlete, sends the result back, then listens again", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "tool_call", id: "tu1", name: "show_permission", args: { kind: "health" } });
    expect(r.stt.paused).toBe(1);
    expect(r.stt.resumed).toBe(1);
    expect(r.sent.find((m) => m.type === "tool_result")).toEqual({
      type: "tool_result",
      id: "tu1",
      result: { status: "granted", health: { stepsPerDay: [7000, 8000] } },
    });
  });

  it("one-way tools (fill a card) run without a result", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "tool_call", id: "tu2", name: "set_survey_answer", args: { id: "goals", value: ["move"] } });
    expect(r.tools).toEqual([{ name: "set_survey_answer", args: { id: "goals", value: ["move"] } }]);
    expect(r.sent.some((m) => m.type === "tool_result")).toBe(false);
  });

  it("device voice captions are said by the device", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "caption", turn: 1, text: "Hello", say: "device" });
    expect(r.play.said).toEqual(["Hello"]);
  });

  it("mute: nothing heard is sent", async () => {
    const r = rig();
    await live(r);
    r.client.setMuted(true);
    r.stt_().partial("secret words");
    r.stt_().final("secret words");
    expect(r.sent.filter((m) => m.type === "text")).toEqual([]);
    expect(r.stt.paused).toBe(1);
  });

  it("hang up sends end and stops everything", async () => {
    const r = rig();
    await live(r);
    r.client.hangUp();
    expect(r.sent[r.sent.length - 1]).toEqual({ type: "end" });
    expect(r.stt.stopped).toBe(1);
    expect(r.client.state).toMatchObject({ phase: "ended", endReason: "hangup", fallback: null });
  });
});

describe("fallbacks", () => {
  it("offline: no ticket asked, scripted path", async () => {
    const ticket = vi.fn();
    const r = rig({ online: () => false, ticket });
    await r.client.start();
    expect(ticket).not.toHaveBeenCalled();
    expect(r.client.state.fallback).toBe("offline");
  });

  it("the server says no (off, minutes, guard)", async () => {
    for (const [off, want] of [
      ["off", "off"],
      ["cap", "cap"],
      ["scripted", "scripted"],
    ] as const) {
      const r = rig({ ticketOff: off });
      await r.client.start();
      expect(r.client.state.fallback).toBe(want);
    }
  });

  it("an older API without the route (404) or no network", async () => {
    const a = rig({ ticketThrows: { status: 404 } });
    await a.client.start();
    expect(a.client.state.fallback).toBe("off");
    const b = rig({ ticketThrows: {} });
    await b.client.start();
    expect(b.client.state.fallback).toBe("net");
  });

  it("no ready in time", async () => {
    const r = rig();
    await r.client.start();
    r.open();
    r.fire(8000);
    expect(r.client.state.fallback).toBe("net");
  });

  it("no mic: the call ends and goes on without the live part", async () => {
    const r = rig({ sttOk: false });
    await live(r);
    expect(r.sent[r.sent.length - 1]).toEqual({ type: "end" });
    expect(r.client.state.fallback).toBe("no_mic");
  });

  it("the AI guard ends the call scripted; the socket dropping mid-call too", async () => {
    const r = rig();
    await live(r);
    await r.server({ type: "end", reason: "scripted" });
    expect(r.client.state.fallback).toBe("scripted");
    const d = rig();
    await live(d);
    d.drop();
    expect(d.client.state.fallback).toBe("ended_early");
  });

  it("onboarding: every way out lands on the cards", () => {
    for (const reason of ["scripted", "error", "cards", "cap", "call_max", "silence"] as const)
      expect(fallbackFor("onboarding", reason)).toBe("cards");
    expect(fallbackFor("onboarding", "summary")).toBeNull();
    expect(fallbackFor("call", "bye")).toBeNull();
    expect(fallbackFor("call", "cap")).toBe("cap");
    expect(ticketFallback("onboarding_used")).toBe("off");
  });
});

describe("Quiet and workouts (ADR-0062 §5)", () => {
  const base = { serverOn: true, online: true, inWorkout: false, athleteStarted: true };
  it("a live call opens only when the athlete started it, workout or not", () => {
    expect(liveCallAllowed(base)).toBe(true);
    expect(liveCallAllowed({ ...base, inWorkout: true })).toBe(true);
    expect(liveCallAllowed({ ...base, athleteStarted: false })).toBe(false);
    expect(liveCallAllowed({ ...base, serverOn: false })).toBe(false);
    expect(liveCallAllowed({ ...base, online: false })).toBe(false);
  });
  it("the day-one offer: never in a workout, at Quiet, offline, or with the server off", () => {
    const o = { serverOn: true, online: true, inWorkout: false };
    expect(onboardingCallOffered(o)).toBe(true);
    expect(onboardingCallOffered({ ...o, quiet: true })).toBe(false);
    expect(onboardingCallOffered({ ...o, inWorkout: true })).toBe(false);
    expect(onboardingCallOffered({ ...o, online: false })).toBe(false);
    expect(onboardingCallOffered({ ...o, serverOn: false })).toBe(false);
  });
});

describe("socket url", () => {
  it("the API's path on the API's host, wss", async () => {
    const { liveSocketUrl } = await import("./liveCallClient");
    expect(liveSocketUrl("https://api.example/", { ticket: "abc", url: "/v1/coach/live-call?ticket=abc" })).toBe(
      "wss://api.example/v1/coach/live-call?ticket=abc",
    );
    expect(liveSocketUrl("http://192.168.1.2:8787", { ticket: "abc" })).toBe("ws://192.168.1.2:8787/v1/coach/live-call?ticket=abc");
    expect(liveSocketUrl("https://a", { ticket: "x", url: "wss://b/ws" })).toBe("wss://b/ws");
  });
});
