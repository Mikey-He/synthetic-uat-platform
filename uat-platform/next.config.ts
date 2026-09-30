import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `next dev` from appending its own block to CLAUDE.md.
  agentRules: false,
  // No dev-only button on screen, so local screenshots match what participants see.
  devIndicators: false,
};

export default nextConfig;
