import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder; an unrelated lockfile in the user's
  // home directory otherwise makes Next guess the wrong root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
