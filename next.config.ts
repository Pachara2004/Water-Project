import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // บล็อกคำสั่งเช็กความปลอดภัย HMR
    allowedDevOrigins: ["localhost:3000", "192.168.137.1:3000", "constraint-austin-availability-gardening.trycloudflare.com"],

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    devIndicators: {
        buildActivity: false,
        appIsrStatus: false,
    },
    turbopack: {},
};

export default nextConfig;
