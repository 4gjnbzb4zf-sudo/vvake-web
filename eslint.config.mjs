import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/maplibre/**",
    "public/mediapipe/**",
    "next-env.d.ts",
  ]),
  // game-core copied byte for byte by scripts/sync-living-core.ts (never edited here): the monorepo's own lint rules apply.
  { files: ["src/lib/webapp/living/**"], rules: { "prefer-const": "off" } },
]);

export default eslintConfig;
