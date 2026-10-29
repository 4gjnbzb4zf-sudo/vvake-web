/**
 * A live coach call with barge-in (docs/05-tech/live-call.md, phase L2/L3): the app's side of the call's WebSocket.
 * Pure state and messages, no React Native: the socket, the speech recogniser, the player and the timers are handed
 * in (lib/liveCallNative.ts on the phone, liveCallBrowser.ts on the web), so a fake server drives it in tests
 * (test/liveCallClient.test.ts). The same file is copied to the web app (vvake-web src/lib/webapp/live/liveCallClient.ts).
 *
 * - Hears the athlete on the device (stt "device": partial words, a final when they stop: the recogniser's own final,
 *   or the words unchanged for `endpointMs`) or sends their sound (stt "cloud": the web, watches, phones without
 *   on-device speech); the server answers with captions, audio chunks, fixed lines and tool calls.
 * - Barge-in: the athlete talks while the coach is speaking → the player stops at once (locally, no round trip), then
 *   `interrupt {heardMs}` goes up so the server cancels the model and the voice and keeps only what was heard. The
 *   rest of that turn's audio is dropped when it arrives.
 * - Never an error screen: no ticket, the server says no, offline, no mic, the socket drops, the AI guard in scripted
 *   mode → `fallback` with a reason, and the caller goes on the old way (scripted lines + tap to talk, or the cards).
 */
import type { LiveCallMode, LiveClientMsg, LiveEndReason, LiveHello, LiveServerMsg } from "./liveCallProtocol";
import { parseServerMsg } from "./liveCallProtocol";

export type LivePhase = "connecting" | "listening" | "thinking" | "speaking" | "waiting" | "ended";

/** Why the call didn't go live (or stopped being live): the caller goes on without it. */
export type LiveFallback = "offline" | "off" | "net" | "no_mic" | "scripted" | "cards" | "cap" | "ended_early";

export interface LiveSocket {
  send(data: string): void;
  close(): void;
}
export interface LiveSocketEvents {
  open(): void;
  message(data: unknown): void;
  close(): void;
}

