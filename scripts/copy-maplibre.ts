/**
 * Copies MapLibre GL JS's worker (and the chunk it imports) to public/maplibre/, so the web app's live map loads its
 * worker from vvake.com itself: `new Worker("/maplibre/maplibre-gl-worker.mjs", { type: "module" })` is allowed by the
 * CSP's default-src 'self' (no blob: worker). Run before dev and build; public/maplibre/ is not committed.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = join(process.cwd(), "node_modules", "maplibre-gl", "dist");
const to = join(process.cwd(), "public", "maplibre");
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(from, f), join(to, f));
console.log("maplibre: worker copied to public/maplibre/");
