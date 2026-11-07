import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
  },
  serverExternalPackages: ["mongoose", "@privy-io/node", "@celo/buy-core", "@celo/buy-keystore", "node:sqlite"],
};

export default nextConfig;
