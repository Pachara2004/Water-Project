"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import DashboardMobile from "./dashboardMobile";
import DashboardDesktop from "./dashboardDesktop";

export default function DashboardPage() {
    const isMobile = useMediaQuery("(max-width: 767px)");
    return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
}
