import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // นำมาไว้ระดับนอกสุด ตรงตามที่ Next.js แจ้งเตือน
    // @ts-ignore
    allowedDevOrigins: ["desktops-issued-kids-collectors.trycloudflare.com"],

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
