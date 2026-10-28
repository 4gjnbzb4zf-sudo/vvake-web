"use client";
/* eslint-disable react-hooks/refs, react-hooks/purity -- the session engine (game-core CameraWorkoutEngine) is a mutable object fed by pose frames outside React; the screen reads it on each render, re-rendered by a 250 ms tick and by every frame, as the phone screen does. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";
import { localTz, type UploadReply } from "@/lib/webapp/api";
import { playQuick, hush, prefetchSpeech, sayLine, unlockAudio, warmCamera, warmVoice } from "@/lib/webapp/coachAudio";
import { cameraLikelyLines } from "@/lib/webapp/voiceLikely";
import { flowSpeech, type CoachSpeech } from "@/lib/webapp/appVoice";
import { canListen, listen } from "@/lib/webapp/voice";
import { bleSupport } from "@/lib/webapp/ble";
import { zoneOf } from "@/lib/webapp/heart";
import { heartForSport } from "@/lib/webapp/sportHeart";
import { enqueue } from "@/lib/webapp/store";
import { SAMPLE_EVERY_S, spend, uuid, type Sample, type WebSession } from "@/lib/webapp/workout";
import {
  betterLine,
  cueLine,
  FormCoach,
  FRAMING_NOTE,
  FRAMING_TEXT,
  FRAMING_TIP_TEXT,
  FRAMING_VOICE,
  FramingVoice,
  framingLine,
  CuePacer,
  sayCues,
} from "@/lib/webapp/camera/cameraCues";
import { LIVENESS_TEXT, type LivenessKind } from "@/lib/webapp/camera/cameraLiveness";
import { lookalikes } from "@/lib/webapp/camera/cameraDetect";
import {
  CAMERA_MOVES,
  cameraMove,
  isOwnMove,
  EQUIPMENT_NAMES,
  FAMILY_NAMES,
  type MoveDef,
  type MoveFamily,
} from "@/lib/webapp/camera/cameraMoves";
import { demoFrameAt, demoLoop, moveTip, targetText, type DemoLoop, type DemoProp } from "@/lib/webapp/camera/cameraDemo";
import { planOverview, setRoundLine } from "@/lib/webapp/camera/cameraPlan";
import {
  applyLoads,
  CAMERA_VOICE_HELP,
  cameraVoiceAction,
  flowLine,
  flowPlan,
  HandsFreeWorkout,
  manualSetMs,
  plannedName,
  PromptVoice,
  repLine,
  trackingNotes,
  weightedMoves,
  type CameraVoiceAction,
  type FlowEvent,
  type SetNote,
} from "@/lib/webapp/camera/cameraFlow";
import { easierOf, moveTips, positionLine, promptLine, setIntro } from "@/lib/webapp/camera/cameraPrep";
import { moveSetup, setupLine, type ReadyPrompt, type ReadyReport } from "@/lib/webapp/camera/cameraReady";
import { cameraTotals, cameraVolumeKg, type CameraSummary } from "@/lib/webapp/camera/cameraPoints";
import { CameraHeart, clockText, heartSourceLabel, heartZoneLabel, holdText, type CameraHeartStats } from "@/lib/webapp/camera/cameraHeart";
import {
  bigNumberFallback,
  bigNumberPx,
  hasStrapHeart,
  middleFitPx,
  shortScreenCap,
  zoneBars,
  zoneTone,
} from "@/lib/webapp/camera/webHeart";
import { seen, type BodyArea, type Framing, type FramingTip, type Joint, type PoseFrame } from "@/lib/webapp/camera/cameraPose";
import { CAMERA_ROUTINES, routineForPlan, type CameraRoutine } from "@/lib/webapp/camera/cameraSession";
import { createPoseDetector, type PoseDetector } from "@/lib/webapp/camera/landmarker";
import { cameraPointsPreview, cameraSessionEmpty, strapSample, toWebCameraSession } from "@/lib/webapp/camera/webCameraSession";
import {
  analysisFps,
  detectAverage,
  frameFromLandmarks,
  kgToUnits,
  loadToKg,
  loadUnit,
  motionBetween,
  restClock,
  rngFrom,
  toView,
} from "@/lib/webapp/camera/webPose";
import {
  browserKind,
  browserSupport,
  deniedHelp,
  errorState,
  forCamera,
  initialState,
  autoSaveLeft,
  loadCameraLoads,
  loadOutlinePref,
  saveCameraLoads,
  OUTLINE_FADE_MS,
  OutlineClock,
  previewHint,
  saveOutlinePref,
  Steady,
  type CameraSetupState,
} from "@/lib/webapp/camera/webSetup";
import { addCustomMoves, cleanCustomMove, registerCustomMoves, type CustomMove } from "@/lib/webapp/camera/cameraCustom";
import {
  trainingRoutine,
  trainingRun,
  ZoneCuePacer,
  zoneFeel,
  zoneLine,
  type Training,
  type TrainingRun,
} from "@/lib/webapp/camera/cameraTraining";
import { getTrainingsDict } from "@/i18n/trainings";
import { trainingsApi } from "@/lib/trainings/api";
import { setRows as setRowsOf, type RunReply } from "@/lib/trainings/data";
import { useApp } from "./AppContext";
import { FeelAfter } from "./Suggest";
import { TeachMove } from "./TeachMove";
import { Btn, Card, Kicker, List, Note, Row, Small, Toggle } from "./ui";

/**
 * Camera workout in the browser (the phone's app/camera-workout.tsx, monorepo apps/mobile; ADR-0046 amendment
 * 2026-10-21): the computer's webcam (or a phone browser's camera) 2–3 m away, the pose read in this tab by MediaPipe
 * (camera/landmarker.ts, served by vvake.com), reps and holds counted by the phone's own rules (camera/*.ts, copied
 * from game-core), form cues by the coach's voice, sets and rests, quick liveness checks during rest, then the
 * session uploaded as counts only. The video never leaves the tab and nothing is recorded.
 *
 * Phases: setup (the camera step first: explained, asked, a live mirrored preview with the framing guide; then a
 * routine, a move, or "just start moving") → overview (a plan: the whole workout before it starts, where the camera
 * goes, Start; camera v3, 2026-10-27) → live (planned sets end at their target or on your Finish set, never by a
 * pause; "Done with this set?" after a long quiet stretch; "Set 2 of 3 · Round 1 of 2") → summary (save or discard). The webcam stays on from setup to the
 * end (one permission prompt). Framing tips are written on screen; the voice says one positioning line at the start
 * and at most one reminder 20 s later. The body outline shows 35 s, then fades (Show outline brings it back).
 */

type Phase = "setup" | "overview" | "live" | "summary";
type Plan = { routine: CameraRoutine | null; move: string | null };
interface FramingShown {
  framing: Framing;
  missing: BodyArea[];
  tips: FramingTip[];
}

const BONES: [Joint, Joint][] = [
  ["lShoulder", "rShoulder"],
  ["lShoulder", "lElbow"],
  ["lElbow", "lWrist"],
  ["rShoulder", "rElbow"],
  ["rElbow", "rWrist"],
  ["lShoulder", "lHip"],
  ["rShoulder", "rHip"],
  ["lHip", "rHip"],
  ["lHip", "lKnee"],
  ["lKnee", "lAnkle"],
  ["rHip", "rKnee"],
  ["rKnee", "rAnkle"],
];

// ── The webcam and the pose (one for the whole screen: the stream survives setup → live) ────────────────────────

type PoseListener = (f: PoseFrame | null, now: number) => void;

function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraSetupState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cameras, setCameras] = useState(0);
  const [running, setRunning] = useState(false);
  const [slow, setSlow] = useState(false);
  const [asking, setAsking] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const detector = useRef<PoseDetector | null>(null);
  const listener = useRef<PoseListener | null>(null);
  const startedAt = useRef<number | null>(null);
  const lastFrameAt = useRef<number | null>(null);
  const lastPersonAt = useRef<number | null>(null);
  const paused = useRef(false);

  const stopStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  const loading = useRef(false);
  const gone = useRef(false);
  const loadModel = useCallback(() => {
    if (detector.current || loading.current) return;
    loading.current = true;
    setModel("loading");
    createPoseDetector()
      .then((d) => {
        if (gone.current) return d.close();
        detector.current = d;
        setModel("ready");
      })
      .catch(() => setModel("error"))
      .finally(() => {
        loading.current = false;
      });
  }, []);

  const start = useCallback(
    async (face: "user" | "environment" = facing) => {
      setAsking(true);
      setError(null);
      try {
        stopStream();
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: face, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        });
        stream.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        startedAt.current = Date.now();
        lastFrameAt.current = null;
        setState("ready");
        setRunning(true);
        loadModel();
        void navigator.mediaDevices
          .enumerateDevices()
          .then((d) => setCameras(d.filter((x) => x.kind === "videoinput").length))
          .catch(() => undefined);
      } catch (e) {
        const st = errorState(e);
        setState(st);
        if (st === "error") setError(e instanceof Error ? e.message : String(e));
      } finally {
        setAsking(false);
      }
    },
    [facing, loadModel, stopStream],
  );

  // Before asking: what this browser can do and what it already allowed.
  useEffect(() => {
    let gone = false;
    void (async () => {
      const support = browserSupport({
        secure: window.isSecureContext,
        mediaDevices: !!navigator.mediaDevices?.getUserMedia,
        wasm: typeof WebAssembly === "object",
      });
      let permission: string | null = null;
      try {
        permission = (await navigator.permissions?.query({ name: "camera" as PermissionName }))?.state ?? null;
      } catch {
        permission = null;
      }
      let count: number | null = null;
      try {
        const d = await navigator.mediaDevices?.enumerateDevices();
        // Before the permission some browsers list nothing: only an allowed camera list is trusted to be empty.
        count = d ? d.filter((x) => x.kind === "videoinput").length : null;
        if (count === 0 && permission !== "granted") count = null;
      } catch {
        count = null;
      }
      if (gone) return;
      const st = initialState({ support, permission, cameras: count });
      setState(st === "ready" ? "checking" : st);
      if (st === "ready") void start("user");
      if (support === "ok") loadModel();
    })();
    return () => {
      gone = true;
    };
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      gone.current = true;
      stopStream();
      detector.current?.close();
      detector.current = null;
    },
    [stopStream],
  );

  // The <video> on screen (setup's card, then live's full screen): the stream follows it.
  const attach = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideo(el);
    if (el && stream.current && el.srcObject !== stream.current) {
      el.srcObject = stream.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  // The analysis loop: on each video frame, at most `fps` a second (fewer when you hold still or the machine is slow).
  useEffect(() => {
    const v = video;
    if (!running || model !== "ready" || !v) return;
    let stop = false;
    let last = 0;
    let avg = 0;
    let still = Date.now();
    let prev: PoseFrame | null = null;
    let fps = 15;
    // requestVideoFrameCallback where the browser has it (one analysis per new picture), else animation frames.
    const rvfc = "requestVideoFrameCallback" in v;
    let handle = 0;
    const schedule = () => {
      if (stop) return;
      handle = rvfc ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    };
    const tick = () => {
      if (stop) return;
      const t = performance.now();
      if (!paused.current && document.visibilityState === "visible" && t - last >= 1000 / fps && detector.current) {
        last = t;
        let lms = null;
        try {
          lms = detector.current.detect(v, t);
        } catch {
          lms = null;
        }
        avg = detectAverage(avg, performance.now() - t);
        const now = Date.now();
        const f = frameFromLandmarks(0, v.videoWidth || 640, v.videoHeight || 480, lms, facing === "user");
        lastFrameAt.current = now;
        if (f) lastPersonAt.current = now;
        if (!f || motionBetween(prev, f) > 0.012) still = now;
        prev = f;
        fps = analysisFps({ stillMs: now - still, detectMs: avg });
        setSlow(avg > 70);
        listener.current?.(f, now);
      }
      schedule();
    };
    schedule();
    return () => {
      stop = true;
      if (rvfc) v.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };
  }, [running, model, facing, video]);

  const flip = useCallback(() => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    void start(next);
  }, [facing, start]);

  return {
    attach,
    state,
    error,
    model,
    facing,
    mirrored: facing === "user",
    cameras,
    running,
    slow,
    asking,
    start,
    flip,
    retryModel: () => {
      detector.current = null;
      loadModel();
    },
    retry: () => void start(),
    setListener: (l: PoseListener | null) => {
      listener.current = l;
    },
    setPaused: (p: boolean) => {
      paused.current = p;
    },
    times: { startedAt, lastFrameAt, lastPersonAt },
  };
}
export type Webcam = ReturnType<typeof useWebcam>;

