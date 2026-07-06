import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // บล็อกคำสั่งเช็กความปลอดภัย HMR
    allowedDevOrigins: ["localhost:3000", "noble-arc-elizabeth-wages.trycloudflare.com"],

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    turbopack: {},
};

export default nextConfig;
