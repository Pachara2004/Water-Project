"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { type CollectorSample } from "@/lib/hooks/useCollectorFilters";

import CollectorMobile from "./collectorMobile";
import CollectorDesktop from "./collectorDesktop";

export default function CollectorDashboardPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [samples, setSamples] = useState<CollectorSample[]>([]);
    const [loading, setLoading] = useState(true);

    const isMobile = useMediaQuery("(max-width: 767px)");

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin" && currentUser.role !== "officer") {
            router.push("/map");
            return;
        }

        fetch("/api/samples", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${liff.getAccessToken()}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลประวัติผลน้ำได้");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    const mapped = data.map((s: any) => ({
                        id: s.id,
                        locationId: s.locationId,
                        status: s.status,
                        collectedAt: s.collectionTime,
                        collectedBy: s.collectorId,
                        imageUrl: s.rawImageUrl,
                        imagePlotUrl: s.analyzedPlotUrl,
                        isDeleted: s.isDeleted,
                        updatedBy: s.lastModifiedBy,

                        ...s,

                        location: s.location
                            ? {
                                  id: s.locationId,
                                  name: s.location.name,
                                  organization: s.location.organization,
                              }
                            : null,
                    }));
                    setSamples(mapped);
                } else {
                    setSamples([]);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [currentUser, router]);

    const props = { samples, loading };

    return isMobile ? <CollectorMobile {...props} /> : <CollectorDesktop {...props} />;
}
