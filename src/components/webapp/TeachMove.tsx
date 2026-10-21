"use client";
/* eslint-disable react-hooks/refs -- the recorder and the counters (game-core cameraTemplate.ts) are mutable objects fed by pose frames outside React, read on each render like the workout screen does. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getTrainingsDict } from "@/i18n/trainings";
import { ApiError } from "@/lib/rewardsApi";
import { cn } from "@/lib/cn";
import { trainingsApi } from "@/lib/trainings/api";
import { ICON_GLYPH, moveNameProblem, newMoveBody } from "@/lib/trainings/builder";
import { CUSTOM_MOVE_ICONS, CUSTOM_MOVE_NAME_MAX } from "@/lib/webapp/camera/cameraCustom";
import type { PoseFrame } from "@/lib/webapp/camera/cameraPose";
import {
  liveTestPassed,
  TemplateCounter,
  TemplateHold,
  TemplateRecorder,
  TEST_REPS,
  type MoveTemplate,
  type TeachError,
} from "@/lib/webapp/camera/cameraTemplate";
import { ugcProblemText } from "@/lib/webapp/camera/ugc";
import { playQuick, unlockAudio } from "@/lib/webapp/coachAudio";
import { useApp } from "./AppContext";
import type { Webcam } from "./CameraScreen";
import { Btn, Card, Field, inputCls, Kicker, Note, Segmented, Small } from "./ui";

type Step =
  | { kind: "setup" }
  | { kind: "countdown"; until: number }
  | { kind: "record"; since: number }
  | { kind: "failed"; error: TeachError | "test"; counted?: number }
  | { kind: "test"; since: number }
  | { kind: "name" }
  | { kind: "saved" };

/** Reps: recording stops by itself at 5 reps seen or 30 s; a hold after 8 s. The test gives up after 30 s. */
const RECORD_MAX_MS = 30_000;
const HOLD_RECORD_MS = 8_000;
const TEST_MAX_MS = 30_000;

/**
 * Teach VVake a move with the webcam (ADR-0047 §2, the phone's Teach a move): 3 to 5 reps (or a hold of 3 s or more)
 * recorded as pose frames into game-core's TemplateRecorder, the template built in this tab (numbers only: joint-angle
 * curves, timing, stick-figure keyframes; no video, no picture), then a live test (3 more reps, liveTestPassed), a name
 * and an icon (the public text filter), and POST /v1/moves. The webcam stream is the camera screen's (one permission).
 */
