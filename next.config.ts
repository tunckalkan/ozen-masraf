import type { NextConfig } from "next";

const nextConfig = {
  allowedDevOrigins: [
    "192.168.1.135",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
} as NextConfig;

module.exports = nextConfig;
export default nextConfig;