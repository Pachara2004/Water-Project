"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCollectorFilters } from "@/lib/hooks/useCollectorFilters";

import CollectorMobile from "./collectorMobile";
import CollectorDesktop from "./collectorDesktop";

export default function CollectorDashboardPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin" && currentUser.role !== "officer") {
            router.push("/map");
        }
    }, [currentUser, router]);

    const filterState = useCollectorFilters({ currentUser });

    return isMobile ? <CollectorMobile {...filterState} /> : <CollectorDesktop {...filterState} />;
}
