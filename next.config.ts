import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // CCTV SaaS is served at https://inventoryos.xyz/cctv
  basePath: "/cctv",

  // Keep @react-pdf/renderer external (not bundled inline).
  // pdfkit (a transitive dep) uses Node.js subpath imports (`#standard-fonts/*`)
  // defined in its package.json `imports` field. When Next.js bundles pdfkit into
  // the standalone server, the `imports` field resolution context is lost,
  // causing `Cannot find module '#standard-fonts/Helvetica'` at runtime (caution.md §22).
  // Marking @react-pdf/renderer as external keeps it + its deps (pdfkit,
  // @react-pdf/font) in node_modules, where the `imports` field works correctly.
  serverExternalPackages: ["@react-pdf/renderer"],

  reactStrictMode: false,

  // PWA: allow manifest + service worker
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
