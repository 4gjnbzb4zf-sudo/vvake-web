import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages: no server at runtime.
 * `trailingSlash` makes every route a folder with index.html (/en/ → /en/index.html),
 * which is what Pages serves.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root so Turbopack ignores lockfiles in parent folders.
  turbopack: { root: __dirname },
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
