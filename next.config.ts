import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite is a Node builtin, so nothing to externalise; instrumentation.ts
  // is picked up automatically and runs the deal scheduler.
  poweredByHeader: false,
};

export default nextConfig;