export interface LiveSttEvents {
  /** Words so far in this turn (may change). */
  partial(text: string): void;
  /** The recogniser decided the turn is over. */
  final(text: string): void;
  /** Cloud STT: a frame of PCM16 16 kHz mono, base64. */
  audio?(b64: string): void;
  /** The recogniser stopped for good (permission revoked, error). */
  failed(code: string): void;
}
export interface LiveStt {
  /** Starts listening; false when the mic or speech recognition isn't allowed / available. */
  start(ev: LiveSttEvents): Promise<boolean>;
  /** Forget this turn's words and keep listening (after a final). */
  reset(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface LivePlayer {
  /** A chunk of the coach's voice for `turn` (concatenable mp3 or PCM16). */
  push(turn: number, seq: number, format: "mp3" | "pcm16", data: string, durMs: number): void;
  /** A fixed line: its cached audio, or the device voice when `url` is null. */
  line(turn: number, text: string, url: string | null): void;
  /** Words the server wants said by the device voice. */
  say(turn: number, text: string): void;
  /** Stops everything now; returns how many ms of `turn`'s audio were heard. */
  stop(turn: number | null): number;
  /** Something is playing or queued. */
  busy(): boolean;
  /** Called by the player when it runs out of things to play. */
  onIdle(cb: () => void): void;
}

export interface LiveCaption {
  who: "coach" | "me";
  turn: number;
  text: string;
  /** Cut by the athlete (barge-in): shown dimmed. */
  cut?: boolean;
}

export interface LiveState {
  phase: LivePhase;
  captions: LiveCaption[];
  /** The athlete's words while they speak. */
  partial: string;
  meter: { usedS: number; leftS: number; warn: boolean } | null;
  muted: boolean;
  /** Set once the call stopped being live: the caller goes on without it. */
  fallback: LiveFallback | null;
  endReason: LiveEndReason | null;
  bargeIns: number;
}

export interface LiveTicket {
  ticket?: string;
  url?: string;
  off?: string;
}

export interface LiveClientDeps {
  mode: LiveCallMode;
  hello: Omit<LiveHello, "type" | "mode">;
  online(): boolean;
  ticket(): Promise<LiveTicket>;
  /** The socket URL from the ticket (the API's `url`, else built from the API base). */
  socketUrl(t: LiveTicket): string;
  openSocket(url: string, ev: LiveSocketEvents): LiveSocket;
  stt: LiveStt;
  player: LivePlayer;
  /** A tool the server asks the app to run (fill a card, show a permission…); its result goes back when it waits. */
  onTool(name: string, args: Record<string, unknown>): Promise<unknown> | unknown;
  onState(s: LiveState): void;
  /** Timers (tests use fake ones). */
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(h: unknown): void;
  /** Words needed before talking over the coach stops it (1 on iPhone / headphones; 2 on a phone speaker). */
  bargeWords?: number;
  /** End of the athlete's turn: words unchanged this long (the recogniser's own final comes first when it has one). */
  endpointMs?: number;
  /** How long `ready` may take before the call goes on without the live part. */
  readyMs?: number;
}

/** Tools the server waits on (it sends `tool_result` back); the others are one-way. */
export const WAITED_TOOLS: ReadonlySet<string> = new Set(["show_permission"]);

/** Server end reasons that mean "go on the old way" rather than "the call is over". Pure. */
export function fallbackFor(mode: LiveCallMode, reason: LiveEndReason): LiveFallback | null {
  if (reason === "cards") return "cards";
  if (reason === "scripted" || reason === "error") return mode === "onboarding" ? "cards" : "scripted";
  if (mode === "onboarding" && (reason === "cap" || reason === "call_max" || reason === "silence" || reason === "turns")) return "cards";
  if (reason === "cap") return "cap";
  return null;
}

/** Ticket refusals (`off`) and HTTP failures as a fallback reason. Pure. */
export function ticketFallback(off: string | undefined): LiveFallback {
  // The API's 409 reasons (services/api src/routes/liveCall.ts): cap = the week's live minutes are used.
  if (off === "cap") return "cap";
  if (off === "scripted" || off === "budget") return "scripted";
  return "off";
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export class LiveCallClient {
  private d: LiveClientDeps;
  private sock: LiveSocket | null = null;
  private s: LiveState = {
    phase: "connecting",
    captions: [],
    partial: "",
    meter: null,
    muted: false,
    fallback: null,
    endReason: null,
    bargeIns: 0,
  };
  /** The coach turn playing (or last played) and the turns cut by the athlete (their late audio is dropped). */
  private turn: number | null = null;
  private cut = new Set<number>();
  /** Server turns whose words are all sent (turn_end). */
  private serverDone = new Set<number>();
  private readyTimer: unknown = null;
  private endpointTimer: unknown = null;
  private lastPartial = "";
  private lastSentPartialAt = 0;
  private listening = false;
  private waitingTool = 0;
  private closed = false;
  private now: () => number;

  constructor(deps: LiveClientDeps, now: () => number = () => Date.now()) {
    this.d = deps;
    this.now = now;
    deps.player.onIdle(() => this.onPlayerIdle());
  }

  get state(): LiveState {
    return this.s;
  }

  private set(p: Partial<LiveState>) {
    this.s = { ...this.s, ...p };
    this.d.onState(this.s);
  }

  private sendMsg(m: LiveClientMsg) {
    if (!this.sock || this.closed) return;
    try {
      this.sock.send(JSON.stringify(m));
    } catch {
      // The close handler takes it from here.
    }
  }

  /** Opens the call. Resolves once it is live or has fallen back (never rejects). */
  async start(): Promise<void> {
    this.set({ phase: "connecting" });
    if (!this.d.online()) return this.fallBack("offline");
    let t: LiveTicket;
    try {
      t = await this.d.ticket();
    } catch (e) {
      const status = (e as { status?: number } | null)?.status;
      return this.fallBack(status === undefined || status === 0 ? "net" : status === 402 || status === 429 ? "cap" : "off");
    }
    if (this.closed) return;
    if (!t.ticket || t.off) return this.fallBack(ticketFallback(t.off));
    try {
      this.sock = this.d.openSocket(this.d.socketUrl(t), {
        open: () => this.sendMsg({ type: "hello", mode: this.d.mode, ...this.d.hello }),
        message: (data) => void this.onMessage(data),
        close: () => this.onSocketClose(),
      });
    } catch {
      return this.fallBack("net");
    }
    this.readyTimer = this.d.setTimer(() => {
      if (this.s.phase === "connecting") this.fallBack("net");
    }, this.d.readyMs ?? 8000);
  }

  // ── Server → app ──

  private async onMessage(raw: unknown) {
    const m = parseServerMsg(raw);
    if (!m || this.closed) return;
    switch (m.type) {
      case "ready":
        if (this.readyTimer) this.d.clearTimer(this.readyTimer);
        this.readyTimer = null;
        this.set({ phase: "waiting", meter: { usedS: 0, leftS: m.leftS, warn: false } });
        await this.listen();
        return;
      case "caption":
        if (this.cut.has(m.turn)) return;
        this.addCoach(m.turn, m.text);
        if (m.say === "device") this.d.player.say(m.turn, m.text);
        if (m.say !== "none") this.speaking(m.turn);
        return;
      case "audio":
        if (this.cut.has(m.turn)) return;
        this.d.player.push(m.turn, m.seq, m.format, m.data, m.durMs);
        this.speaking(m.turn);
        return;
      case "line":
        if (this.cut.has(m.turn)) return;
        this.addCoach(m.turn, m.text);
        this.d.player.line(m.turn, m.text, m.url);
        this.speaking(m.turn);
        return;
      case "turn_end":
        this.serverDone.add(m.turn);
        if (!this.d.player.busy()) this.onPlayerIdle();
        return;
      case "stop":
        // Cloud STT heard the athlete over the coach: same as a local barge-in, without telling the server again.
        this.stopTurn(m.turn);
        return;
      case "heard":
        // Cloud STT: the server heard the athlete (a final is their turn: the coach is on it).
        if (m.final) {
          this.addMine(m.text);
          this.set({ phase: "thinking" });
        } else if (!this.s.muted) this.set({ partial: m.text });
        return;
      case "tool_call":
        await this.runTool(m.id, m.name, m.args);
        return;
      case "meter":
        this.set({ meter: { usedS: m.usedS, leftS: m.leftS, warn: m.warn || this.s.meter?.warn === true } });
        return;
      case "end": {
        const fb = fallbackFor(this.d.mode, m.reason);
        // The goodbye or the cap line may still be playing: let it finish, then the call is over.
        this.finish(m.reason, fb);
        return;
      }
      case "error":
        if (m.code === "no_cloud_stt" || m.code === "hello_first") this.finish("error", fallbackFor(this.d.mode, "error"));
        return;
    }
  }

  private addCoach(turn: number, text: string) {
    const caps = [...this.s.captions];
    const last = caps[caps.length - 1];
    if (last && last.who === "coach" && last.turn === turn) caps[caps.length - 1] = { ...last, text: `${last.text} ${text}`.trim() };
    else caps.push({ who: "coach", turn, text });
    this.set({ captions: caps.slice(-40) });
  }

  private addMine(text: string) {
    const caps = [...this.s.captions, { who: "me" as const, turn: this.turn ?? 0, text }];
    this.set({ captions: caps.slice(-40), partial: "" });
  }

  private speaking(turn: number) {
    this.turn = turn;
    if (this.s.phase !== "ended") this.set({ phase: "speaking" });
  }

  private onPlayerIdle() {
    if (this.closed || this.s.phase === "ended") return;
    if (this.s.phase === "speaking" && (this.turn === null || this.serverDone.has(this.turn) || this.cut.has(this.turn)))
      this.set({ phase: this.waitingTool ? "waiting" : "listening" });
  }

  private async runTool(id: string, name: string, args: Record<string, unknown>) {
    const waited = WAITED_TOOLS.has(name);
    if (waited) {
      // A permission card is up: the mic waits (a word said to the system sheet is not an answer to the coach).
      this.waitingTool++;
      this.d.stt.pause();
      this.set({ phase: "waiting" });
    }
    let result: unknown;
    try {
      result = await this.d.onTool(name, args);
    } catch {
      result = { status: "error" };
    }
    if (waited) {
      this.waitingTool = Math.max(0, this.waitingTool - 1);
      this.sendMsg({ type: "tool_result", id, result: result ?? { status: "no_answer" } });
      if (!this.closed && !this.s.muted) this.d.stt.resume();
      if (!this.closed) this.set({ phase: "thinking" });
    }
  }

  // ── The athlete ──

  private async listen() {
    if (this.listening) return;
    const ok = await this.d.stt.start({
      partial: (text) => this.onPartial(text),
      final: (text) => this.onFinal(text),
      audio: (b64) => !this.s.muted && this.sendMsg({ type: "audio", data: b64 }),
      failed: () => {
        if (!this.closed) this.finish("error", this.d.mode === "onboarding" ? "cards" : "no_mic");
      },
    });
    if (this.closed) return;
    if (!ok) {
      this.sendMsg({ type: "end" });
      return this.finish("hangup", this.d.mode === "onboarding" ? "cards" : "no_mic");
    }
    this.listening = true;
    if (this.s.phase === "waiting") this.set({ phase: "listening" });
  }

  private onPartial(text: string) {
    if (this.closed || this.s.muted || this.waitingTool) return;
    const t = text.trim();
    if (!t || t === this.lastPartial) return;
    this.lastPartial = t;
    // Talking over the coach: stop it now (locally), then tell the server.
    if (this.coachSpeaking() && words(t) >= (this.d.bargeWords ?? 1)) this.bargeIn();
    this.set({ partial: t });
    // Partials keep the meter running on the server (it counts time the athlete speaks); a few a second at most.
    const now = this.now();
    if (now - this.lastSentPartialAt > 600) {
      this.lastSentPartialAt = now;
      this.sendMsg({ type: "text", final: false, text: t });
    }
    if (this.endpointTimer) this.d.clearTimer(this.endpointTimer);
    this.endpointTimer = this.d.setTimer(() => this.onFinal(this.lastPartial), this.d.endpointMs ?? 700);
  }

  private onFinal(text: string) {
    if (this.endpointTimer) this.d.clearTimer(this.endpointTimer);
    this.endpointTimer = null;
    const t = text.trim();
    this.lastPartial = "";
    this.d.stt.reset();
    if (this.closed || this.s.muted || this.waitingTool || !t) return this.set({ partial: "" });
    if (this.coachSpeaking()) this.bargeIn();
    this.addMine(t);
    this.sendMsg({ type: "text", final: true, text: t });
    this.set({ phase: "thinking" });
  }

  private coachSpeaking() {
    return this.s.phase === "speaking" || this.d.player.busy();
  }

  /** The athlete talked over the coach: silence now, drop the rest of the turn, tell the server what was heard. */
  bargeIn() {
    if (this.closed) return;
    const turn = this.turn;
    const heardMs = this.stopTurn(turn);
    this.sendMsg({ type: "interrupt", ...(heardMs !== null ? { heardMs } : {}) });
  }

  private stopTurn(turn: number | null): number | null {
    const heard = this.d.player.stop(turn);
    if (turn !== null) {
      this.cut.add(turn);
      const caps = this.s.captions.map((c) => (c.who === "coach" && c.turn === turn ? { ...c, cut: true } : c));
      this.set({ captions: caps, bargeIns: this.s.bargeIns + 1, phase: "listening" });
    } else this.set({ phase: "listening" });
    return turn === null ? null : Math.max(0, Math.round(heard));
  }

  /** Mute: the mic stops hearing (nothing is sent); the coach can still finish its sentence. */
  setMuted(muted: boolean) {
    if (this.closed) return;
    if (muted) this.d.stt.pause();
    else this.d.stt.resume();
    this.set({ muted, partial: muted ? "" : this.s.partial });
  }

  /** Hang up (or "I'd rather tap"): the server ends the call; the caller decides what follows. */
  hangUp(fallback: LiveFallback | null = null) {
    if (this.closed) return;
    this.sendMsg({ type: "end" });
    this.finish("hangup", fallback);
  }

  private onSocketClose() {
    if (this.closed) return;
    // Dropped without an `end`: the live part is over; the caller goes on the old way.
    this.finish("error", this.s.phase === "connecting" ? "net" : this.d.mode === "onboarding" ? "cards" : "ended_early");
  }

  private fallBack(why: LiveFallback) {
    this.finish(null, why);
  }

  private finish(reason: LiveEndReason | null, fallback: LiveFallback | null) {
    if (this.closed) return;
    this.closed = true;
    if (this.readyTimer) this.d.clearTimer(this.readyTimer);
    if (this.endpointTimer) this.d.clearTimer(this.endpointTimer);
    this.d.stt.stop();
    // A barge-in or a drop silences at once; a normal end lets the last line finish (the player empties itself).
    if (fallback || reason === "hangup") this.d.player.stop(this.turn);
    try {
      this.sock?.close();
    } catch {
      // already closed
    }
    this.set({ phase: "ended", fallback, endReason: reason, partial: "" });
  }
}

/** wss:// for the API's https:// (a ticket without its own url). Pure. */
export function liveSocketUrl(base: string, t: LiveTicket): string {
  if (t.url && /^wss?:\/\//.test(t.url)) return t.url;
  const b = base.replace(/^http/, "ws").replace(/\/+$/, "");
  // The API answers a path (`/v1/coach/live-call?ticket=…`); an older draft had none.
  if (t.url?.startsWith("/")) return `${b}${t.url}`;
  return `${b}/v1/coach/live-call?ticket=${encodeURIComponent(t.ticket ?? "")}`;
}

// ── Gates ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface LiveGateInput {
  /** The server says the live call exists (GET /v1/health features.liveCall / onboardingCall). */
  serverOn: boolean;
  online: boolean;
  /** A workout runs here or on a linked watch. */
  inWorkout: boolean;
  /** The athlete started it (answered the call, tapped Talk live, picked "Talk it through"). */
  athleteStarted: boolean;
  /** Suggestions level (ADR-0062): only the onboarding offer is a suggestion. */
  quiet?: boolean;
  /** Screen reader on: still offered, tapping comes first. */
  screenReader?: boolean;
}

/**
 * May a live call open now? (ADR-0062 §5: quiet during workouts unless the athlete starts it; never on its own.)
 * Calls, workout talk: only when the athlete started it. Pure.
 */
export function liveCallAllowed(i: LiveGateInput): boolean {
  if (!i.serverOn || !i.online) return false;
  if (!i.athleteStarted) return false;
  return true;
}

/**
 * Offer the day-one call ("Talk it through with your coach")? Never offline, in a workout, at the Quiet level, or
 * when the server has it off; otherwise both choices show (tapping first for screen readers). Pure.
 */
export function onboardingCallOffered(i: Omit<LiveGateInput, "athleteStarted">): boolean {
  return i.serverOn && i.online && !i.inWorkout && !i.quiet;
}
