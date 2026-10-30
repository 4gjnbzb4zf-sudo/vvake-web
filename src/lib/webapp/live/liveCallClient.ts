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
 * - Super coach (build 60, ADR-0068), web additions the phone copy gets from the super-coach-talk branch: `prewarm()`
 *   (hello.wait: the socket and the athlete's context are ready before the athlete is), `start()` after it sends
 *   `start`; `card()` tells the server where a coach action card stands; per-turn `metrics` (end of speech → final
 *   text, → the coach's first sound); a local voice detector (`speech` from the recogniser) cuts the coach at once;
 *   `to_ptt` (live minutes used up) is a fallback the talk screen turns into push-to-talk.
 */
import type { LiveCallMode, LiveClientMsg, LiveEndReason, LiveHello, LiveServerMsg } from "./liveCallProtocol";
import { parseServerMsg } from "./liveCallProtocol";

export type LivePhase = "connecting" | "listening" | "thinking" | "speaking" | "waiting" | "ended";

/** Why the call didn't go live (or stopped being live): the caller goes on without it. */
export type LiveFallback =
  | "offline"
  | "off"
  | "net"
  | "no_mic"
  | "scripted"
  | "cards"
  | "cap"
  | "ended_early"
  /** The live minutes ran out mid-talk: the same screen goes on in push-to-talk (ADR-0068). */
  | "to_ptt"
  /** A pre-warmed talk the athlete never started. */
  | "unused";

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
  /**
   * Cloud STT: the local voice detector heard the athlete start (true) or stop (false) talking. Starting while the
   * coach speaks cuts it at once (barge-in without the server's round trip); the stop is the end of speech the
   * latency metrics count from.
   */
  speech?(on: boolean): void;
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
  /** Called by the player when a turn's first sound actually starts playing (latency metrics). */
  onStart?(cb: (turn: number) => void): void;
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
  /** Pre-warmed (hello.wait answered with `warm`): `start()` begins at once. */
  warm?: boolean;
  /** The server's timings of the last coach turn (ms from the athlete's final). */
  timing?: { turn: number; firstTokenMs?: number; firstSentenceMs?: number; firstAudioMs?: number } | null;
  /** This device's timings of the last turn: end of speech → final text, → first sound. */
  metrics?: { turn: number; sttMs?: number; eosToAudioMs?: number } | null;
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
  /**
   * The athlete's words, before they go to the server: true when the app answered them itself (a spoken yes or no to
   * the coach action card on screen, build 55; any mode since ADR-0068): shown as theirs, never sent. With cloud STT
   * the server heard them first: the app still answers the card (once; the server's answer_card then finds it done).
   */
  answer?(text: string): boolean;
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
export const WAITED_TOOLS: ReadonlySet<string> = new Set(["show_permission", "app_action", "find_places"]);
/**
 * Waited tools the athlete answers by voice: the mic stays on (app_action: the coach action card, confirmed by a tap
 * or a spoken yes, build 55; find_places: the app looks places up while the talk goes on). The others (a system
 * permission sheet) pause it.
 */
export const SPOKEN_TOOLS: ReadonlySet<string> = new Set(["app_action", "find_places"]);

/** Server end reasons that mean "go on the old way" rather than "the call is over". Pure. */
export function fallbackFor(mode: LiveCallMode, reason: LiveEndReason): LiveFallback | null {
  if (reason === "cards") return "cards";
  if (reason === "to_ptt") return "to_ptt";
  if (reason === "unused") return "unused";
  // The athlete-started talk goes on in push-to-talk when its minutes run out, whatever the server called it.
  if (mode === "talk" && (reason === "cap" || reason === "call_max")) return "to_ptt";
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
  /** Spoken waited tools open (a card on screen): the mic stays on and a voice still cuts the coach. */
  private spokenWait = 0;
  private lastPartialAt = 0;
  private closed = false;
  private now: () => number;
  /** Pre-warm: the socket was opened with hello.wait; `begun` once `start` went up; `wantStart` = start on warm. */
  private waiting = false;
  private begun = false;
  private wantStart = false;
  private connecting: Promise<void> | null = null;
  /** Latency: when the athlete's speech ended (local), the final's turn, and whether that turn's metrics went up. */
  private speechEndAt = 0;
  private speechOn = false;
  private speechOnAt = 0;
  private finalAt = 0;
  private sttMs: number | undefined;
  private metricTurn: number | null = null;
  private awaitingFirstSound = false;
  private lastCoachTurn = -1;

  constructor(deps: LiveClientDeps, now: () => number = () => Date.now()) {
    this.d = deps;
    this.now = now;
    deps.player.onIdle(() => this.onPlayerIdle());
    deps.player.onStart?.((turn) => this.onFirstSound(turn));
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

  /**
   * Pre-warm (ADR-0068): ticket, socket and hello{wait:true} now, so the athlete's first words meet a ready coach.
   * Nothing is metered and the mic stays off until `start()`. Resolves once the socket is asked for (never rejects).
   */
  prewarm(): Promise<void> {
    if (this.connecting || this.closed) return this.connecting ?? Promise.resolve();
    this.waiting = true;
    this.connecting = this.connect();
    return this.connecting;
  }

  /** Opens the call (or begins a pre-warmed one). Resolves once it is live or has fallen back (never rejects). */
  async start(): Promise<void> {
    if (this.closed) return;
    if (this.connecting) {
      this.wantStart = true;
      if (this.s.warm) this.begin();
      return this.connecting;
    }
    this.connecting = this.connect();
    return this.connecting;
  }

  /** After a pre-warm: `start` goes up and the mic opens (the server greets or listens). */
  private begin() {
    if (this.begun || this.closed) return;
    this.begun = true;
    this.sendMsg({ type: "start" });
    this.set({ phase: "waiting" });
    void this.listen();
  }

  private async connect(): Promise<void> {
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
        open: () => this.sendMsg({ type: "hello", mode: this.d.mode, ...this.d.hello, ...(this.waiting ? { wait: true } : {}) }),
        message: (data) => void this.onMessage(data),
        close: () => this.onSocketClose(),
      });
    } catch {
      return this.fallBack("net");
    }
    this.readyTimer = this.d.setTimer(() => {
      if (this.s.phase === "connecting" && !this.s.warm) this.fallBack("net");
    }, this.d.readyMs ?? 8000);
  }

  /** A coach action card's state, for the server (ADR-0068): shown, confirmed, cancelled, done, failed (+ why). */
  card(id: string, state: "shown" | "confirmed" | "cancelled" | "done" | "failed", reason?: string) {
    this.sendMsg({ type: "card", id, state, ...(reason ? { reason } : {}) });
  }

  // ── Server → app ──

  private async onMessage(raw: unknown) {
    const m = parseServerMsg(raw);
    if (!m || this.closed) return;
    switch (m.type) {
      case "ready":
        if (this.readyTimer) this.d.clearTimer(this.readyTimer);
        this.readyTimer = null;
        // A server that doesn't know hello.wait answers `ready` at once: the call is on (the athlete opened it).
        this.begun = true;
        this.set({ phase: this.listening ? this.s.phase : "waiting", warm: false, meter: { usedS: 0, leftS: m.leftS, warn: false } });
        await this.listen();
        return;
      case "warm":
        if (this.readyTimer) this.d.clearTimer(this.readyTimer);
        this.readyTimer = null;
        this.set({ warm: true, meter: { usedS: 0, leftS: m.leftS, warn: false } });
        if (this.wantStart) this.begin();
        return;
      case "timing":
        this.set({
          timing: { turn: m.turn, firstTokenMs: m.firstTokenMs, firstSentenceMs: m.firstSentenceMs, firstAudioMs: m.firstAudioMs },
        });
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
          this.markFinal();
          // A yes / no to the card on screen: the app answers it (the server's answer_card then finds it settled).
          if (this.d.answer?.(m.text.trim())) return this.set({ phase: "listening" });
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
    if (turn > this.lastCoachTurn) {
      this.lastCoachTurn = turn;
      // The first coach turn after the athlete's final: its first sound closes the turn's latency.
      if (this.finalAt && this.metricTurn === null) {
        this.metricTurn = turn;
        this.awaitingFirstSound = true;
      }
    }
    if (this.s.phase !== "ended") this.set({ phase: "speaking" });
  }

  private onPlayerIdle() {
    if (this.closed || this.s.phase === "ended") return;
    if (this.s.phase === "speaking" && (this.turn === null || this.serverDone.has(this.turn) || this.cut.has(this.turn)))
      this.set({ phase: this.waitingTool ? "waiting" : "listening" });
  }

  /** The athlete's turn ended (a final went up or came back): the latency clock of this turn starts. */
  private markFinal() {
    const now = this.now();
    // End of speech: the voice detector's stop (cloud), else the last partial's time, else now.
    const eos = this.speechEndAt && now - this.speechEndAt < 15_000 ? this.speechEndAt : this.lastPartialAt || now;
    this.finalAt = eos;
    this.sttMs = Math.max(0, now - eos);
    this.metricTurn = null;
    this.awaitingFirstSound = false;
  }

  private onFirstSound(turn: number) {
    if (!this.awaitingFirstSound || this.metricTurn === null || turn !== this.metricTurn || !this.finalAt) return;
    this.awaitingFirstSound = false;
    const eosToAudioMs = Math.max(0, this.now() - this.finalAt);
    const metrics = { turn, ...(this.sttMs !== undefined ? { sttMs: this.sttMs } : {}), eosToAudioMs };
    this.sendMsg({ type: "metrics", ...metrics });
    this.finalAt = 0;
    this.set({ metrics });
  }

  /** Cloud STT's local voice detector: talking over the coach cuts it now; the stop is the end of speech. */
  private onSpeech(on: boolean) {
    if (this.closed || this.s.muted) return;
    const now = this.now();
    if (on) {
      this.speechOn = true;
      this.speechOnAt = now;
      const tool = this.waitingTool && !this.spokenWait;
      if (!tool && this.coachSpeaking()) this.bargeIn();
    } else if (this.speechOn) {
      this.speechOn = false;
      this.speechEndAt = now;
    }
  }

  private async runTool(id: string, name: string, args: Record<string, unknown>) {
    const waited = WAITED_TOOLS.has(name);
    const spoken = SPOKEN_TOOLS.has(name);
    if (spoken) this.spokenWait++;
    if (waited && !spoken) {
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
    if (spoken) this.spokenWait = Math.max(0, this.spokenWait - 1);
    if (waited && !spoken) {
      this.waitingTool = Math.max(0, this.waitingTool - 1);
      this.sendMsg({ type: "tool_result", id, result: result ?? { status: "no_answer" } });
      if (!this.closed && !this.s.muted) this.d.stt.resume();
      if (!this.closed) this.set({ phase: "thinking" });
    } else if (waited) {
      this.sendMsg({ type: "tool_result", id, result: result ?? { status: "no_answer" } });
    }
  }

  // ── The athlete ──

  private async listen() {
    if (this.listening) return;
    const ok = await this.d.stt.start({
      partial: (text) => this.onPartial(text),
      final: (text) => this.onFinal(text),
      audio: (b64) => !this.s.muted && this.sendMsg({ type: "audio", data: b64 }),
      speech: (on) => this.onSpeech(on),
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
    this.lastPartialAt = this.now();
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
    if (this.d.answer?.(t)) {
      // Answered here (the card's yes or no): the coach hears the result through the tool, not these words.
      this.addMine(t);
      return;
    }
    this.markFinal();
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
    // A pre-warmed socket that closed before the athlete started: nothing was lost, start() can try again.
    if (this.waiting && !this.begun && !this.wantStart) return this.finish(null, "unused");
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
