import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["cesium", "@cesium/widgets"],
  env: {
    CESIUM_BASE_URL: "/cesium",
  },
};

export default nextConfig;