export function TeachMove({
  cam,
  check,
  preview,
}: {
  cam: Webcam;
  check: ReactNode;
  preview: (frame: PoseFrame | null, children?: ReactNode) => ReactNode;
}) {
  const { lang, go, session, fmt } = useApp();
  const d = getTrainingsDict(lang).app.teach;
  const [kind, setKind] = useState<"reps" | "hold">("reps");
  const [step, setStep] = useState<Step>({ kind: "setup" });
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [now, setNow] = useState(0);
  const [seen, setSeen] = useState(0);
  const [template, setTemplate] = useState<MoveTemplate | null>(null);
  const [counted, setCounted] = useState(0);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(CUSTOM_MOVE_ICONS[0]);
  const [weighted, setWeighted] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<TemplateRecorder | null>(null);
  const counter = useRef<TemplateCounter | TemplateHold | null>(null);
  const t0 = useRef(0);
  const countedRef = useRef(0);
  const lastSeenAt = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;

  const ready = cam.state === "ready" && cam.running && cam.model === "ready";

  const finishRecording = () => {
    const rec = recorder.current;
    if (!rec) return;
    const r = rec.build();
    recorder.current = null;
    if (!r.ok || !r.template) return setStep({ kind: "failed", error: r.error ?? "not_seen" });
    setTemplate(r.template);
    counter.current = r.template.kind === "hold" ? new TemplateHold(r.template) : new TemplateCounter(r.template);
    countedRef.current = 0;
    setCounted(0);
    setStep({ kind: "test", since: Date.now() });
  };
  const finishTest = (n: number) => {
    if (stepRef.current.kind !== "test") return;
    stepRef.current = { kind: "name" };
    counter.current = null;
    if (liveTestPassed(Math.min(n, TEST_REPS))) setStep({ kind: "name" });
    else setStep({ kind: "failed", error: "test", counted: n });
  };

  // The clock: the countdown, the automatic stops.
  useEffect(() => {
    if (step.kind !== "countdown" && step.kind !== "record" && step.kind !== "test") return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      const s = stepRef.current;
      if (s.kind === "countdown" && at >= s.until) {
        recorder.current = new TemplateRecorder(kind);
        t0.current = at;
        setSeen(0);
        setStep({ kind: "record", since: at });
      } else if (s.kind === "record") {
        if (kind === "reps" && at - lastSeenAt.current > 1000 && recorder.current) {
          lastSeenAt.current = at;
          setSeen(recorder.current.repsSoFar());
        }
        if ((kind === "hold" && at - s.since >= HOLD_RECORD_MS) || at - s.since >= RECORD_MAX_MS) finishRecording();
      } else if (s.kind === "test" && at - s.since >= TEST_MAX_MS) finishTest(countedRef.current);
    }, 250);
    return () => window.clearInterval(id);
    // The step's own clock; the handlers read the latest state through refs.
  }, [step.kind, kind]);

  // Pose frames: into the recorder while recording, into the template's counter while testing.
  useEffect(() => {
    if (step.kind === "setup" || step.kind === "name" || step.kind === "saved" || step.kind === "failed") return;
    cam.setListener((f0, at) => {
      const f = f0 ? { ...f0, t: at - t0.current } : null;
      setFrame(f);
      const s = stepRef.current;
      if (s.kind === "record" && f) recorder.current?.push(f);
      if (s.kind === "test" && f && counter.current) {
        if (counter.current instanceof TemplateCounter) {
          const n = counter.current.push(f).reps.length;
          if (n) {
            countedRef.current += n;
            const next = countedRef.current;
            setCounted(next);
            playQuick(String(next));
            if (next >= TEST_REPS) window.setTimeout(() => finishTest(countedRef.current), 600);
          }
        } else {
          counter.current.push(f);
          countedRef.current = Math.floor(counter.current.heldS);
          setCounted(countedRef.current);
          if (countedRef.current >= TEST_REPS) finishTest(countedRef.current);
        }
      }
    });
    return () => cam.setListener(null);
    // Re-attached when the step changes (the listener reads the step through a ref).
  }, [cam, step.kind]);

  const start = () => {
    unlockAudio();
    t0.current = Date.now();
    setNow(Date.now());
    setStep({ kind: "countdown", until: Date.now() + 3000 });
  };

  const save = async () => {
    if (!template) return;
    const p = moveNameProblem(name);
    if (p) return setMsg(p === "long" ? `${CUSTOM_MOVE_NAME_MAX} max.` : ugcProblemText(p, lang));
    setBusy(true);
    setMsg(null);
    try {
      await trainingsApi(session).createMove(newMoveBody(template, name, icon, weighted, true));
      setStep({ kind: "saved" });
    } catch (e) {
      setMsg(
        e instanceof ApiError && (e.status === 429 || e.status === 409)
          ? d.limit
          : e instanceof ApiError && e.status === 422
            ? ugcProblemText("abuse", lang)
            : d.error,
      );
    } finally {
      setBusy(false);
    }
  };

  const live = step.kind === "countdown" || step.kind === "record" || step.kind === "test";
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
      <button type="button" className="h-11 text-sm text-muted" onClick={() => go({ name: "trainings" })}>
        ‹ {getTrainingsDict(lang).app.title}
      </button>
      <Kicker tone="volt">{getTrainingsDict(lang).app.teachCta}</Kicker>
      <h1 className="font-display text-2xl font-bold">{d.title}</h1>
      <p className="text-muted">{d.lead}</p>

      {step.kind === "setup" && (
        <>
          {check}
          <div>
            <span className="mb-1 block text-sm font-medium">{d.kind}</span>
            <Segmented
              label={d.kind}
              value={kind}
              onChange={setKind}
              options={[
                { value: "reps", label: d.reps },
                { value: "hold", label: d.hold },
              ]}
            />
          </div>
          <Btn big variant="volt" className="w-full" disabled={!ready} onClick={start}>
            {d.record}
          </Btn>
        </>
      )}

      {live &&
        preview(
          frame,
          <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-4 text-center [text-shadow:0_2px_8px_#000]">
            {step.kind === "countdown" && (
              <p className="font-display text-3xl font-bold text-white">
                {fmt(d.countdown, { n: Math.max(1, Math.ceil((step.until - now) / 1000)) })}
              </p>
            )}
            {step.kind === "record" && (
              <p className="font-display text-3xl font-bold text-white">
                {kind === "hold" ? d.recordingHold : fmt(d.recording, { n: seen })}
              </p>
            )}
            {step.kind === "test" && (
              <>
                <p className="font-display text-2xl font-bold text-white">{kind === "hold" ? d.testHold : d.testTitle}</p>
                <p className="font-display text-6xl font-bold text-volt tabular-nums">{counted}</p>
                <p className="text-lg text-white">{fmt(kind === "hold" ? d.testHeld : d.testCount, { n: counted })}</p>
              </>
            )}
          </div>,
        )}
      {step.kind === "record" && (
        <Btn big className="w-full" onClick={finishRecording}>
          {d.stop}
        </Btn>
      )}
      {step.kind === "test" && (
        <Btn big variant="ghost" className="w-full" onClick={() => finishTest(countedRef.current)}>
          {d.testDone}
        </Btn>
      )}

      {step.kind === "failed" && (
        <Card tone="butter">
          <p>{step.error === "test" ? fmt(d.testFail, { n: step.counted ?? 0 }) : d.errors[step.error]}</p>
          <Btn className="mt-3" onClick={() => setStep({ kind: "setup" })}>
            {d.again}
          </Btn>
        </Card>
      )}

      {step.kind === "name" && template && (
        <Card>
          <Note tone="volt">{d.testOk}</Note>
          <Small className="mt-2">{d.quality[template.quality]}</Small>
          <div className="mt-3 space-y-3">
            <Field label={d.name}>
              <input className={inputCls} maxLength={CUSTOM_MOVE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div>
              <span className="mb-1 block text-sm font-medium">{d.icon}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={d.icon}>
                {CUSTOM_MOVE_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={icon === i}
                    aria-label={i}
                    onClick={() => setIcon(i)}
                    className={cn(
                      "h-11 w-11 rounded-xl border text-lg",
                      icon === i ? "border-volt bg-volt/20" : "border-line bg-surface-2",
                    )}
                  >
                    {ICON_GLYPH[i] ?? "●"}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
              {d.weighted}
            </label>
            {msg && <Note tone="butter">{msg}</Note>}
            <Btn big variant="volt" className="w-full" disabled={busy || !name.trim()} onClick={() => void save()}>
              {d.save}
            </Btn>
          </div>
        </Card>
      )}

      {step.kind === "saved" && (
        <Card tone="volt">
          <p>{d.saved}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="volt" onClick={() => go({ name: "build" })}>
              {getTrainingsDict(lang).app.build}
            </Btn>
            <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
              {getTrainingsDict(lang).app.title}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