// ── The screen ──────────────────────────────────────────────────────────────────────────────────────────────────

interface LiveResult {
  summary: CameraSummary;
  startedAt: number;
  endedAt: number;
  activeS: number;
  sport: string;
  strap: Sample[];
  /** The strap's heart effort over the session (cameraHeart.ts), null without two readings. */
  heart: CameraHeartStats | null;
  /** The loads used per move (the last ones remembered in this browser, editable on the summary). */
  loads: Record<string, number>;
  /** How each set was tracked (cameraFlow.ts SetNote): the summary's Tracking card. */
  notes: SetNote[];
}

/** A custom training run from its page or a share link (ADR-0047): its sets, its custom moves, the challenge if any. */
export interface TrainingToRun {
  training: Training;
  code: string | null;
  challenge?: string | null;
}

export function CameraScreen({ sport, training, teach }: { sport?: string; training?: TrainingToRun; teach?: boolean }) {
  const cam = useWebcam();
  const { session } = useApp();
  const [phase, setPhase] = useState<Phase>("setup");
  // The moves this session can count: the training's taught moves at once, mine (GET /v1/moves) as they arrive, so
  // a set of a custom move and "just start moving" count them like catalogue moves (game-core cameraCustom.ts).
  const [, setMovesReady] = useState(() => {
    registerCustomMoves(training?.training.moves ?? []);
    return false;
  });
  useEffect(() => {
    let alive = true;
    void trainingsApi(session)
      .myMoves()
      .then((list) => {
        if (!alive) return;
        addCustomMoves(list.map(cleanCustomMove).filter((m): m is CustomMove => !!m));
        setMovesReady(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [session]);
  const [plan, setPlan] = useState<Plan>(() => ({
    routine: training ? trainingRoutine(training.training) : sport ? routineForPlan(sport, 20, true) : null,
    move: null,
  }));
  const [result, setResult] = useState<LiveResult | null>(null);
  const [outlineOn, setOutlineOnState] = useState(() => (typeof window === "undefined" ? true : loadOutlinePref()));
  const outline = useRef<OutlineClock | null>(null);
  outline.current ??= new OutlineClock(outlineOn);
  const setOutlineOn = (v: boolean) => {
    setOutlineOnState(v);
    saveOutlinePref(v);
    outline.current!.setAuto(v, Date.now());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-night">
      {/* One <video> for the whole screen: setup shows it in a card, live full screen. */}
      {teach && (
        <TeachMove
          cam={cam}
          check={<CameraCheck cam={cam} outline={outline.current} outlineOn={outlineOn} setOutlineOn={setOutlineOn} />}
          preview={(frame, children) => (
            <Preview cam={cam} frame={frame} outlineVisible className="aspect-[3/4] w-full rounded-2xl sm:aspect-video">
              {children}
            </Preview>
          )}
        />
      )}
      {!teach && phase === "setup" && (
        <Setup
          training={training}
          cam={cam}
          plan={plan}
          setPlan={setPlan}
          outline={outline.current}
          outlineOn={outlineOn}
          setOutlineOn={setOutlineOn}
          onStart={() => setPhase(plan.routine?.sets.length ? "overview" : "live")}
        />
      )}
      {/* A plan: all of it before it starts (tester report 2026-10-27: the second round came as a surprise). */}
      {!teach && phase === "overview" && plan.routine && (
        <Overview routine={plan.routine} onBack={() => setPhase("setup")} onStart={() => setPhase("live")} />
      )}
      {!teach && phase === "live" && (
        <Live
          cam={cam}
          plan={plan}
          outline={outline.current}
          outlineOn={outlineOn}
          setOutlineOn={setOutlineOn}
          onDone={(r) => {
            setResult(r);
            setPhase("summary");
          }}
        />
      )}
      {!teach && phase === "summary" && result && <Summary result={result} training={training} />}
    </div>
  );
}

/** The webcam picture with the framing guide and the fading outline, filling its box. */
function Preview({
  cam,
  frame,
  outlineVisible,
  className,
  children,
}: {
  cam: Webcam;
  frame: PoseFrame | null;
  outlineVisible: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={cn("relative overflow-hidden bg-black", className)}>
      <video
        ref={cam.attach}
        playsInline
        muted
        autoPlay
        aria-hidden
        className={cn("absolute inset-0 h-full w-full object-cover", cam.mirrored && "-scale-x-100")}
      />
      <Outline frame={frame} width={size.width} height={size.height} visible={outlineVisible} />
      {children}
    </div>
  );
}

function Outline({ frame, width, height, visible }: { frame: PoseFrame | null; width: number; height: number; visible: boolean }) {
  const lines = useMemo(() => {
    if (!frame || !width || !height) return null;
    const at = (j: Joint) => toView(frame.joints[j]!, frame, { width, height });
    const bones = BONES.filter(([a, b]) => seen(frame, a) && seen(frame, b)).map(([a, b]) => ({ k: `${a}-${b}`, p: at(a), q: at(b) }));
    const dots = (Object.keys(frame.joints) as Joint[])
      .filter((j) => seen(frame, j) && !j.endsWith("Eye") && !j.endsWith("Ear"))
      .map((j) => ({ k: j, p: at(j) }));
    return { bones, dots };
  }, [frame, width, height]);
  return (
    <svg
      width={width}
      height={height}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${visible ? 250 : OUTLINE_FADE_MS}ms ease` }}
    >
      {lines?.bones.map((b) => (
        <line
          key={b.k}
          x1={b.p.x}
          y1={b.p.y}
          x2={b.q.x}
          y2={b.q.y}
          stroke="var(--color-volt, #d4ff3a)"
          strokeOpacity={0.8}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
      {lines?.dots.map((d) => (
        <circle key={d.k} cx={d.p.x} cy={d.p.y} r={4} fill="var(--color-volt, #d4ff3a)" />
      ))}
    </svg>
  );
}

function FramingTips({ shown, compact, lang }: { shown: FramingShown; compact?: boolean; lang: Locale }) {
  const ok = shown.framing === "ok";
  const tips = shown.tips.slice(0, compact ? 1 : 2);
  if (ok && !tips.length) return null;
  return (
    <div role="status" className={cn("rounded-xl px-3 py-2 text-center", ok ? "bg-volt/90 text-ink" : "bg-black/80 text-white")}>
      {!ok && (
        <p className={cn("font-semibold", compact ? "text-sm" : "text-[15px]")}>
          {forCamera(framingLine({ state: shown.framing, missing: shown.missing }, lang), lang)}
        </p>
      )}
      {tips.map((tip) => (
        <p key={tip} className={cn("text-[13px]", ok ? "text-ink" : "text-white/85")}>
          {forCamera(FRAMING_TIP_TEXT[tip][lang], lang)}
        </p>
      ))}
    </div>
  );
}

function StateCard({ tone, title, children }: { tone?: "pulse" | "butter" | "volt"; title: string; children: ReactNode }) {
  return (
    <Card tone={tone}>
      <p className="font-display text-lg font-semibold">{title}</p>
      <div className="mt-2 space-y-3">{children}</div>
    </Card>
  );
}

/** Re-renders twice a second (clocks, the outline's timer, the steady framing line). */
function useTick(ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

// ── Setup ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The whole workout before Start: where the camera goes once, the order, sets × reps or time, the last load, the
 * rounds, the rests, about how long (camera/cameraPlan.ts planOverview, the phone's overview). */
function Overview({ routine, onBack, onStart }: { routine: CameraRoutine; onBack: () => void; onStart: () => void }) {
  const { t, lang, fmt, prefs } = useApp();
  const c = t.camera;
  const o = useMemo(() => planOverview(routine.sets, lang, loadCameraLoads()), [routine, lang]);
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]">
      <button type="button" className="h-11 text-sm text-muted" onClick={onBack}>
        ‹ {t.common.back}
      </button>
      <Kicker tone="volt">{c.yourWorkout}</Kicker>
      <h1 className="font-display text-2xl font-bold">{routine.name[lang]}</h1>
      <p className="text-muted">{fmt(c.aboutMin, { min: o.minutes, sets: o.totalSets })}</p>
      {o.placement.line ? <Note tone="sky">{forCamera(o.placement.line, lang)}</Note> : null}
      {o.blocks.map((b, bi) => (
        <div key={bi} className="space-y-2">
          <Kicker tone="sky">
            {b.rounds > 1 ? fmt(c.roundsOf, { n: b.rounds }) : o.blocks.length > 1 ? c.straightSets : c.inThisOrder}
          </Kicker>
          <List>
            {b.items.map((it, i) => (
              <Row
                key={`${it.move}-${i}`}
                icon={String(i + 1)}
                title={it.name}
                detail={[
                  it.sets > 1 ? `${it.sets} × ${it.target}` : it.target,
                  it.loadKg ? `${kgToUnits(it.loadKg, prefs.units)} ${loadUnit(prefs.units)}` : "",
                  fmt(c.restN, { n: it.restS }),
                  it.easier ? c.easierShort : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </List>
          {b.rounds > 1 && <Small>{fmt(c.sameAgain, { n: b.rounds })}</Small>}
        </div>
      ))}
      <Btn
        big
        variant="volt"
        className="w-full"
        onClick={() => {
          unlockAudio();
          onStart();
        }}
      >
        ▶ {c.start}
      </Btn>
    </div>
  );
}

function Setup({
  training,
  cam,
  plan,
  setPlan,
  outline,
  outlineOn,
  setOutlineOn,
  onStart,
}: {
  training?: TrainingToRun;
  cam: Webcam;
  plan: Plan;
  setPlan: (p: Plan) => void;
  outline: OutlineClock;
  outlineOn: boolean;
  setOutlineOn: (v: boolean) => void;
  onStart: () => void;
}) {
  const { t, lang, go, fmt } = useApp();
  const c = t.camera;
  const [picking, setPicking] = useState(false);
  const chosen = plan.move ? cameraMove(plan.move) : null;
  const ready = cam.state === "ready" && cam.running && cam.model === "ready";

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]">
      <button
        type="button"
        className="h-11 text-sm text-muted"
        onClick={() =>
          go(
            training
              ? {
                  name: "training",
                  ref: training.code ?? training.training.id,
                  ...(training.challenge ? { challenge: training.challenge } : {}),
                }
              : { name: "workout" },
          )
        }
      >
        ‹ {t.common.back}
      </button>
      <Kicker tone="volt">{c.kicker}</Kicker>
      <h1 className="font-display text-2xl font-bold">{training ? training.training.name : c.title}</h1>
      <p className="text-muted">{c.lead}</p>
      {training && <TrainingSetsCard training={training.training} />}

      <Kicker tone="sky">{c.step1}</Kicker>
      <CameraCheck cam={cam} outline={outline} outlineOn={outlineOn} setOutlineOn={setOutlineOn} />

      <Kicker tone="sky">{c.step2}</Kicker>
      <div className="space-y-2">
        <Choice
          on={!plan.routine && !plan.move}
          title={c.justMove}
          detail={c.justMoveDetail}
          onClick={() => setPlan({ routine: null, move: null })}
        />
        <Choice
          on={!!chosen}
          title={chosen ? chosen.name[lang] : c.pickMove}
          detail={chosen ? `${c.judge[chosen.judge]} · ${placement(chosen, c)}` : c.pickMoveDetail}
          onClick={() => setPicking(true)}
        />
      </div>
      <Kicker tone="sky">{c.routines}</Kicker>
      <div className="space-y-2">
        {[...(plan.routine && !CAMERA_ROUTINES.some((r) => r.id === plan.routine!.id) ? [plan.routine] : []), ...CAMERA_ROUTINES].map(
          (r) => (
            <Choice
              key={r.id}
              on={plan.routine?.id === r.id}
              title={r.name[lang]}
              detail={fmt(c.minSets, { min: r.minutes, sets: r.sets.length })}
              onClick={() => setPlan({ routine: r, move: null })}
            />
          ),
        )}
      </div>
      <Small>{c.pointsRule}</Small>
      {bleSupport() === "ok" && <Small>{c.strapHint}</Small>}
      <Small>{c.handsFree}</Small>
      <Btn
        big
        variant="volt"
        className="w-full"
        disabled={!ready}
        onClick={() => {
          // The Start tap unlocks the page's audio (Safari) and warms the coach's recorded voice.
          unlockAudio();
          void warmVoice();
          void warmCamera();
          // Plus: the session's demos and rests made in the coach's voice before the first one is said.
          void prefetchSpeech(cameraLikelyLines(flowPlan(plan), lang));
          onStart();
        }}
      >
        {c.start}
      </Btn>
      {!ready && <Small className="text-center">{c.startHint}</Small>}
      {picking && (
        <MovePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPlan({ routine: null, move: id });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/** Where the camera goes: the angles the move is counted from (cameraReady.ts moveSetup; push-ups and lunges count
 * facing the camera too), else the move's own view. */
const placement = (m: MoveDef, c: { placeSide: string; placeFront: string; placeEither: string }) => {
  const v = moveSetup(m).views;
  const view = v.length > 1 ? "either" : (v[0] ?? m.view);
  return view === "side" ? c.placeSide : view === "front" ? c.placeFront : c.placeEither;
};

function Choice({ on, title, detail, onClick }: { on: boolean; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-surface px-4 py-2 text-left",
        on ? "border-volt-fg" : "border-line hover:border-muted/60",
      )}
    >
      <span className="flex-1">
        <span className="block font-display font-semibold">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
      {on && (
        <span aria-hidden className="text-volt-fg">
          ✓
        </span>
      )}
    </button>
  );
}

/**
 * The camera step: explains and asks (the reason first, then the browser's prompt), then the live preview with the
 * framing guide and the outline. Every other case says what's wrong and what to do; never a blank box.
 */
function CameraCheck({
  cam,
  outline,
  outlineOn,
  setOutlineOn,
}: {
  cam: Webcam;
  outline: OutlineClock;
  outlineOn: boolean;
  setOutlineOn: (v: boolean) => void;
}) {
  const { t, lang, go } = useApp();
  const c = t.camera;
  const now = useTick();
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const steady = useRef(new Steady<FramingShown | string>());
  useEffect(() => {
    cam.setListener((f, at) => {
      outline.track(at, !!f);
      setFrame(f);
    });
    return () => cam.setListener(null);
  }, [cam, outline]);
  const heartOnly = () => go({ name: "workout" });

  if (cam.state === "unsupported" || cam.state === "insecure")
    return (
      <StateCard tone="butter" title={cam.state === "insecure" ? c.insecureTitle : c.unsupportedTitle}>
        <p className="text-sm">{cam.state === "insecure" ? c.insecureBody : c.unsupportedBody}</p>
        <Btn variant="ghost" onClick={heartOnly}>
          {c.heartInstead}
        </Btn>
      </StateCard>
    );
  if (cam.state === "no_camera")
    return (
      <StateCard tone="butter" title={c.noCameraTitle}>
        <p className="text-sm">{c.noCameraBody}</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={cam.retry}>
            {c.tryAgain}
          </Btn>
          <Btn variant="ghost" onClick={heartOnly}>
            {c.heartInstead}
          </Btn>
        </div>
      </StateCard>
    );
  if (cam.state === "checking")
    return (
      <StateCard title={c.checking}>
        <p role="status" className="text-sm text-muted">
          {t.common.loading}
        </p>
      </StateCard>
    );
  if (cam.state === "ask")
    return (
      <StateCard tone="volt" title={c.askTitle}>
        <p className="text-sm">{c.askBody}</p>
        <Small>{c.askNext}</Small>
        <Btn variant="volt" onClick={() => void cam.start()} disabled={cam.asking}>
          {cam.asking ? c.asking : c.allow}
        </Btn>
      </StateCard>
    );
  if (cam.state === "denied")
    return (
      <StateCard tone="pulse" title={c.deniedTitle}>
        <p className="text-sm">{c.deniedBody}</p>
        <p className="text-sm font-semibold">{deniedHelp(browserKind(navigator.userAgent), lang)}</p>
        <Btn variant="ghost" onClick={cam.retry}>
          {c.tryAgain}
        </Btn>
      </StateCard>
    );
  if (cam.state === "error")
    return (
      <StateCard tone="pulse" title={c.errorTitle}>
        <p className="text-sm">{c.errorBody}</p>
        {cam.error && <Small>{cam.error}</Small>}
        <Btn variant="ghost" onClick={cam.retry}>
          {c.tryAgain}
        </Btn>
      </StateCard>
    );

  // Ready: the preview.
  const hint = previewHint({
    startedAt: cam.times.startedAt.current,
    lastFrameAt: cam.times.lastFrameAt.current,
    lastPersonAt: cam.times.lastPersonAt.current,
    frame,
    now,
  });
  const raw: FramingShown | string =
    cam.model === "error"
      ? c.modelError
      : cam.model !== "ready"
        ? c.loadingModel
        : hint.kind === "framing"
          ? { framing: hint.report.state, missing: hint.report.missing, tips: hint.report.tips }
          : hint.kind === "starting"
            ? c.starting
            : hint.kind === "no_frames"
              ? c.noFrames
              : c.nobody;
  const key = typeof raw === "string" ? raw : `${raw.framing}|${raw.missing.join()}|${raw.tips.join()}`;
  const shown = steady.current.next(raw, key, now);
  const ok = typeof shown !== "string" && shown.framing === "ok";
  const outlineVisible = outline.visible(now);

  return (
    <div className="space-y-2">
      <Preview cam={cam} frame={frame} outlineVisible={outlineVisible} className="aspect-[4/3] max-h-[60vh] w-full rounded-2xl">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-[18%] inset-y-[6%] rounded-2xl border-2 border-dashed",
            ok ? "border-volt" : "border-white/60",
          )}
        />
        {cam.cameras > 1 && (
          <button type="button" onClick={cam.flip} className="absolute top-2 right-2 h-10 rounded-full bg-black/60 px-3 text-sm text-white">
            ⟲ {c.switchCamera}
          </button>
        )}
        <div className="absolute inset-x-2 bottom-2">
          {typeof shown === "string" ? (
            <p role="status" className="rounded-xl bg-black/80 px-3 py-2 text-sm font-semibold text-white">
              {shown}
            </p>
          ) : ok && !shown.tips.length ? (
            <p role="status" className="rounded-xl bg-volt/90 px-3 py-2 text-sm font-semibold text-ink">
              {FRAMING_TEXT.ok[lang]}
            </p>
          ) : (
            <FramingTips shown={shown} compact lang={lang} />
          )}
        </div>
      </Preview>
      {cam.model === "error" && (
        <Btn variant="ghost" onClick={cam.retryModel}>
          {c.tryAgain}
        </Btn>
      )}
      {cam.slow && <Small className="text-butter-fg">{c.slow}</Small>}
      <Small>{FRAMING_NOTE[lang]}</Small>
      <OutlineControls on={outlineOn} setOn={setOutlineOn} visible={outlineVisible} onShow={() => outline.show(Date.now())} />
      <Small>{c.privacyLine}</Small>
    </div>
  );
}

function OutlineControls({
  on,
  setOn,
  visible,
  onShow,
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  visible: boolean;
  onShow: () => void;
}) {
  const { t } = useApp();
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold">{t.camera.outline}</p>
          <Small>{t.camera.outlineHint}</Small>
        </div>
        <Toggle on={on} onChange={setOn} label={t.camera.outline} />
      </div>
      {!visible && (
        <Btn variant="ghost" className="mt-3" onClick={onShow}>
          {t.camera.showOutline}
        </Btn>
      )}
    </Card>
  );
}

function MovePicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { t, lang } = useApp();
  const c = t.camera;
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<MoveFamily | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return CAMERA_MOVES.filter(
      (m) => (!family || m.family === family) && (!n || m.name.en.toLowerCase().includes(n) || m.name.fr.toLowerCase().includes(n)),
    );
  }, [q, family]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={c.pickTitle} className="fixed inset-0 z-[60] overflow-y-auto bg-night">
      <div className="mx-auto w-full max-w-xl space-y-3 pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]">
        <div className="flex items-center justify-between">
          <Kicker tone="volt">{c.pickTitle}</Kicker>
          <button type="button" className="h-11 px-2 text-sm text-muted" onClick={onClose}>
            {t.common.close}
          </button>
        </div>
        <input
          className="h-12 w-full rounded-xl border border-line bg-surface px-4"
          placeholder={c.search}
          aria-label={c.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {[null, ...(Object.keys(FAMILY_NAMES) as MoveFamily[])].map((f) => (
            <button
              key={f ?? "all"}
              type="button"
              aria-pressed={family === f}
              onClick={() => setFamily(f)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm",
                family === f ? "border-volt-fg text-volt-fg" : "border-line text-muted",
              )}
            >
              {f ? FAMILY_NAMES[f][lang] : c.all}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m.id)}
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:border-volt-fg"
              >
                <span className="block font-semibold">{m.name[lang]}</span>
                <span className="block text-sm text-muted">
                  {m.equipment.map((e) => EQUIPMENT_NAMES[e][lang]).join(", ")} · {c.judge[m.judge]} · {placement(m, c)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Live ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

/**
 * The live workout, hands-free (ADR-0046 amendment 2026-10-21; the phone's Live): HandsFreeWorkout (camera/cameraFlow.ts,
 * copied from game-core) runs it from the one click on Start: each new move's demo (full screen, twice), 3-2-1, the
 * count, the set ending by itself, the rest, the next set or move, the end. Readable from 2–3 m. Pause, End, ±1 and
 * the lookalike chips stay, never needed.
 */
function Live({
  cam,
  plan,
  outline,
  outlineOn,
  setOutlineOn,
  onDone,
}: {
  cam: Webcam;
  plan: Plan;
  outline: OutlineClock;
  outlineOn: boolean;
  setOutlineOn: (v: boolean) => void;
  onDone: (r: LiveResult) => void;
}) {
  const { t, lang, fmt, prefs, workoutVoice, sensor, sensorState, athlete, heartZones } = useApp();
  const c = t.camera;
  const units = prefs.units;
  const now = useTick(250);
  const [heartLine, setHeartLine] = useState<{ text: string; at: number } | null>(null);
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [framingNow, setFraming] = useState<FramingShown>({ framing: "none", missing: [], tips: [] });
  const [cue, setCue] = useState<string | null>(null);
  const [check, setCheck] = useState<{ kind: LivenessKind; at: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [nothing, setNothing] = useState(false);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  const started = useRef(Date.now());
  const flowRef = useRef<HandsFreeWorkout | null>(null);
  if (!flowRef.current) {
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    flowRef.current = new HandsFreeWorkout(started.current, rngFrom(seed[0]!), {
      routine: plan.routine,
      move: plan.move,
      loads: loadCameraLoads(),
    });
  }
  const flow = flowRef.current;
  const e = flow.engine;
  const pacer = useRef(new CuePacer());
  // Form cues after a rep, conservatively (cameraCues.ts FormCoach: only from reps seen surely, a fault on 2 of the
  // last 3, at most twice a set, and "Good depth now." once it's fixed).
  const formCoach = useRef(new FormCoach());
  // The get-ready and lost-tracking lines, said calmly (the screen always shows them).
  const promptVoice = useRef(new PromptVoice());
  // The rest's preview of the next move: replayed from here; hidden by "Skip preview".
  const [previewAt, setPreviewAt] = useState(0);
  const [hidePreview, setHidePreview] = useState(false);
  const framingVoice = useRef(new FramingVoice());
  const framingState = useRef<Framing>("none");
  const finished = useRef(false);
  // The strap paired in this browser (You > Heart-rate sensor): its heart rate every 10 s of the session, and live
  // (cameraHeart.ts: the bpm now, its zone from your zones for the sport, "no heart signal" after 15 s, the effort).
  const strap = useRef<Sample[]>([]);
  const lastBpm = useRef<{ v: number; at: number } | null>(null);
  // The sport's zones (yours, else automatic with its family's max: ADR-0048).
  const zonesRef = useRef(heartForSport(athlete?.health, e.sport(), heartZones));
  zonesRef.current = heartForSport(athlete?.health, e.sport(), heartZones);
  const heartRef = useRef<CameraHeart | null>(null);
  if (!heartRef.current) heartRef.current = new CameraHeart((b) => zoneOf(b, zonesRef.current));
  const heart = heartRef.current;
  // A custom training's target zone (ADR-0047): the zone feel on screen, a calm line said when it held 8 s.
  const zonePacer = useRef(new ZoneCuePacer());
  const [zoneSaid, setZoneSaid] = useState<{ text: string; at: number } | null>(null);
  useEffect(
    () =>
      sensor.subscribe((v, at) => {
        lastBpm.current = { v, at };
        heart.push("strap", v, at);
      }),
    [sensor, heart],
  );

  const voiceRef = useRef(workoutVoice);
  voiceRef.current = workoutVoice;
  // Every line in the coach's one voice (coachAudio.sayLine): recorded, else the browser voice for the whole line.
  const speak = useCallback((line: string | CoachSpeech | null, essential = false) => {
    if (!line) return;
    const m = voiceRef.current;
    if (m === "off" || (!essential && m !== "on")) return;
    sayLine(typeof line === "string" ? { text: line } : line);
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const t2 = Date.now();
    const summary = flow.summary(t2);
    const activeS = Math.round(e.sessionS(t2));
    hush();
    if (!summary || cameraSessionEmpty(activeS, summary)) {
      setNothing(true);
      return;
    }
    onDone({
      summary,
      startedAt: started.current,
      endedAt: t2,
      activeS,
      sport: e.sport(),
      strap: strap.current,
      heart: heart.stats(),
      loads: { ...flow.allLoads },
      notes: [...flow.notes],
    });
  }, [flow, e, onDone, heart]);

  /** What the flow said: the screen and the coach voice follow (`quiet`: a voice control already answers aloud). */
  const handle = useCallback(
    (evs: FlowEvent[], at: number, quiet = false) => {
      const say = (line: string | CoachSpeech | null, essential = false) => {
        if (!quiet) speak(line, essential);
      };
      // A prompt about the camera, said with "the camera" for "the phone" (the screen says the same).
      const sayPrompt = (line: string | null) => say(line ? forCamera(line, lang) : null, true);
      for (const x of evs) {
        switch (x.type) {
          case "framing":
            // On screen only: never read aloud during the workout.
            framingState.current = x.framing;
            setFraming({ framing: x.framing, missing: x.missing, tips: x.tips });
            break;
          case "rep": {
            const c1 = sayCues(voiceRef.current)
              ? formCoach.current.rep(at, { cues: x.cues, ...(x.quality ? { quality: x.quality } : {}) })
              : null;
            if (c1) {
              const line = c1.kind === "cue" ? cueLine(c1.id, e.set?.move ?? undefined, lang) : betterLine(c1.id, lang);
              setCue(line);
              say(line);
            } else {
              // Progress, not every rep: "10 of 15 done.", "Last one.", a cheer at halfway (tester report 2026-10-26).
              const line = repLine(x.n, flow.plan ? flow.target?.reps : undefined, voiceRef.current, lang, flow.idx);
              if (line && /^\d+$/.test(line)) {
                if (!quiet) playQuick(line);
              } else say(line, true);
            }
            break;
          }
          case "partial": {
            const c2 = sayCues(voiceRef.current) ? pacer.current.pick(at, ["depth"]) : null;
            if (c2) {
              const line = cueLine("depth", e.set?.move ?? undefined, lang);
              setCue(line);
              say(line);
            }
            break;
          }
          case "hold":
            if (x.s > 0 && x.s % 10 === 0) say(fmt(c.say.seconds, { n: x.s }), true);
            break;
          case "holdCue": {
            const c3 = sayCues(voiceRef.current) ? pacer.current.pick(at, x.cues) : null;
            if (c3) {
              const line = cueLine(c3, e.set?.move ?? undefined, lang);
              setCue(line);
              say(line);
            }
            break;
          }
          case "liveness":
            setCheck({ kind: x.kind, at });
            say(LIVENESS_TEXT[x.kind][lang], true);
            break;
          case "livenessResult":
            setCheck(null);
            say(x.result.ok ? c.say.thanks : c.say.missed, true);
            break;
          case "setup":
            promptVoice.current.newExercise();
            if (x.prompt && x.prompt !== "ready" && promptVoice.current.allow(x.prompt, at)) sayPrompt(flowLine(x, lang));
            break;
          case "readyPrompt":
            if (x.prompt && x.prompt !== "ready" && promptVoice.current.allow(x.prompt, at)) sayPrompt(flowLine(x, lang));
            break;
          case "ready":
          case "found":
            break;
          case "getReady":
            promptVoice.current.newExercise();
            sayPrompt(flowLine(x, lang));
            break;
          case "holdState":
            if (x.state === "paused") say(flowLine(x, lang), true);
            break;
          case "lost":
            if (promptVoice.current.allow(`lost:${x.prompt ?? ""}`, at)) sayPrompt(flowLine(x, lang));
            break;
          case "restChanged":
          case "swapped":
            say(flowLine(x, lang), true);
            break;
          case "rest":
            promptVoice.current.newExercise();
            setPreviewAt(at);
            setHidePreview(false);
            say(flowSpeech(x, lang), true);
            break;
          case "countdown":
            if (voiceRef.current !== "off" && !quiet) playQuick(String(x.n));
            break;
          case "go":
            promptVoice.current.newExercise();
            pacer.current = new CuePacer();
            formCoach.current.newSet();
            zonePacer.current = new ZoneCuePacer(); // a new set: the next line can be said again
            setCue(null);
            say(flowSpeech(x, lang), true);
            break;
          case "setEnd":
            setCue(null);
            say(flowSpeech(x, lang), true);
            break;
          case "askDone":
            // Never moves on by itself (2026-10-27): asks; the card offers Finish set / Keep going.
            say(flowLine(x, lang), true);
            break;
          case "keepGoing":
            break;
          case "round":
            // "Round 2 of 2: same moves again." (the screen shows "Set 1 of 3 · Round 2 of 2").
            say(flowLine(x, lang), true);
            break;
          case "restHeart": {
            // The rest follows the heart: said (in the voice mode) and shown under the rest timer for a few seconds.
            const line = flowLine(x, lang);
            if (line) setHeartLine({ text: line, at });
            say(line, true);
            break;
          }
          case "done":
            say(flowLine(x, lang), true);
            // The summary follows on its own (the voice says the last line first).
            window.setTimeout(finish, 1800);
            break;
          default:
            // The demo says short recorded parts ("Squat." "15 reps.").
            say(flowSpeech(x, lang), true);
        }
      }
    },
    [e, flow, lang, speak, fmt, c, finish, setPreviewAt, setHidePreview],
  );

  /** A control (tap or voice): what the flow did, shown and said. */
  const act = (evs: FlowEvent[], quiet = false) => {
    unlockAudio();
    handle(evs, Date.now(), quiet);
    bump();
  };

  // The one click was Start: from here the workout runs on its own. The one positioning line; audio off at the end.
  useEffect(() => {
    // A plan: where the camera goes for the whole workout, once (mixed standing and floor moves: one low spot).
    const place = flow.placement(lang);
    if (framingVoice.current.start(Date.now())) speak(place?.line ? forCamera(place.line, lang) : FRAMING_VOICE.start[lang], true);
    handle(flow.start(Date.now()), Date.now());
    return () => hush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The screen stays on (asked again when the page comes back).
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinelLike> } };
    let lock: WakeLockSentinelLike | null = null;
    const ask = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        lock = await nav.wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };
    void ask();
    const vis = () => void ask();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Strap samples, every 10 s of session time (not while paused).
  useEffect(() => {
    const id = window.setInterval(() => {
      const t2 = Date.now();
      if (e.paused) return;
      const s = Math.floor(e.sessionS(t2));
      const lastT = strap.current.length ? strap.current[strap.current.length - 1]!.t : 0;
      if (s >= lastT + SAMPLE_EVERY_S) strap.current.push(strapSample(lastT + SAMPLE_EVERY_S, lastBpm.current, t2));
    }, 1000);
    return () => window.clearInterval(id);
  }, [e]);

  const onPose = useCallback(
    (f0: PoseFrame | null, at: number) => {
      const f = f0 ? { ...f0, t: at - started.current } : null;
      outline.track(at, !!f);
      setFrame(f);
      const h = heart.now(at);
      flow.setHeart(h ? { bpm: h.bpm, zone: h.zone } : null, at);
      handle(flow.push(f, at), at);
      const zt = flow.phase === "set" ? flow.target?.zone : undefined;
      const feel = zonePacer.current.push(zt, h ? h.zone : null, at);
      if (feel && zt) {
        const line = zoneLine(zt, feel, lang);
        setZoneSaid({ text: line, at });
        speak(line, true);
      }
      if (framingVoice.current.push(at, framingState.current) === "remind") speak(FRAMING_VOICE.remind[lang], true);
    },
    [flow, outline, lang, speak, handle, heart],
  );

  useEffect(() => {
    cam.setListener(onPose);
    return () => cam.setListener(null);
  }, [cam, onPose]);

  const togglePause = (quiet = false) => {
    unlockAudio();
    if (paused) flow.resume(Date.now());
    else flow.pause(Date.now());
    cam.setPaused(!paused);
    setPaused(!paused);
    if (!quiet) speak(paused ? t.workout.resumed : t.workout.paused, true);
  };

  // Voice controls ("pause", "more rest", "skip", "I'm ready", "replay the demo", "easier"), where the browser can
  // listen (cameraFlow.ts cameraVoiceAction, the phone's words): one sentence per click on Voice, answered aloud.
  const [micOk] = useState(() => canListen());
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<{ text: string; at: number } | null>(null);
  const mic = useRef<{ stop(): void } | null>(null);
  useEffect(() => () => mic.current?.stop(), []);
  const voiceAction = (a: CameraVoiceAction): string => {
    const at = Date.now();
    const r = c.voiceReply;
    switch (a) {
      case "pause":
        if (!paused) togglePause(true);
        return r.paused;
      case "resume":
        if (flow.askingDone) {
          act(flow.keepGoing(at), true);
          return r.keepGoing;
        }
        if (paused) togglePause(true);
        return r.back;
      case "finish": {
        const ev = flow.finishSet(at);
        act(ev, true);
        return ev.length ? r.setDone : r.noSet;
      }
      case "more_rest": {
        const ev = flow.extendRest(15, at);
        act(ev, true);
        return (ev.length && flowLine(ev[0]!, lang)) || r.notResting;
      }
      case "skip": {
        const ev = flow.skip(at);
        act(ev, true);
        return ev.length || flow.phase !== "done" ? r.skipping : r.nothingToSkip;
      }
      case "start": {
        const ev = flow.startNow(at);
        act(ev, true);
        return ev.length ? r.go : r.going;
      }
      case "replay":
        if (flow.phase === "rest") {
          setPreviewAt(at);
          setHidePreview(false);
          return r.watch;
        }
        act(flow.replayDemo(at), true);
        return r.watch;
      case "easier": {
        const tg = flow.target;
        const ez = tg ? easierOf(tg.move, lang) : null;
        const ev = flow.swapEasier(at, lang);
        act(ev, true);
        if (ev.length) return flowLine(ev[0]!, lang) ?? r.watch;
        return ez ? ez.tip : r.noEasier;
      }
    }
  };
  const toggleListening = () => {
    unlockAudio();
    if (mic.current) {
      mic.current.stop();
      return;
    }
    let said = "";
    const h = listen(
      lang,
      (text, final) => {
        if (final) said = text;
      },
      () => {
        mic.current = null;
        setListening(false);
        if (!said) return;
        const a = cameraVoiceAction(said);
        const reply = a ? voiceAction(a) : `${c.voiceReply.unknown} ${CAMERA_VOICE_HELP[lang]}`;
        setHeard({ text: reply, at: Date.now() });
        speak(reply, true);
      },
    );
    if (h) {
      mic.current = h;
      setListening(true);
    }
  };

  const set = e.set;
  const move = set?.move ?? null;
  const phase = flow.phase;
  const target = flow.target;
  const middle = useRef<HTMLDivElement>(null);
  const [middleH, setMiddleH] = useState(0);
  const middleShown = phase !== "demo";
  useEffect(() => {
    const el = middle.current;
    if (!el) return;
    const measure = () => setMiddleH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [middleShown]);
  const targetDef = target ? (cameraMove(target.move) ?? null) : null;
  const sessionS = Math.floor(e.sessionS(now));
  const restLeft = phase === "rest" ? flow.phaseUntilMs - now : 0;
  const nextSet = flow.upNext;
  const nextDef = nextSet ? (cameraMove(nextSet.move) ?? null) : null;
  const switchTo = move && phase === "set" ? lookalikes(move.id) : [];
  const checkLeft = check ? Math.max(0, 6 - Math.floor((now - check.at) / 1000)) : 0;
  const outlineVisible = outline.visible(now);
  const setsSoFar = e.log.reduce((n, m) => n + m.sets.length, 0) + (e.state === "set" && (set?.reps || set?.holdS) ? 1 : 0);
  const so = flow.setOf();
  // "Set 2 of 3 · Round 1 of 2" (2026-10-27: the set and the round told apart).
  const setRound = flow.plan ? setRoundLine(so, flow.roundOf(), lang) : "";
  // The exact variation (its stance, where the weight is) and 1–2 cues, on the demo and Get ready.
  const intro = targetDef && target && !isOwnMove(targetDef.id) ? setIntro(targetDef.id, lang, target.label) : null;
  // A set that still ends 7 s after the last rep: "just start moving", or a move picked on its own (no target).
  const endsOnStop = flow.free || (move?.kind === "reps" && !target?.reps);
  const manualLeft = phase === "set" && move?.judge === "manual" ? manualSetMs(move, target) - (now - flow.phaseStartMs) : 0;
  const heartNow = heart.now(now);
  const heartSignal = heart.signal(now);
  const showHeart = heartSignal !== "none" || sensorState === "connected";
  const heartLineShown = heartLine && phase === "rest" && now - heartLine.at < 8000 ? heartLine.text : null;
  const demoLoopNo = Math.min(2, 1 + Math.floor((now - flow.phaseStartMs) / (flow.demo?.loopMs ?? 3000)));
  // The big number also fits the middle's height (between the controls and the heart tile), with room for its lines.
  const fit = (reserved: number) => middleFitPx(middleH, reserved);
  const ready = flow.readiness;
  // A planned hold the camera times: waiting for the position, holding, or paused by a real break.
  const hold = phase === "set" && move?.kind === "hold" && move.judge !== "manual" && !flow.free;
  const holdWaitS = hold && flow.holdState === "waiting" ? (now - flow.phaseStartMs) / 1000 : 0;
  const lost = phase === "set" && flow.lost?.shown ? flow.lost : null;
  const panel = phase === "setup" || phase === "rest";
  const heardShown = heard && now - heard.at < 5000 ? heard.text : null;

  if (nothing)
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4">
        <p className="font-display text-xl font-semibold">{c.nothing}</p>
        <p className="text-muted">{c.nothingBody}</p>
        <ExitButton />
      </div>
    );

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <Preview cam={cam} frame={frame} outlineVisible={outlineVisible && phase !== "demo"} className="min-h-0 flex-1">
        {/* The move's demo, full screen, played twice: watch, then it's your turn. */}
        {phase === "demo" && targetDef && (
          <div className="absolute inset-0 flex flex-col items-center justify-center-safe gap-2 overflow-y-auto bg-night px-4 pt-[calc(max(env(safe-area-inset-top),0.75rem)+4rem)] pb-6 text-center">
            <p className="text-sm font-semibold tracking-widest text-sky-fg uppercase">{fmt(c.watch, { n: demoLoopNo })}</p>
            <DemoFigure loop={flow.demo} startedAt={flow.phaseStartMs} className="h-[36vh] max-h-[420px] w-full max-w-md" />
            <p className="font-display text-4xl leading-tight font-bold text-white sm:text-6xl">{plannedName(target, lang)}</p>
            <p className="font-display text-2xl font-bold text-volt sm:text-4xl">{targetText(target, targetDef, lang)}</p>
            <ZoneTarget target={target} zoneNow={null} lang={lang} />
            {setRound ? <p className="text-lg text-white">{setRound}</p> : null}
            {intro?.setup ? <p className="max-w-xl text-lg font-semibold text-white sm:text-xl">{intro.setup}</p> : null}
            <p className="max-w-xl text-lg text-white/85 sm:text-2xl">{moveTip(targetDef, lang)}</p>
            <CameraAngle move={targetDef} compact />
          </div>
        )}

        {/* The HUD in one column, so nothing overlaps at 320 px wide or on a short screen: the controls at the top
            (clear of the notch / Dynamic Island), the middle taking what's left, the heart tile in the bottom row. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          {/* Top: the controls, the clock, the strap's heart rate. */}
          <div className="pointer-events-auto shrink-0 space-y-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <div className="flex flex-wrap items-center gap-2">
              <TopBtn onClick={() => setConfirmEnd(true)}>■ {c.end}</TopBtn>
              <TopBtn onClick={() => togglePause()}>{paused ? `▶ ${c.resume}` : `❚❚ ${c.pause}`}</TopBtn>
              {micOk && (
                <TopBtn onClick={toggleListening} pressed={listening}>
                  {listening ? `● ${c.listening}` : c.voice}
                </TopBtn>
              )}
              {/* Not during the demo (no outline there): one row of controls at 320 px, clear of the demo's lines. */}
              {phase !== "demo" && (
                <TopBtn onClick={() => setOutlineOn(!outlineOn)} pressed={outlineOn}>
                  {c.outline}
                </TopBtn>
              )}
              {cam.cameras > 1 && phase !== "demo" && <TopBtn onClick={cam.flip}>⟲ {c.switchCamera}</TopBtn>}
              <span className="flex-1" />
              <span className="rounded-full bg-black/60 px-3 py-1 font-display text-lg font-semibold whitespace-nowrap text-white tabular-nums">
                {clockText(sessionS * 1000)}
              </span>
            </div>
            {heardShown && (
              <p role="status" className="rounded-xl bg-black/80 px-3 py-2 text-center text-sm text-white">
                {heardShown}
              </p>
            )}
            {listening && !heardShown && (
              <p className="rounded-xl bg-black/80 px-3 py-2 text-center text-sm text-white">{CAMERA_VOICE_HELP[lang]}</p>
            )}
            {/* During a set: what VVake lost sight of (and what to change); else the framing guide. */}
            {lost ? (
              <p role="status" className="rounded-xl bg-pulse/90 px-3 py-2 text-center font-semibold text-ink">
                {forCamera(flowLine({ type: "lost", prompt: lost.prompt }, lang) ?? "", lang)}
              </p>
            ) : framingNow.framing !== "ok" && (phase === "set" || phase === "ready" || phase === "countdown") ? (
              <FramingTips shown={framingNow} compact={phase === "set"} lang={lang} />
            ) : null}
            {paused && <p className="rounded-xl bg-butter/90 px-3 py-2 text-center font-semibold text-ink">{c.paused}</p>}
            {cam.slow && <p className="rounded-xl bg-black/70 px-3 py-1 text-center text-xs text-white">{c.slow}</p>}
          </div>

          {/* The middle: big enough to read from 2–3 m. The setup and the rest scroll on a short screen. */}
          {phase !== "demo" && (
            <div
              ref={middle}
              className={cn(
                "flex min-h-0 flex-1 flex-col items-center justify-center-safe px-3 text-center [text-shadow:0_2px_8px_#000]",
                panel ? "pointer-events-auto overflow-y-auto" : "overflow-hidden",
              )}
            >
              {/* Before each set: where to put the camera, what VVake still needs, then it counts down on its own. */}
              {phase === "setup" && targetDef && (
                <div className="flex w-full max-w-xl flex-col items-stretch gap-2 rounded-2xl bg-black/50 p-3 [text-shadow:none]">
                  <p className="text-sm font-semibold tracking-widest text-sky-fg uppercase">{c.getReady}</p>
                  <p className="font-display text-3xl leading-tight font-bold text-white sm:text-5xl">{plannedName(target, lang)}</p>
                  <p className="text-lg text-white">{[targetText(target, targetDef, lang), setRound].filter(Boolean).join(" · ")}</p>
                  {intro?.setup ? <p className="text-lg font-semibold text-white">{intro.setup}</p> : null}
                  {intro?.cues.map((cu) => (
                    <p key={cu} className="text-sm text-white/85">{`· ${cu}`}</p>
                  ))}
                  <ReadyBanner ready={ready} move={targetDef} />
                  <ReadyChecks ready={ready} move={targetDef} />
                  <CameraAngle move={targetDef} />
                  {target?.easier ? <EasierLine id={targetDef.id} /> : null}
                  <p className="text-sm text-white/80">{c.posePrivacy}</p>
                </div>
              )}
              {phase === "countdown" && (
                <>
                  <p className="font-display text-4xl font-bold text-white sm:text-5xl">{targetDef ? targetDef.name[lang] : ""}</p>
                  <BigDigits
                    text={String(Math.max(1, 3 - Math.floor((now - flow.phaseStartMs) / 1000)))}
                    small={160}
                    large={224}
                    fit={fit(90)}
                  />
                  <p className="text-2xl font-semibold text-white">{targetText(target, targetDef, lang)}</p>
                </>
              )}
              {phase === "set" && (
                <>
                  <p className="font-display text-4xl font-bold text-white sm:text-5xl">{move ? move.name[lang] : c.detecting}</p>
                  <BigDigits
                    text={
                      move?.judge === "manual"
                        ? clockText(Math.max(0, manualLeft))
                        : move?.kind === "hold"
                          ? holdText(set?.holdS ?? 0)
                          : String(set?.reps ?? 0)
                    }
                    small={144}
                    fit={fit(cue || hold ? 180 : 130)}
                    large={192}
                    dim={hold && flow.holdState !== "holding"}
                  />
                  {target && (
                    <p className="text-2xl font-semibold text-white">
                      {target.reps ? fmt(c.of, { n: target.reps }) : target.holdS ? fmt(c.ofS, { n: target.holdS }) : ""}
                    </p>
                  )}
                  {hold && flow.holdState === "waiting" && move && (
                    <p role="status" className="mt-1 max-w-xl rounded-xl bg-black/70 px-4 py-1 text-lg font-semibold text-white">
                      {`${positionLine(move, lang)} ${c.holdWaiting}`}
                    </p>
                  )}
                  {hold && flow.holdState === "paused" && (
                    <p role="status" className="mt-1 rounded-xl bg-butter/90 px-4 py-1 text-lg font-semibold text-ink [text-shadow:none]">
                      {c.holdPaused}
                    </p>
                  )}
                  {hold && flow.manualHold && <p className="text-lg text-white">{c.timedByYou}</p>}
                  {setRound ? <p className="text-lg text-white">{setRound}</p> : null}
                  <ZoneTarget target={target} zoneNow={heartNow?.zone ?? null} lang={lang} />
                  {zoneSaid && now - zoneSaid.at < 6000 && (
                    <p role="status" className="mt-2 rounded-full bg-black/70 px-4 py-1 text-lg text-white">
                      {zoneSaid.text}
                    </p>
                  )}
                  {set?.loadKg ? <p className="text-lg text-white">{`${kgToUnits(set.loadKg, units)} ${loadUnit(units)}`}</p> : null}
                  {move?.judge === "manual" && <p className="text-lg text-white">{c.manualTimed}</p>}
                  {move && move.judge === "count" && (
                    <p className="mt-1 rounded-full bg-sky/80 px-3 py-0.5 text-sm text-ink">{c.judge[move.judge]}</p>
                  )}
                  {cue && <p className="mt-3 rounded-full bg-pulse/90 px-5 py-2 text-xl font-semibold text-ink">{cue}</p>}
                </>
              )}
              {/* The rest: the timer, the next exercise previewed (its controls in the bar below, never covered). */}
              {phase === "rest" && (
                <>
                  <p className="font-display text-4xl font-bold text-white">{c.rest}</p>
                  <BigDigits
                    text={clockText(Math.max(0, restLeft))}
                    small={112}
                    large={160}
                    fit={fit(nextDef && !hidePreview ? 330 : heartLineShown ? 160 : 110)}
                  />
                  {heartLineShown && (
                    <p role="status" className="mt-1 rounded-full bg-pulse/90 px-5 py-2 text-xl font-semibold text-ink">
                      {heartLineShown}
                    </p>
                  )}
                  {nextDef && nextSet ? (
                    hidePreview ? (
                      <p className="font-display text-3xl font-bold text-white">{fmt(c.next, { move: plannedName(nextSet, lang) })}</p>
                    ) : (
                      <NextPreview
                        def={nextDef}
                        next={nextSet}
                        startedAt={previewAt || flow.phaseStartMs}
                        prep={flow.inPrep}
                        ready={ready}
                      />
                    )
                  ) : (
                    <p className="text-2xl text-white">{flow.free ? c.restReady : ""}</p>
                  )}
                  {nextSet && setRound ? <p className="text-lg text-white">{setRound}</p> : null}
                </>
              )}
              {phase === "ready" && (
                <>
                  <p className="font-display text-5xl font-bold text-volt sm:text-6xl">{c.startMoving}</p>
                  <p className="mt-2 max-w-xl text-xl text-white">{c.startMovingDetail}</p>
                </>
              )}
              {phase === "done" && <p className="font-display text-5xl font-bold text-volt">{c.workoutDone}</p>}
            </div>
          )}

          {phase === "demo" && <span className="flex-1" />}

          {/* Bottom row: the heart tile and the outline button. */}
          <div className="flex shrink-0 items-end justify-between gap-2 p-3">
            <div className="flex min-w-0 flex-col items-start gap-2">
              {/* The strap's heart rate, readable from 2–3 m: bpm, the zone's colour and name, the source. */}
              {/* Not over the demo's lines: back as soon as the demo ends (the strap keeps recording). */}
              {showHeart && phase !== "demo" && (
                <HeartTile
                  bpm={heartNow?.bpm ?? null}
                  zone={heartNow?.zone ?? null}
                  label={heartSourceLabel(heartNow?.source ?? null, heartSignal, lang)}
                  zoneLabel={heartNow ? heartZoneLabel(heartNow.zone, lang) : null}
                />
              )}
              {!outlineVisible && (phase === "set" || phase === "ready" || phase === "countdown") && (
                <button
                  type="button"
                  onClick={() => outline.show(Date.now())}
                  className="pointer-events-auto h-10 rounded-full bg-black/60 px-4 text-sm font-semibold text-white"
                >
                  {c.showOutline}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* A liveness check: big, with its countdown (answered by moving, never by a click). */}
        {check && (
          <div role="alert" className="absolute inset-x-5 top-[45%] rounded-2xl bg-volt/95 p-5 text-center text-ink">
            <p className="font-display text-3xl font-bold sm:text-4xl">{LIVENESS_TEXT[check.kind][lang]}</p>
            <p className="text-lg">{fmt(c.checkLeft, { n: checkLeft })}</p>
          </div>
        )}
      </Preview>

      {/* Bottom: the controls, never needed. The workout runs on its own; Start now / Skip / more rest / easier when you
          want them, ±1 fixes a miscount, a chip names a weighted lookalike. */}
      <div className="border-t border-line bg-night-2 pt-3 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)]">
        <div className="mx-auto max-w-xl space-y-2">
          {confirmEnd ? (
            <Card>
              <p className="font-display font-semibold">{c.endTitle}</p>
              <p className="text-sm text-muted">{fmt(c.setsSoFar, { sets: setsSoFar })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn
                  onClick={() => {
                    setConfirmEnd(false);
                    finish();
                  }}
                >
                  {c.endReview}
                </Btn>
                <Btn variant="ghost" onClick={() => setConfirmEnd(false)}>
                  {c.keepGoing}
                </Btn>
                {!confirmDiscard ? (
                  <Btn variant="danger" onClick={() => setConfirmDiscard(true)}>
                    {c.discard}
                  </Btn>
                ) : (
                  <ExitButton danger label={c.discardConfirm} />
                )}
              </div>
            </Card>
          ) : phase === "demo" ? (
            <ControlRow>
              <SmallBtn onClick={() => act(flow.skipPreview(Date.now()))}>{c.skipDemo}</SmallBtn>
            </ControlRow>
          ) : phase === "setup" && targetDef ? (
            <>
              <Btn variant="volt" className="w-full" onClick={() => act(flow.startNow(Date.now()))}>
                ▶ {c.startNow}
              </Btn>
              <ControlRow>
                <SmallBtn onClick={() => act(flow.replayDemo(Date.now()))}>{c.replayDemo}</SmallBtn>
                {easierOf(targetDef.id, lang)?.move ? (
                  <SmallBtn onClick={() => act(flow.swapEasier(Date.now(), lang))}>{c.easier}</SmallBtn>
                ) : null}
                <SmallBtn onClick={() => act(flow.skip(Date.now()))}>{c.skipExercise}</SmallBtn>
              </ControlRow>
            </>
          ) : phase === "rest" ? (
            <>
              <ControlRow>
                <SmallBtn onClick={() => act(flow.extendRest(15, Date.now()))}>+15 s</SmallBtn>
                <SmallBtn onClick={() => act(flow.extendRest(30, Date.now()))}>+30 s</SmallBtn>
                {!flow.free && (
                  <span className="flex items-center gap-1">
                    <SmallBtn label={c.restShorter} onClick={() => act(flow.setRestS(flow.restS - 15, Date.now()))}>
                      −
                    </SmallBtn>
                    <span className="px-1 text-sm whitespace-nowrap tabular-nums">{fmt(c.restLen, { n: flow.restS })}</span>
                    <SmallBtn label={c.restLonger} onClick={() => act(flow.setRestS(flow.restS + 15, Date.now()))}>
                      +
                    </SmallBtn>
                  </span>
                )}
              </ControlRow>
              {nextDef ? (
                <ControlRow>
                  <SmallBtn
                    onClick={() => {
                      setPreviewAt(Date.now());
                      setHidePreview(false);
                    }}
                  >
                    {c.replayDemo}
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => {
                      if (!hidePreview) flow.skipPreview(Date.now());
                      else flow.showPreview();
                      setHidePreview(!hidePreview);
                    }}
                  >
                    {hidePreview ? c.showPreview : c.skipPreview}
                  </SmallBtn>
                  {easierOf(nextDef.id, lang)?.move ? (
                    <SmallBtn onClick={() => act(flow.swapEasier(Date.now(), lang))}>{c.easier}</SmallBtn>
                  ) : null}
                  <SmallBtn onClick={() => act(flow.skip(Date.now()))}>{c.skipRest}</SmallBtn>
                </ControlRow>
              ) : null}
            </>
          ) : phase === "set" ? (
            <>
              {switchTo.length > 0 && (
                // One row (scrolls sideways on a narrow screen), so the picture keeps its height.
                <div className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1">
                  {switchTo.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        e.switchMove(m.id);
                        bump();
                      }}
                      className="min-h-10 shrink-0 rounded-full border border-line px-3 text-sm whitespace-nowrap"
                    >
                      {m.name[lang]}
                    </button>
                  ))}
                </div>
              )}
              {/* The camera struggles with the hold: time it yourself (logged as timed by you). */}
              {hold && !flow.manualHold && (flow.holdState === "paused" || holdWaitS >= 4) && (
                <Btn variant="volt" className="w-full" onClick={() => act(flow.startHoldByHand(Date.now()))}>
                  {flow.holdState === "paused" ? c.resumeTimer : c.startTimer}
                </Btn>
              )}
              {/* A long quiet stretch in a planned set: asked, never ended on its own (2026-10-27). */}
              {flow.askingDone && (
                <div role="status" className="space-y-2 rounded-2xl border-2 border-volt bg-surface p-3 text-center">
                  <p className="font-display text-xl font-semibold">{c.askDone}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Btn variant="volt" onClick={() => act(flow.finishSet(Date.now()))}>
                      {c.finishSet}
                    </Btn>
                    <Btn variant="ghost" onClick={() => act(flow.keepGoing(Date.now()))}>
                      {c.keepGoing}
                    </Btn>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                {move?.kind === "reps" && move.judge !== "manual" && (
                  <Btn
                    variant="ghost"
                    aria-label="−1"
                    onClick={() => {
                      e.adjust(-1);
                      bump();
                    }}
                  >
                    −1
                  </Btn>
                )}
                <Small className="flex-1 text-center">{endsOnStop ? c.handsFreeStop : hold ? c.handsFreeHold : c.handsFreeHint}</Small>
                {move?.kind === "reps" && move.judge !== "manual" && (
                  <Btn
                    variant="ghost"
                    aria-label="+1"
                    onClick={() => {
                      e.adjust(+1);
                      bump();
                    }}
                  >
                    +1
                  </Btn>
                )}
                {!flow.free && move?.judge !== "manual" && (
                  <SmallBtn onClick={() => act(flow.finishSet(Date.now()))}>{c.finishSet}</SmallBtn>
                )}
                {flow.plan && <SmallBtn onClick={() => act(flow.skip(Date.now()))}>{c.skip}</SmallBtn>}
              </div>
            </>
          ) : (
            <Small className="text-center">{flow.free ? c.handsFreeStop : c.handsFreeHint}</Small>
          )}
          <Small className="text-center">{c.keepOpen}</Small>
        </div>
      </div>
    </div>
  );
}

/** A row of small controls under the picture: wraps on a narrow screen, never covers the picture. */
function ControlRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>;
}

function SmallBtn({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="min-h-10 min-w-10 rounded-full border border-line bg-surface px-3 text-sm font-semibold whitespace-nowrap hover:border-muted/60"
    >
      {children}
    </button>
  );
}

/**
 * Where to put the camera for a move (tester report 2026-10-26; the phone's CameraAngle), readable from 2–3 m: the
 * camera low or at waist height, the distance, you facing it or side-on; one line under it (cameraReady.ts setupLine).
 */
function CameraAngle({ move, compact }: { move: MoveDef; compact?: boolean }) {
  const { t, lang } = useApp();
  const c = t.camera;
  const st = moveSetup(move);
  const line = forCamera(setupLine(move, lang), lang);
  const view = st.views.length > 1 ? "either" : (st.views[0] ?? "either");
  const icon = compact ? "h-6 w-6" : "h-8 w-8";
  return (
    <div className="w-full max-w-md self-center rounded-xl bg-black/70 px-3 py-2 text-white [text-shadow:none]">
      {st.views.length > 0 && (
        <div aria-hidden className="flex items-end justify-center gap-2">
          <span className={cn("flex flex-col items-center", !st.floor && (compact ? "pb-3" : "pb-5"))}>
            <svg viewBox="0 0 24 24" className={cn(icon, "text-sky-fg")} fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="7" width="18" height="12" rx="2" />
              <circle cx="12" cy="13" r="3.5" />
              <path d="M8 7l1.5-2.5h5L16 7" />
            </svg>
            <span className="text-[11px] text-white/80">{st.floor ? c.angleFloor : c.angleWaist}</span>
          </span>
          <span className={cn("flex max-w-36 flex-1 flex-col items-center", compact ? "pb-3" : "pb-4")}>
            <span
              className={cn("font-semibold tabular-nums", compact ? "text-xs" : "text-sm")}
            >{`${st.distanceM[0]}–${st.distanceM[1]} m`}</span>
            <span className="w-full border-b-2 border-dashed border-white/60" />
          </span>
          <span className="flex flex-col items-center">
            <svg
              viewBox="0 0 24 32"
              className={cn(compact ? "h-8 w-6" : "h-11 w-8", "text-volt")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              {view === "side" ? (
                <>
                  <circle cx="13" cy="5" r="3" />
                  <path d="M12 9v11M12 12l4 4M12 20l3 10M12 20l-3 10" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="5" r="3" />
                  <path d="M12 9v11M5 13h14M12 20l-4 10M12 20l4 10" />
                </>
              )}
            </svg>
            <span className="text-[11px] text-white/80">
              {view === "side" ? c.angleSide : view === "front" ? c.angleFacing : c.angleEither}
            </span>
          </span>
        </div>
      )}
      <p className={cn("text-center font-semibold", compact ? "text-[13px]" : "text-[15px]")}>{line}</p>
    </div>
  );
}

type Readiness = (ReadyReport & { shown: ReadyPrompt | null }) | null;

/** What to change before the set ("Turn sideways so I can track you."), or "You're in. Starting…" once VVake sees you. */
function ReadyBanner({ ready, move }: { ready: Readiness; move: MoveDef }) {
  const { t, lang } = useApp();
  const ok = !!ready?.ready;
  const p = ready?.shown ?? (ready ? null : "step_in");
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl px-3 py-2 text-center text-lg font-semibold [text-shadow:none] sm:text-xl",
        ok ? "bg-volt/95 text-ink" : "bg-black/85 text-white",
      )}
    >
      {ok ? t.camera.youreIn : p ? forCamera(promptLine(p, move, lang), lang) : t.camera.holdStill}
    </p>
  );
}

/** In the picture · the right angle · in position (holds and floor moves): each ticked as VVake sees it. */
function ReadyChecks({ ready, move }: { ready: Readiness; move: MoveDef }) {
  const c = useApp().t.camera;
  // In the picture once the only thing left is the angle or the position (cameraReady.ts readiness order).
  const p = ready?.prompt;
  const turn = p === "turn_sideways" || p === "face_phone" || p === "turn_diagonal";
  const framed = !!ready && (ready.ready || turn || p === "get_in_position");
  const angle = framed && !turn;
  const setup = moveSetup(move);
  const views = setup.views;
  // A floor move: the whole body in the picture, head to knees at least (2026-10-27), confirmed before it starts.
  const items: [string, boolean][] = [
    [setup.floor ? c.wholeBody : c.inPicture, framed],
    [views.length === 1 ? (views[0] === "side" ? (setup.diagonal ? c.diagonalOrSide : c.sideOn) : c.facingCamera) : c.anyAngle, angle],
  ];
  if (move.kind === "hold" || setup.floor) items.push([c.inPosition, !!ready?.inPosition]);
  return (
    <ul className="flex flex-wrap justify-center gap-1.5 [text-shadow:none]">
      {items.map(([label, on]) => (
        <li
          key={label}
          className={cn("rounded-full px-3 py-1 text-sm font-semibold", on ? "bg-volt/90 text-ink" : "bg-black/75 text-white")}
        >
          {`${on ? "✓" : "·"} ${label}`}
        </li>
      ))}
    </ul>
  );
}

/** The easier way, said where the plan asks for it (a chair squat in the beginner routine). */
function EasierLine({ id }: { id: string }) {
  const { t, lang, fmt } = useApp();
  const ez = easierOf(id, lang);
  if (!ez) return null;
  return <p className="text-base text-butter-fg">{fmt(t.camera.easierWay, { tip: ez.tip })}</p>;
}

/**
 * The rest's preview of the next exercise: its name and target, its demo looping, where to put the camera, one or two
 * form tips; in the last seconds, "get into position" and what VVake still needs.
 */
function NextPreview({
  def,
  next,
  startedAt,
  prep,
  ready,
}: {
  def: MoveDef;
  next: { move: string; reps?: number; holdS?: number; easier?: boolean; label?: string };
  startedAt: number;
  prep: boolean;
  ready: Readiness;
}) {
  const { t, lang } = useApp();
  const loop = useMemo(() => demoLoop(def.id), [def.id]);
  // The exact variation first (its stance, where the weight is), then the cues (2026-10-27).
  const intro = isOwnMove(def.id) ? null : setIntro(def.id, lang, next.label);
  const tips = intro ? [...(intro.setup ? [intro.setup] : []), ...intro.cues].slice(0, 3) : moveTips(def, lang);
  return (
    <div
      className={cn(
        "mt-2 flex w-full max-w-md flex-col gap-2 rounded-2xl bg-black/70 p-3 text-white [text-shadow:none]",
        prep && "ring-2 ring-volt",
      )}
    >
      <p className="text-sm font-semibold tracking-widest text-sky-fg uppercase">{prep ? t.camera.getIntoPosition : t.camera.nextUp}</p>
      <p className="font-display text-2xl font-bold sm:text-3xl">{plannedName(next, lang)}</p>
      <p className="text-lg">{targetText(next, def, lang)}</p>
      <div className="flex items-center gap-3 text-left">
        <DemoFigure
          loop={loop}
          startedAt={startedAt}
          className="h-32 w-24 shrink-0 [@media(min-height:800px)]:h-40 [@media(min-height:800px)]:w-28"
        />
        <ul className="flex-1 space-y-1 text-sm">
          {tips.map((x) => (
            <li key={x}>{`• ${x}`}</li>
          ))}
          {next.easier ? (
            <li>
              <EasierLine id={def.id} />
            </li>
          ) : null}
        </ul>
      </div>
      <CameraAngle move={def} compact />
      {prep && <ReadyBanner ready={ready} move={def} />}
    </div>
  );
}

/** A move's demo: a thick stick figure doing it (camera/cameraDemo.ts frames, the same joints as the outline). */
function DemoFigure({ loop, startedAt, className }: { loop: DemoLoop | null; startedAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!loop) return;
    let raf = 0;
    const step = () => {
      setNow(Date.now());
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [loop]);
  if (!loop) return null;
  const f = demoFrameAt(loop, now - startedAt);
  const p = (j: Joint) => {
    const q = f.joints[j];
    return q ? { x: q.x * f.w, y: q.y * f.h } : null;
  };
  const head = p("nose");
  const sh = p("lShoulder");
  const sh2 = p("rShoulder");
  const hp = p("lHip");
  const hp2 = p("rHip");
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className={className} role="img" aria-hidden>
      {sh && sh2 && hp && hp2 && (
        <polygon
          points={[sh, sh2, hp2, hp].map((q) => `${q.x},${q.y}`).join(" ")}
          className="fill-pulse stroke-pulse"
          strokeWidth={26}
          strokeLinejoin="round"
        />
      )}
      {BONES.filter(
        ([a, b]) =>
          !(a.endsWith("Shoulder") && b.endsWith("Shoulder")) &&
          !(a.endsWith("Hip") && b.endsWith("Hip")) &&
          !(a.endsWith("Shoulder") && b.endsWith("Hip")),
      ).map(([a, b]) => {
        const q = p(a);
        const r = p(b);
        if (!q || !r) return null;
        return (
          <line
            key={`${a}-${b}`}
            x1={q.x}
            y1={q.y}
            x2={r.x}
            y2={r.y}
            className={a.startsWith("l") ? "stroke-volt" : "stroke-mint"}
            strokeWidth={30}
            strokeLinecap="round"
          />
        );
      })}
      {head && <circle cx={head.x} cy={head.y} r={34} className="fill-night stroke-volt" strokeWidth={6} />}
      {loop.prop && <DemoWeight kind={loop.prop} l={p("lWrist")} r={p("rWrist")} size={30} />}
    </svg>
  );
}

/** The weight in the demo, where it is (2026-10-27: the exact variation; the phone's PoseFigure Prop): one dumbbell
 * held at the chest or overhead, one in each hand, a bar across both hands, a kettlebell in both hands. */
function DemoWeight({
  kind,
  l,
  r,
  size,
}: {
  kind: DemoProp;
  l: { x: number; y: number } | null;
  r: { x: number; y: number } | null;
  size: number;
}) {
  if (!l || !r) return null;
  const mid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  const bell = (x: number, y: number, vertical: boolean, k = 1) => {
    const h = size * 1.1 * k;
    const dx = vertical ? 0 : h;
    const dy = vertical ? h : 0;
    return (
      <g key={`${x}-${y}`}>
        <line x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} className="stroke-sky" strokeWidth={size * 0.35} strokeLinecap="round" />
        <circle cx={x - dx} cy={y - dy} r={size * 0.55 * k} className="fill-sky" />
        <circle cx={x + dx} cy={y + dy} r={size * 0.55 * k} className="fill-sky" />
      </g>
    );
  };
  if (kind === "one-at-chest" || kind === "one-overhead") return bell(mid.x, mid.y, true, 1.2);
  if (kind === "dumbbells") return <g>{[bell(l.x, l.y, false), bell(r.x, r.y, false)]}</g>;
  if (kind === "kettlebell") return <circle cx={mid.x} cy={mid.y + size * 0.9} r={size * 0.9} className="fill-sky" />;
  // A bar across both hands, a little past each.
  const ex = (r.x - l.x) * 0.25;
  const ey = (r.y - l.y) * 0.25;
  return (
    <g>
      <line
        x1={l.x - ex}
        y1={l.y - ey}
        x2={r.x + ex}
        y2={r.y + ey}
        className="stroke-sky"
        strokeWidth={size * 0.35}
        strokeLinecap="round"
      />
      <circle cx={l.x - ex} cy={l.y - ey} r={size * 0.8} className="fill-sky" />
      <circle cx={r.x + ex} cy={r.y + ey} r={size * 0.8} className="fill-sky" />
    </g>
  );
}

function TopBtn({ onClick, children, pressed }: { onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "h-10 rounded-full bg-black/60 px-3 text-sm font-semibold text-white ring-1 ring-white/20",
        pressed === true && "text-volt",
      )}
    >
      {children}
    </button>
  );
}

/** Leaves the camera workout (nothing saved): back to the sport picker. */
function ExitButton({ danger, label }: { danger?: boolean; label?: string }) {
  const { t, go } = useApp();
  return (
    <Btn
      big={!danger}
      variant={danger ? "danger" : "primary"}
      onClick={() => {
        hush();
        go({ name: "today" });
      }}
    >
      {label ?? t.workout.done}
    </Btn>
  );
}

/**
 * A big number on the camera screen, always on one line: tabular digits, no wrapping, sized from the measured width
 * (game-core bigDigitSize), with a vw-based clamp() until it's measured. Readable from 2–3 m.
 */
function BigDigits({
  text,
  small,
  large,
  fit,
  dim,
  className,
}: {
  text: string;
  small: number;
  large: number;
  fit?: number | null;
  /** Greyed (a hold's timer waiting or paused). */
  dim?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setHeight(window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  // A short screen (a 320×640 phone, a phone in landscape): the number also fits the height, so the lines under it
  // and the heart tile keep their room.
  const capped = shortScreenCap(bigNumberPx(text, width, { small, large }), height);
  const px = capped && fit ? Math.min(capped, fit) : capped;
  return (
    <div ref={ref} className="w-full overflow-hidden">
      <p
        className={cn("font-display leading-none font-bold whitespace-nowrap tabular-nums", dim ? "text-white/65" : "text-volt", className)}
        style={{ fontSize: px ? `${px}px` : bigNumberFallback(text, small) }}
      >
        {text}
      </p>
    </div>
  );
}

/** The heart tile on the camera picture: the bpm big, the zone's colour and name, where it comes from. */
function HeartTile({ bpm, zone, label, zoneLabel }: { bpm: number | null; zone: number | null; label: string; zoneLabel: string | null }) {
  return (
    <div role="status" className="pointer-events-none flex max-w-full items-center gap-x-3 rounded-2xl bg-black/70 px-3 py-2 text-white">
      <p className="flex items-baseline gap-1 whitespace-nowrap">
        <span aria-hidden className="text-2xl text-pulse-fg">
          ♥
        </span>
        <span className="font-display text-[clamp(2rem,min(12vw,8dvh),3.75rem)] leading-none font-bold tabular-nums">{bpm ?? "–"}</span>
        <span className="text-lg">bpm</span>
      </p>
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        {zoneLabel && zone !== null && (
          <span className={cn("rounded-full px-3 py-0.5 text-base font-semibold whitespace-nowrap sm:text-lg", zoneTone(zone))}>
            {zoneLabel}
          </span>
        )}
        <span className="text-sm text-white/85">{label}</span>
      </div>
    </div>
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────────────────────────────

function Summary({ result, training }: { result: LiveResult; training?: TrainingToRun }) {
  const app = useApp();
  const { t, lang, fmt, go, prefs, me, athlete, deviceKey, energy, setEnergy, api, refresh, setQueue, queue, streak } = app;
  // A custom training's run (ADR-0047): scored here first (game-core trainingRun), then by the API once uploaded.
  const [run, setRun] = useState<RunReply | "busy" | "failed" | null>(null);
  const c = t.camera;
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState<UploadReply | null>(null);
  const [saved, setSaved] = useState<WebSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Loads: optional, once per weighted move, prefilled with the ones used; never needed to save.
  const [loads, setLoads] = useState<Record<string, number | undefined>>(() => ({ ...result.loads }));
  const [loadText, setLoadText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(result.loads).map(([k, v]) => [k, kgToUnits(v, prefs.units)])),
  );
  // Hands-free to the end: it saves itself after 20 s unless you touch the page.
  const [touched, setTouched] = useState(false);
  const [shownAt] = useState(() => Date.now());
  const now = useTick(500);
  const left = saved ? null : autoSaveLeft(shownAt, now, touched);
  const weighted = weightedMoves(result.summary);
  const summary = applyLoads(result.summary, loads);
  const totals = cameraTotals(summary);
  const volume = cameraVolumeKg(summary);
  const strapHeart = hasStrapHeart(result.strap);
  const bars = zoneBars(result.heart);
  const preview = cameraPointsPreview(summary, result.activeS);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const savedRef = useRef(false);

  const save = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    saveCameraLoads(loads);
    setSaving(true);
    const session = toWebCameraSession({
      id: uuid(),
      sport: result.sport,
      startedAtMs: result.startedAt,
      endedAtMs: result.endedAt,
      activeS: result.activeS,
      summary,
      deviceKey,
      ...(strapHeart
        ? {
            strap: {
              samples: result.strap,
              heart: heartForSport(athlete?.health, result.sport, app.heartZones),
              energyAtStart: Math.floor(energy.current),
            },
          }
        : {}),
    });
    if (session.energyUsed) setEnergy(spend(energy, session.energyUsed));
    setQueue(enqueue(queueRef.current, me.id, session));
    setSaved(session);
    void api
      .upload(session, localTz())
      .then((r) => {
        setQueue(queueRef.current.filter((x) => x.session.id !== session.id));
        setReply(r);
        void refresh();
        if (training) {
          setRun("busy");
          void trainingsApi(app.session)
            .recordRun(training.training.id, { sessionId: r.session?.id ?? session.id, challengeCode: training.challenge ?? null })
            .then((x) => setRun(x ?? "failed"))
            .catch(() => setRun("failed"));
        }
      })
      .catch(() => {
        setFailed(true);
        if (training) setRun("failed");
      })
      .finally(() => setSaving(false));
  };

  useEffect(() => {
    if (left === 0 && !savedRef.current) save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const got = reply?.session;
  const reason = got?.cameraReason ?? null;
  const reasonText = (r: string) => (r in c.reason ? c.reason[r as keyof typeof c.reason] : null);

  return (
    <div
      className="mx-auto w-full max-w-xl space-y-4 pt-[max(env(safe-area-inset-top),1.5rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-16 pl-[max(env(safe-area-inset-left),1rem)]"
      onPointerDown={() => setTouched(true)}
      onKeyDown={() => setTouched(true)}
    >
      <Kicker tone="volt">{c.kicker}</Kicker>
      <h1 className="font-display text-3xl font-bold">{c.niceWork}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={c.sets} value={String(totals.sets)} />
          <Stat label={c.reps} value={String(totals.reps)} />
          {totals.holdS > 0 && <Stat label={c.held} value={restClock(totals.holdS * 1000)} />}
          {volume > 0 && <Stat label={c.volume} value={`${kgToUnits(volume, prefs.units)} ${loadUnit(prefs.units)}`} />}
          <Stat label={t.workout.elapsed} value={restClock(result.activeS * 1000)} />
        </dl>
        <ul className="mt-3 space-y-1 text-sm">
          {summary.moves.map((m) => {
            const def = cameraMove(m.id);
            return (
              <li key={m.id}>
                <span className="font-semibold">{def ? def.name[lang] : m.id}</span>{" "}
                <span className="text-muted">
                  {m.sets
                    .map(
                      (s) =>
                        `${s.holdS ? `${s.holdS} s` : s.reps}${s.loadKg ? ` × ${kgToUnits(s.loadKg, prefs.units)} ${loadUnit(prefs.units)}` : ""}${s.side ? ` (${c.side[s.side]})` : ""}`,
                    )
                    .join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
        {summary.liveness.asked > 0 && (
          <Small className="mt-2">{fmt(c.checks, { passed: summary.liveness.passed, asked: summary.liveness.asked })}</Small>
        )}
        <Small className="mt-2">{c.privacyLine}</Small>
      </Card>
      {result.heart && (
        <Card>
          <Kicker tone="pulse">{c.heartTitle}</Kicker>
          <p className="mt-2 font-display text-xl font-bold tabular-nums">
            {fmt(c.heartStats, { avg: result.heart.avgBpm, max: result.heart.maxBpm })}
          </p>
          {bars.length > 0 && (
            <div className="mt-3 space-y-1.5" aria-label={c.timeInZones}>
              <Small>{c.timeInZones}</Small>
              {bars.map((b) => (
                <div key={b.zone} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0">{heartZoneLabel(b.zone, lang)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={cn("h-full rounded-full", zoneTone(b.zone))} style={{ width: `${b.share * 100}%` }} />
                  </div>
                  <span className="w-12 text-right tabular-nums">{clockText(b.s * 1000)}</span>
                </div>
              ))}
            </div>
          )}
          <Small className="mt-2">{c.heartFromStrap}</Small>
        </Card>
      )}
      {weighted.length > 0 && !saved && (
        <Card>
          <Kicker tone="sky">{c.weightsTitle}</Kicker>
          <Small className="mt-1">{c.weightsBody}</Small>
          <div className="mt-2 space-y-2">
            {weighted.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{cameraMove(id)?.name[lang] ?? id}</span>
                <input
                  className="h-11 w-24 rounded-xl border border-line bg-surface px-3 text-right tabular-nums"
                  inputMode="decimal"
                  value={loadText[id] ?? ""}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setLoadText((x) => ({ ...x, [id]: v }));
                    setLoads((x) => ({ ...x, [id]: loadToKg(v, prefs.units) }));
                  }}
                />
                <span>{loadUnit(prefs.units)}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
      <TrackingCard notes={result.notes} summary={summary} />
      {training && <TrainingRunCard training={training.training} summary={summary} heart={result.heart} run={run} />}
      <Card tone="volt">
        <Kicker tone="volt">{strapHeart ? c.heartPointsTitle : c.cameraPointsTitle}</Kicker>
        {got ? (
          got.tier === "B" ? (
            <p className="mt-2 font-display text-2xl font-bold text-volt-fg">
              {fmt(t.workout.points, { n: reply?.points?.total ?? got.points ?? 0 })}
            </p>
          ) : (
            <>
              <p className="mt-2 font-display text-2xl font-bold text-volt-fg">{fmt(c.pointsGot, { n: got.cameraPoints ?? 0 })}</p>
              {reason && reason !== "ok" && reasonText(reason) && <p className="mt-1 text-sm">{reasonText(reason)}</p>}
            </>
          )
        ) : strapHeart ? (
          <p className="mt-2">{c.strapPoints}</p>
        ) : preview.reason === "ok" ? (
          <p className="mt-2">{fmt(c.pointsUpTo, { n: preview.points })}</p>
        ) : (
          <p className="mt-2">{reasonText(preview.reason) ?? ""}</p>
        )}
        {failed && <p className="mt-2 text-sm text-butter-fg">{t.workout.summaryLocal}</p>}
        <Small className="mt-2">{c.journal}</Small>
        {streak && got && <Small className="mt-1">{fmt(t.workout.streakNow, { n: streak.days })}</Small>}
      </Card>
      <Note tone="butter">{t.workout.webRule}</Note>
      {/* "How did it feel?" once saved: a result, not a suggestion (lead 2026-10-28), so every level shows it, Quiet too; the summary is never during a workout. */}
      {saved && (
        <Card>
          <FeelAfter sport={result.sport} minutes={result.activeS / 60} />
        </Card>
      )}
      {left !== null && !saving && <Small className="text-center">{fmt(c.autoSave, { n: left })}</Small>}
      {!saved ? (
        <>
          <Btn big variant="volt" className="w-full" disabled={saving} onClick={save}>
            {saving ? c.saving : c.save}
          </Btn>
          {!confirmDiscard ? (
            <Btn variant="ghost" className="w-full" onClick={() => setConfirmDiscard(true)}>
              {c.discard}
            </Btn>
          ) : (
            <Btn variant="danger" className="w-full" onClick={() => go({ name: "today" })}>
              {c.discardConfirm}
            </Btn>
          )}
        </>
      ) : (
        <Btn big className="w-full" disabled={saving} onClick={() => go({ name: "today" })}>
          {saving ? c.saving : t.workout.done}
        </Btn>
      )}
    </div>
  );
}

/** How well the camera tracked the sets, said honestly (lost sight, timed by you, shorter reps, form not judged). */
function TrackingCard({ notes, summary }: { notes: SetNote[]; summary: CameraSummary }) {
  const { t, lang } = useApp();
  const lines = trackingNotes(notes, summary, lang);
  if (!lines.length) return null;
  return (
    <Card>
      <Kicker tone="butter">{t.camera.tracking}</Kicker>
      <ul className="mt-2 space-y-1 text-sm">
        {lines.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-display text-xl leading-tight font-bold tabular-nums">{value}</dd>
    </div>
  );
}

// ── Custom trainings (ADR-0047) ─────────────────────────────────────────────────────────────────────────────────

/** The set's target zone (or effort out of 10) and, with a strap, how the heart is doing against it. */
function ZoneTarget({ target, zoneNow, lang }: { target: { zone?: number; rpe?: number } | null; zoneNow: number | null; lang: Locale }) {
  const r = getTrainingsDict(lang).app.run;
  if (!target?.zone && !target?.rpe) return null;
  if (!target.zone)
    return (
      <p className="mt-1 rounded-full bg-black/60 px-4 py-1 text-lg font-semibold text-white">
        {r.effortTarget.replace("{n}", String(target.rpe))}
      </p>
    );
  const feel = zoneNow ? zoneFeel(target.zone, zoneNow) : null;
  return (
    <p
      className={cn(
        "mt-1 rounded-full px-4 py-1 text-lg font-semibold",
        feel === "in"
          ? "bg-volt text-ink"
          : feel === "below"
            ? "bg-sky text-ink"
            : feel === "above"
              ? "bg-pulse text-ink"
              : "bg-black/60 text-white",
      )}
    >
      {r.zoneTarget.replace("{n}", String(target.zone))}
      {feel ? ` · ${zoneLine(target.zone, feel, lang)}` : target.rpe ? ` · ${r.effortTarget.replace("{n}", String(target.rpe))}` : ""}
    </p>
  );
}

/** The training's sets before starting: move, target, zone or effort. */
function TrainingSetsCard({ training }: { training: Training }) {
  const { lang } = useApp();
  const d = getTrainingsDict(lang);
  const rows = setRowsOf(training, lang);
  return (
    <Card>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-2">
            <span>
              <span className="font-semibold">{r.name}</span> <span className="text-muted">{r.target}</span>
            </span>
            {r.intensity && <span className="text-muted">{r.intensity}</span>}
          </li>
        ))}
      </ol>
      {training.rounds > 1 && <Small className="mt-2">{d.share.rounds.replace("{n}", String(training.rounds))}</Small>}
      {rows.some((r) => r.zone) && <Small className="mt-2">{d.share.zonesNote}</Small>}
    </Card>
  );
}

/** The run's score: 700 for the work, 300 for the time in the target zones with a strap (game-core trainingRun). */
function TrainingRunCard({
  training,
  summary,
  heart,
  run,
}: {
  training: Training;
  summary: CameraSummary;
  heart: CameraHeartStats | null;
  run: RunReply | "busy" | "failed" | null;
}) {
  const { lang } = useApp();
  const r = getTrainingsDict(lang).app.run;
  const local: TrainingRun = trainingRun(training, summary, heart);
  const shown = run && typeof run === "object" ? run : local;
  return (
    <Card tone="pulse">
      <Kicker tone="pulse">{r.score}</Kicker>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{r.scoreOf.replace("{n}", String(shown.score))}</p>
      <p className="mt-1 text-sm">{shown.completed ? r.completed : r.notCompleted}</p>
      {shown.inZone !== null && <p className="text-sm text-muted">{r.inZone.replace("{n}", String(Math.round(shown.inZone * 100)))}</p>}
      {!heart && <Small className="mt-1">{r.noSensor}</Small>}
      {run === "busy" && <Small className="mt-1">{r.recording}</Small>}
      {run === "failed" && <Small className="mt-1 text-butter-fg">{r.failed}</Small>}
      <Small className="mt-2">{r.webRule}</Small>
    </Card>
  );
}
