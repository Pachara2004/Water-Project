import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow any image source for development
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Empty turbopack config to satisfy Next.js 16
  turbopack: {},
};

export default nextConfig;
