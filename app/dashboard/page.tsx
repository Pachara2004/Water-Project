"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDashboardAnalytics } from "@/lib/hooks/useDashboardAnalytics";
import DashboardMobile from "./dashboardMobile";
import DashboardDesktop from "./dashboardDesktop";

// เรียก useDashboardAnalytics ครั้งเดียวที่นี่ ไม่ใช่ในแต่ละ view — กัน filter/analytics
// รีเซ็ตเวลา resize ข้าม breakpoint แล้ว React unmount/mount component ใหม่
export default function DashboardPage() {
    const isMobile = useMediaQuery("(max-width: 767px)");
    const analyticsState = useDashboardAnalytics();
    return isMobile ? <DashboardMobile {...analyticsState} /> : <DashboardDesktop {...analyticsState} />;
}
