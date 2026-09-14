import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // CCTV SaaS is served at https://inventoryos.xyz/cctv
  basePath: "/cctv",

  typescript: {
    ignoreBuildErrors: true,
  },

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
