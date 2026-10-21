"use client";
/* eslint-disable react-hooks/refs, react-hooks/purity -- the session engine (game-core CameraWorkoutEngine) is a mutable object fed by pose frames outside React; the screen reads it on each render, re-rendered by a 250 ms tick and by every frame, as the phone screen does. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";
import { localTz, type UploadReply } from "@/lib/webapp/api";
import { playCue, playQuick, hush, unlockAudio, warmVoice } from "@/lib/webapp/coachAudio";
import { heartProfileOf } from "@/lib/webapp/heart";
import { enqueue } from "@/lib/webapp/store";
import { SAMPLE_EVERY_S, spend, uuid, type Sample, type WebSession } from "@/lib/webapp/workout";
import {
  cueLine,
  FRAMING_NOTE,
  FRAMING_TEXT,
  FRAMING_TIP_TEXT,
  FRAMING_VOICE,
  FramingVoice,
  framingLine,
  CuePacer,
  sayCues,
  sayRep,
} from "@/lib/webapp/camera/cameraCues";
import { LIVENESS_TEXT, type LivenessKind } from "@/lib/webapp/camera/cameraLiveness";
import { lookalikes } from "@/lib/webapp/camera/cameraDetect";
import { CAMERA_MOVES, cameraMove, EQUIPMENT_NAMES, FAMILY_NAMES, type MoveDef, type MoveFamily } from "@/lib/webapp/camera/cameraMoves";
import { cameraTotals, cameraVolumeKg, type CameraSummary } from "@/lib/webapp/camera/cameraPoints";
import { seen, type BodyArea, type Framing, type FramingTip, type Joint, type PoseFrame } from "@/lib/webapp/camera/cameraPose";
import {
  CAMERA_ROUTINES,
  CameraWorkoutEngine,
  routineForPlan,
  type CameraRoutine,
  type PlannedSet,
} from "@/lib/webapp/camera/cameraSession";
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
  loadOutlinePref,
  OUTLINE_FADE_MS,
  OutlineClock,
  previewHint,
  saveOutlinePref,
  Steady,
  type CameraSetupState,
} from "@/lib/webapp/camera/webSetup";
import { useApp } from "./AppContext";
import { Btn, Card, Kicker, Note, Small, Toggle } from "./ui";

/**
 * Camera workout in the browser (the phone's app/camera-workout.tsx, monorepo apps/mobile; ADR-0046 amendment
 * 2026-10-21): the computer's webcam (or a phone browser's camera) 2–3 m away, the pose read in this tab by MediaPipe
 * (camera/landmarker.ts, served by vvake.com), reps and holds counted by the phone's own rules (camera/*.ts, copied
 * from game-core), form cues by the coach's voice, sets and rests, quick liveness checks during rest, then the
 * session uploaded as counts only. The video never leaves the tab and nothing is recorded.
 *
 * Phases: setup (the camera step first: explained, asked, a live mirrored preview with the framing guide; then a
 * routine, a move, or "just start moving") → live → summary (save or discard). The webcam stays on from setup to the
 * end (one permission prompt). Framing tips are written on screen; the voice says one positioning line at the start
 * and at most one reminder 20 s later. The body outline shows 35 s, then fades (Show outline brings it back).
 */

type Phase = "setup" | "live" | "summary";
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
type Webcam = ReturnType<typeof useWebcam>;

// ── The screen ──────────────────────────────────────────────────────────────────────────────────────────────────

interface LiveResult {
  summary: CameraSummary;
  startedAt: number;
  endedAt: number;
  activeS: number;
  sport: string;
  strap: Sample[];
}

