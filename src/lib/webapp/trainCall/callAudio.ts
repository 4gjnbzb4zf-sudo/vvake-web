// Copied from VVFit apps/mobile/src/lib/trainCallAudio.ts (build 63), with the browser's WebRTC (browserRtc) instead of
// nativeRtc. Keep the CallAudio class identical.
/**
 * The group audio of "Train together over a call" (ADR-0071 §A): WebRTC through Cloudflare Realtime (an SFU). The
 * API holds the Realtime app token and proxies the offers and answers (POST /v1/meetups/:id/call/audio, …/pull,
 * …/renegotiate); this phone publishes its microphone as one track and pulls the tracks of the people on the board
 * who are in the audio. Audio is never recorded, on the phone or anywhere else.
 *
 * Pure (no React Native import): the WebRTC implementation is given (`rtc`). The browser has it built in (the web
 * app's copy uses window.RTCPeerConnection); on the phone it comes from react-native-webrtc (MIT), which this build
 * doesn't include yet: `nativeRtc()` answers null and the call screen says the board works without audio. Adding it is
 * one documented step (docs/05-tech/places-and-meetups.md "Audio on the phone"), behind the server's TRAIN_CALL_AUDIO.
 * Tests drive it with a fake (test/trainCallAudio.test.ts).
 */
export interface SdpLike {
  type: "offer" | "answer";
  sdp: string;
}

export interface TrackLike {
  enabled: boolean;
  stop(): void;
}
export interface StreamLike {
  getAudioTracks(): TrackLike[];
  getTracks(): TrackLike[];
}
export interface TransceiverLike {
  mid: string | null;
}
export interface PeerLike {
  addTransceiver(track: TrackLike, init: { direction: "sendonly"; streams?: StreamLike[] }): TransceiverLike;
  createOffer(): Promise<SdpLike>;
  createAnswer(): Promise<SdpLike>;
  setLocalDescription(d: SdpLike): Promise<void>;
  setRemoteDescription(d: SdpLike): Promise<void>;
  setConfiguration?(c: { iceServers: unknown[] }): void;
  close(): void;
}

export interface RtcLike {
  createPeer(c: { iceServers: unknown[]; bundlePolicy: "max-bundle" }): PeerLike;
  getMicrophone(): Promise<StreamLike>;
}

export interface CallAudioApi {
  join(offer: SdpLike, mid: string): Promise<{ sessionId: string; answer: SdpLike | null; iceServers: unknown[] }>;
  pull(sessionId: string, userIds: string[]): Promise<{ offer: SdpLike | null; tracks: { userId: string; mid: string | null }[] }>;
  renegotiate(sessionId: string, answer: SdpLike): Promise<void>;
  leave(): Promise<void>;
}

export type CallAudioState = "idle" | "connecting" | "on" | "failed" | "ended";

const STUN = [{ urls: ["stun:stun.cloudflare.com:3478"] }];

/**
 * The browser's WebRTC: the microphone (asked once, on the tap that joins the audio), and every remote track played
 * through an <audio> element of this page only (never recorded). Null where the browser has none.
 */
export function browserRtc(): RtcLike | null {
  if (typeof window === "undefined" || typeof window.RTCPeerConnection !== "function" || !navigator.mediaDevices?.getUserMedia) return null;
  return {
    createPeer: (c) => {
      const pc = new RTCPeerConnection(c as RTCConfiguration);
      const players: HTMLAudioElement[] = [];
      pc.ontrack = (e) => {
        const a = new Audio();
        a.autoplay = true;
        a.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        void a.play().catch(() => undefined);
        players.push(a);
      };
      const close = pc.close.bind(pc);
      return Object.assign(pc as unknown as PeerLike, {
        close: () => {
          for (const a of players) a.srcObject = null;
          close();
        },
        setConfiguration: (cfg: { iceServers: unknown[] }) =>
          pc.setConfiguration({ ...pc.getConfiguration(), iceServers: cfg.iceServers as RTCIceServer[] }),
      });
    },
    getMicrophone: async () =>
      (await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })) as unknown as StreamLike,
  };
}

export class CallAudio {
  state: CallAudioState = "idle";
  muted = false;
  private peer: PeerLike | null = null;
  private mic: StreamLike | null = null;
  private sessionId: string | null = null;
  /** People whose track this session already pulls. */
  private pulled = new Set<string>();
  private busy: Promise<void> = Promise.resolve();

  constructor(
    private rtc: RtcLike,
    private api: CallAudioApi,
    private onState: (s: CallAudioState) => void = () => {},
  ) {}

  private set(s: CallAudioState) {
    this.state = s;
    this.onState(s);
  }

  /** Publishes the microphone. Throws the API's refusal (409 `reason`) to the caller; the board goes on. */
  async start(): Promise<void> {
    if (this.state === "connecting" || this.state === "on") return;
    this.set("connecting");
    try {
      this.mic = await this.rtc.getMicrophone();
      const track = this.mic.getAudioTracks()[0];
      if (!track) throw new Error("no microphone");
      this.peer = this.rtc.createPeer({ iceServers: STUN, bundlePolicy: "max-bundle" });
      const tx = this.peer.addTransceiver(track, { direction: "sendonly", streams: [this.mic] });
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      const r = await this.api.join(offer, tx.mid ?? "0");
      this.sessionId = r.sessionId;
      if (r.iceServers?.length) this.peer.setConfiguration?.({ iceServers: r.iceServers });
      if (r.answer) await this.peer.setRemoteDescription(r.answer);
      track.enabled = !this.muted;
      this.set("on");
    } catch (e) {
      this.teardown();
      this.set("failed");
      throw e;
    }
  }

  /**
   * Hears the people in the audio (from the board: `audio: true`, not me). New ones are pulled in one go; someone who
   * left the audio is forgotten, so a later return is pulled again (their session is new).
   */
  sync(inAudio: readonly string[]): Promise<void> {
    const run = this.busy.then(async () => {
      if (this.state !== "on" || !this.peer || !this.sessionId) return;
      for (const id of [...this.pulled]) if (!inAudio.includes(id)) this.pulled.delete(id);
      const fresh = inAudio.filter((id) => !this.pulled.has(id));
      if (!fresh.length) return;
      const r = await this.api.pull(this.sessionId, fresh);
      for (const t of r.tracks) this.pulled.add(t.userId);
      if (r.offer) {
        await this.peer.setRemoteDescription(r.offer);
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        await this.api.renegotiate(this.sessionId, answer);
      }
    });
    this.busy = run.catch(() => undefined);
    return run;
  }

  setMuted(m: boolean) {
    this.muted = m;
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = !m;
  }

  /** Hangs up (the board goes on). */
  async stop(): Promise<void> {
    const had = !!this.sessionId;
    this.teardown();
    this.set("ended");
    if (had) await this.api.leave().catch(() => undefined);
  }

  private teardown() {
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    this.mic = null;
    this.peer?.close();
    this.peer = null;
    this.sessionId = null;
    this.pulled.clear();
  }
}
