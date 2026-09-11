import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // All media is served from R2 public URLs or uploaded at runtime; no remote optimizer needed.
  images: { unoptimized: true },
};

export default nextConfig;