export function CameraScreen({ sport }: { sport?: string }) {
  const cam = useWebcam();
  const [phase, setPhase] = useState<Phase>("setup");
  const [plan, setPlan] = useState<Plan>(() => ({ routine: sport ? routineForPlan(sport, 20, true) : null, move: null }));
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
      {phase === "setup" && (
        <Setup
          cam={cam}
          plan={plan}
          setPlan={setPlan}
          outline={outline.current}
          outlineOn={outlineOn}
          setOutlineOn={setOutlineOn}
          onStart={() => setPhase("live")}
        />
      )}
      {phase === "live" && (
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
      {phase === "summary" && result && <Summary result={result} />}
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

function Setup({
  cam,
  plan,
  setPlan,
  outline,
  outlineOn,
  setOutlineOn,
  onStart,
}: {
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
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
      <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "workout" })}>
        ‹ {t.common.back}
      </button>
      <Kicker tone="volt">{c.kicker}</Kicker>
      <h1 className="font-display text-2xl font-bold">{c.title}</h1>
      <p className="text-muted">{c.lead}</p>

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
      <Btn
        big
        variant="volt"
        className="w-full"
        disabled={!ready}
        onClick={() => {
          // The Start tap unlocks the page's audio (Safari) and warms the coach's recorded voice.
          unlockAudio();
          void warmVoice();
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

const placement = (m: Pick<MoveDef, "view">, c: { placeSide: string; placeFront: string; placeEither: string }) =>
  m.view === "side" ? c.placeSide : m.view === "front" ? c.placeFront : c.placeEither;

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
      <div className="mx-auto w-full max-w-xl space-y-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
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
  const { t, lang, fmt, prefs, workoutVoice, bpm } = useApp();
  const c = t.camera;
  const units = prefs.units;
  const now = useTick(250);
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
  const engine = useRef<CameraWorkoutEngine | null>(null);
  if (!engine.current) {
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    engine.current = new CameraWorkoutEngine(started.current, rngFrom(seed[0]!));
  }
  const e = engine.current;
  const pacer = useRef(new CuePacer());
  const framingVoice = useRef(new FramingVoice());
  const framingState = useRef<Framing>("none");
  const planIdx = useRef(0);
  const [loadKg, setLoadKg] = useState<number | undefined>(undefined);
  const [loadText, setLoadText] = useState("");
  const [nextMove, setNextMove] = useState<string | null>(plan.routine ? plan.routine.sets[0]!.move : plan.move);
  const target = useRef<PlannedSet | null>(plan.routine ? plan.routine.sets[0]! : null);
  // The strap paired in this browser (You > Heart-rate sensor): its heart rate every 10 s of the session.
  const strap = useRef<Sample[]>([]);
  const lastBpm = useRef<{ v: number; at: number } | null>(null);
  useEffect(() => {
    if (bpm !== null) lastBpm.current = { v: bpm, at: Date.now() };
  }, [bpm]);

  const voiceRef = useRef(workoutVoice);
  voiceRef.current = workoutVoice;
  const speak = useCallback((text: string, essential = false) => {
    const m = voiceRef.current;
    if (m === "off" || (!essential && m !== "on")) return;
    playCue({ text });
  }, []);

  // The first set, the one positioning line, audio off at the end.
  useEffect(() => {
    e.startSet(Date.now(), nextMove, loadKg ? { loadKg } : {});
    if (framingVoice.current.start(Date.now())) speak(FRAMING_VOICE.start[lang], true);
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

  const endSet = useCallback(() => {
    if (e.state !== "set") return;
    const tg = target.current;
    const set = e.endSet(Date.now(), tg?.restS);
    if (set) speak(fmt(c.say.setDone, { n: set.holdS ? fmt(c.say.seconds, { n: set.holdS }) : set.reps }), true);
    if (plan.routine) {
      planIdx.current++;
      const nx = plan.routine.sets[planIdx.current] ?? null;
      target.current = nx;
      setNextMove(nx?.move ?? null);
      if (!nx) speak(c.say.routineDone, true);
    }
    bump();
  }, [e, plan.routine, speak, fmt, c]);

  const onPose = useCallback(
    (f0: PoseFrame | null, at: number) => {
      const f = f0 ? { ...f0, t: at - started.current } : null;
      outline.track(at, !!f);
      setFrame(f);
      for (const x of e.push(f, at)) {
        switch (x.type) {
          case "framing":
            // On screen only: never read aloud during the workout.
            framingState.current = x.framing;
            setFraming({ framing: x.framing, missing: x.missing, tips: x.tips });
            break;
          case "rep": {
            const c1 = sayCues(voiceRef.current) ? pacer.current.pick(at, x.cues) : null;
            if (c1) {
              const line = cueLine(c1, e.set?.move ?? undefined, lang);
              setCue(line);
              speak(line);
            } else if (sayRep(x.n, voiceRef.current)) playQuick(String(x.n));
            const tg = target.current;
            if (tg?.reps && x.n >= tg.reps) endSet();
            break;
          }
          case "partial": {
            const c2 = sayCues(voiceRef.current) ? pacer.current.pick(at, ["depth"]) : null;
            if (c2) {
              const line = cueLine("depth", e.set?.move ?? undefined, lang);
              setCue(line);
              speak(line);
            }
            break;
          }
          case "hold":
            if (x.s > 0 && x.s % 10 === 0) speak(fmt(c.say.seconds, { n: x.s }), true);
            if (target.current?.holdS && x.s >= target.current.holdS) endSet();
            break;
          case "holdCue": {
            const c3 = sayCues(voiceRef.current) ? pacer.current.pick(at, x.cues) : null;
            if (c3) {
              const line = cueLine(c3, e.set?.move ?? undefined, lang);
              setCue(line);
              speak(line);
            }
            break;
          }
          case "detected": {
            const m = cameraMove(x.move);
            speak(fmt(c.say.detected, { move: m ? m.name[lang] : "" }), true);
            break;
          }
          case "restOver":
            speak(c.say.restOver, true);
            break;
          case "liveness":
            setCheck({ kind: x.kind, at });
            speak(LIVENESS_TEXT[x.kind][lang], true);
            break;
          case "livenessResult":
            setCheck(null);
            speak(x.result.ok ? c.say.thanks : c.say.missed, true);
            break;
        }
      }
      if (framingVoice.current.push(at, framingState.current) === "remind") speak(FRAMING_VOICE.remind[lang], true);
    },
    [e, outline, lang, speak, endSet, fmt, c],
  );

  useEffect(() => {
    cam.setListener(onPose);
    return () => cam.setListener(null);
  }, [cam, onPose]);

  const startSet = () => {
    unlockAudio();
    pacer.current = new CuePacer();
    e.startSet(Date.now(), nextMove, loadKg ? { loadKg } : {});
    const m = nextMove ? cameraMove(nextMove) : null;
    if (m) speak(m.name[lang], true);
    setCue(null);
    bump();
  };

  const finish = () => {
    const t2 = Date.now();
    const summary = e.summary(t2);
    const activeS = Math.round(e.sessionS(t2));
    if (!summary || cameraSessionEmpty(activeS, summary)) {
      hush();
      setNothing(true);
      return;
    }
    hush();
    onDone({ summary, startedAt: started.current, endedAt: t2, activeS, sport: e.sport(), strap: strap.current });
  };

  const togglePause = () => {
    unlockAudio();
    if (paused) e.resume(Date.now());
    else e.pause(Date.now());
    cam.setPaused(!paused);
    setPaused(!paused);
    speak(paused ? t.workout.resumed : t.workout.paused, true);
  };

  const set = e.set;
  const move = set?.move ?? null;
  const sessionS = Math.floor(e.sessionS(now));
  const resting = e.state === "rest";
  const restLeft = resting && e.restUntilMs ? e.restUntilMs - now : 0;
  const nextDef = nextMove ? cameraMove(nextMove) : null;
  const switchTo = move ? lookalikes(move.id) : [];
  const checkLeft = check ? Math.max(0, 6 - Math.floor((now - check.at) / 1000)) : 0;
  const outlineVisible = outline.visible(now);
  const setsSoFar = e.log.reduce((n, m) => n + m.sets.length, 0) + (e.state === "set" && (set?.reps || set?.holdS) ? 1 : 0);

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
      <Preview cam={cam} frame={frame} outlineVisible={outlineVisible} className="min-h-0 flex-1">
        {/* Top: the controls, the clock, the strap's heart rate. */}
        <div className="absolute inset-x-0 top-0 space-y-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <TopBtn onClick={() => setConfirmEnd(true)}>■ {c.end}</TopBtn>
            <TopBtn onClick={togglePause}>{paused ? `▶ ${c.resume}` : `❚❚ ${c.pause}`}</TopBtn>
            <TopBtn onClick={() => setOutlineOn(!outlineOn)} pressed={outlineOn}>
              {c.outline}
            </TopBtn>
            {cam.cameras > 1 && <TopBtn onClick={cam.flip}>⟲ {c.switchCamera}</TopBtn>}
            <span className="flex-1" />
            {bpm ? <span className="rounded-full bg-black/60 px-3 py-1 font-semibold text-pulse-fg tabular-nums">♥ {bpm}</span> : null}
            <span className="rounded-full bg-black/60 px-3 py-1 font-display text-lg font-semibold text-white tabular-nums">
              {restClock(sessionS * 1000)}
            </span>
          </div>
          {framingNow.framing !== "ok" ? <FramingTips shown={framingNow} compact={e.state === "set"} lang={lang} /> : null}
          {paused && <p className="rounded-xl bg-butter/90 px-3 py-2 text-center font-semibold text-ink">{c.paused}</p>}
          {cam.slow && <p className="rounded-xl bg-black/70 px-3 py-1 text-center text-xs text-white">{c.slow}</p>}
        </div>

        {/* The count. */}
        <div className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center text-center [text-shadow:0_2px_8px_#000]">
          {!resting ? (
            <>
              <p className="text-lg font-semibold text-white">{move ? move.name[lang] : c.detecting}</p>
              <p className="font-display text-8xl leading-none font-bold text-volt tabular-nums">
                {move?.kind === "hold" ? `${Math.floor(set?.holdS ?? 0)}s` : String(set?.reps ?? 0)}
              </p>
              {target.current && (
                <p className="text-white">
                  {target.current.reps
                    ? fmt(c.of, { n: target.current.reps })
                    : target.current.holdS
                      ? fmt(c.ofS, { n: target.current.holdS })
                      : ""}
                </p>
              )}
              {set?.loadKg ? <p className="text-white">{`${kgToUnits(set.loadKg, units)} ${loadUnit(units)}`}</p> : null}
              {move && move.judge !== "camera" && (
                <p className="mt-1 rounded-full bg-sky/80 px-3 py-0.5 text-sm text-ink">{c.judge[move.judge]}</p>
              )}
              {cue && <p className="mt-3 rounded-full bg-pulse/90 px-4 py-2 font-semibold text-ink">{cue}</p>}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-white">{c.rest}</p>
              <p className="font-display text-7xl leading-none font-bold text-volt tabular-nums">{restClock(restLeft)}</p>
              <p className="text-white">
                {nextDef ? fmt(c.next, { move: nextDef.name[lang] }) : plan.routine ? c.routineDone : c.nextMove}
              </p>
            </>
          )}
        </div>

        {/* A liveness check: big, with its countdown. */}
        {check && (
          <div role="alert" className="absolute inset-x-5 top-[45%] rounded-2xl bg-volt/95 p-4 text-center text-ink">
            <p className="font-display text-2xl font-bold">{LIVENESS_TEXT[check.kind][lang]}</p>
            <p>{fmt(c.checkLeft, { n: checkLeft })}</p>
          </div>
        )}

        {!outlineVisible && (
          <button
            type="button"
            onClick={() => outline.show(Date.now())}
            className="absolute bottom-3 left-3 h-10 rounded-full bg-black/60 px-4 text-sm font-semibold text-white"
          >
            {c.showOutline}
          </button>
        )}
      </Preview>

      {/* Bottom: the set's controls, or the rest's. */}
      <div className="border-t border-line bg-night-2 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto max-w-xl space-y-2">
          <Small>{c.keepOpen}</Small>
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
          ) : !resting ? (
            <>
              {move?.judge === "manual" && <Small>{move.kind === "reps" ? c.manualReps : c.manualHold}</Small>}
              {switchTo.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {switchTo.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        e.switchMove(m.id);
                        setNextMove(m.id);
                        bump();
                      }}
                      className="min-h-10 rounded-full border border-line px-3 text-sm"
                    >
                      {m.name[lang]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {move?.kind !== "hold" && (
                  <Btn
                    big
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
                <Btn big className="flex-1" onClick={endSet}>
                  {c.endSet}
                </Btn>
                {move?.kind !== "hold" && (
                  <Btn
                    big
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
              </div>
              {move && move.kind === "hold" && move.judge === "manual" && (
                <Btn
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    e.setHold(Math.max(0, (Date.now() - (set?.startedMs ?? Date.now())) / 1000));
                    bump();
                  }}
                >
                  {c.timeIt}
                </Btn>
              )}
            </>
          ) : (
            <>
              {(nextDef?.weighted || (!nextDef && move?.weighted)) && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{c.load}</span>
                  <input
                    className="h-11 w-24 rounded-xl border border-line bg-surface px-3 text-right tabular-nums"
                    inputMode="decimal"
                    value={loadText}
                    onChange={(ev) => {
                      setLoadText(ev.target.value);
                      setLoadKg(loadToKg(ev.target.value, units));
                    }}
                  />
                  <span>{loadUnit(units)}</span>
                </label>
              )}
              <div className="flex gap-2">
                <Btn big className="flex-1" onClick={plan.routine && !nextDef ? () => setConfirmEnd(true) : startSet}>
                  {plan.routine && !nextDef ? c.finish : c.startNext}
                </Btn>
                <Btn big variant="ghost" onClick={() => setConfirmEnd(true)}>
                  {c.finish}
                </Btn>
              </div>
              <button type="button" onClick={() => setNextMove(null)} className="w-full py-1 text-center text-sm text-sky-fg">
                {c.anotherMove}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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

// ── Summary ─────────────────────────────────────────────────────────────────────────────────────────────────────

function Summary({ result }: { result: LiveResult }) {
  const app = useApp();
  const { t, lang, fmt, go, prefs, me, athlete, deviceKey, energy, setEnergy, api, refresh, setQueue, queue, streak } = app;
  const c = t.camera;
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState<UploadReply | null>(null);
  const [saved, setSaved] = useState<WebSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const totals = cameraTotals(result.summary);
  const volume = cameraVolumeKg(result.summary);
  const strapHeart = result.strap.filter((s) => s.bpm !== undefined).length >= 2;
  const preview = cameraPointsPreview(result.summary, result.activeS);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const save = () => {
    setSaving(true);
    const session = toWebCameraSession({
      id: uuid(),
      sport: result.sport,
      startedAtMs: result.startedAt,
      endedAtMs: result.endedAt,
      activeS: result.activeS,
      summary: result.summary,
      deviceKey,
      ...(strapHeart
        ? {
            strap: {
              samples: result.strap,
              heart: heartProfileOf(athlete?.health ?? null, result.sport),
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
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  };

  const got = reply?.session;
  const reason = got?.cameraReason ?? null;
  const reasonText = (r: string) => (r in c.reason ? c.reason[r as keyof typeof c.reason] : null);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-16">
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
          {result.summary.moves.map((m) => {
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
        {result.summary.liveness.asked > 0 && (
          <Small className="mt-2">{fmt(c.checks, { passed: result.summary.liveness.passed, asked: result.summary.liveness.asked })}</Small>
        )}
        <Small className="mt-2">{c.privacyLine}</Small>
      </Card>
      <Card tone="volt">
        <Kicker tone="volt">{c.pointsTitle}</Kicker>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-display text-xl leading-tight font-bold tabular-nums">{value}</dd>
    </div>
  );
}
