import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  turbopack: { root: process.cwd() },
};
export default config;
