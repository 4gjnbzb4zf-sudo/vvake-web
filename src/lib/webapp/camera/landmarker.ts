import type { Landmark } from "./webPose";

/**
 * MediaPipe Pose Landmarker (lite, one person, video mode) in this browser tab (ADR-0046 amendment 2026-10-21 in the
 * monorepo): Google's @mediapipe/tasks-vision (Apache-2.0), its WebAssembly runtime and the model served by vvake.com
 * itself (/mediapipe/, copied at build by scripts/copy-mediapipe.ts; /models/pose_landmarker_lite.task, the same
 * model file as the Android app), so nothing is fetched from anyone else. WebGL (GPU) when the browser has it, else
 * the CPU. Each frame is read from the <video> element in memory and dropped: nothing is recorded, kept or sent.
 */

export const MEDIAPIPE_BASE = "/mediapipe";
export const POSE_MODEL = "/models/pose_landmarker_lite.task";

export interface PoseDetector {
  /** One person's 33 landmarks in this video frame (normalised, unmirrored), or null when nobody is there. */
  detect(video: HTMLVideoElement, nowMs: number): Landmark[] | null;
  delegate: "GPU" | "CPU";
  close(): void;
}

type Vision = typeof import("@mediapipe/tasks-vision");
let vision: Promise<Vision> | null = null;
let fileset: Promise<Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>>> | null = null;

/** Loads the runtime and the model (once per visit; the browser's cache keeps the files for the next one). */
export async function createPoseDetector(): Promise<PoseDetector> {
  vision ??= import("@mediapipe/tasks-vision");
  const v = await vision;
  fileset ??= v.FilesetResolver.forVisionTasks(MEDIAPIPE_BASE);
  const files = await fileset;
  const make = (delegate: "GPU" | "CPU") =>
    v.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      // The Android app's thresholds (modules/vvake-pose PoseCameraView.kt).
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  let delegate: "GPU" | "CPU" = "GPU";
  let lm: Awaited<ReturnType<typeof make>>;
  try {
    lm = await make("GPU");
  } catch {
    delegate = "CPU";
    lm = await make("CPU");
  }
  let last = -1;
  return {
    delegate,
    detect(video, nowMs) {
      if (video.readyState < 2 || !video.videoWidth) return null;
      // Video mode wants increasing timestamps.
      const ts = Math.max(last + 1, Math.round(nowMs));
      last = ts;
      const r = lm.detectForVideo(video, ts);
      const one = r.landmarks?.[0];
      return one && one.length >= 29 ? (one as Landmark[]) : null;
    },
    close() {
      try {
        lm.close();
      } catch {
        // already closed
      }
    },
  };
}
