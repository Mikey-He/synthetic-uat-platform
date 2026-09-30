import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `next dev` from appending its own block to CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
