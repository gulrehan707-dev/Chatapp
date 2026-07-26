import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@slack-lite/shared"],
};

export default nextConfig;
