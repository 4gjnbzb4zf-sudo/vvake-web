/**
 * Copies MediaPipe Tasks Vision's WebAssembly runtime (Apache-2.0) to public/mediapipe/, so the web app's camera
 * workout loads it from vvake.com itself (src/lib/webapp/camera/landmarker.ts): the loader script is allowed by the
 * app pages' script-src 'self', the .wasm by 'wasm-unsafe-eval' (app pages only). The SIMD build and the one for older
 * browsers without SIMD; the model is committed in public/models/. Run before dev and build; public/mediapipe/ is not
 * committed.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(process.cwd(), "public", "mediapipe");
mkdirSync(to, { recursive: true });
for (const f of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
])
  copyFileSync(join(from, f), join(to, f));
console.log("mediapipe: runtime copied to public/mediapipe/");
