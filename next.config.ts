import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp"],
  experimental: {
    // Allow large base64 image payloads through server actions / route handlers.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
