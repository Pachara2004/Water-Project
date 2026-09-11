import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // บล็อกคำสั่งเช็กความปลอดภัย HMR
    allowedDevOrigins: ["localhost:3000", "192.168.137.1:3000", "beds-naples-invest-lodge.trycloudflare.com"],

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    // ซ่อนปุ่ม N (Next.js DevTools) มุมจอตอน dev; error overlay ยังขึ้นตามปกติ
    devIndicators: false,
    turbopack: {},
};

export default nextConfig;
