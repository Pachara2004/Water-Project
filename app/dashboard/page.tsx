"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { useRouter } from "next/navigation";
import AnalyticsCharts, { SampleItem } from "@/components/AnalyticsCharts";
import ExportButtons from "@/components/dashboard/ExportButtons";

interface ApiSampleResponse {
    id: number;
    locationId: number;
    status: "safe" | "warning" | "danger" | string;
    collectionTime: string;
    collectorId: number;
    rawImageUrl?: string | null;
    analyzedPlotUrl?: string | null;
    isDeleted: boolean;
    phosphateValue?: number | null;
    ammoniaValue?: number | null;
    location?: {
        name: string;
        organization: string;
    } | null;
}

export default function ExecutiveDashboard() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [samples, setSamples] = useState<SampleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");

    useEffect(() => {
        if (!currentUser) return;

        // ตรวจจับระดับสิทธิ์ระบบพิมพ์เล็กสากล
        const userRole = currentUser.role?.toLowerCase();
        if (userRole !== "officer" && userRole !== "admin" && userRole !== "collector") {
            router.push("/map");
            return;
        }

        if (userRole === "collector") {
            setViewMode("MINE");
        } else {
            setViewMode("ALL");
        }

        // SECURITY FIX: สลัดพารามิเตอร์ ?collectedBy= ออกไปเพื่อปิดช่องโหว่การสุ่มเดาไอดีข้ามสิทธิ์
        // ปล่อยให้หลังบ้านใช้ตั๋ว Token ตรวจสอบความเป็นเจ้าของประวัติเอง
        let apiUrl = "/api/samples";

        fetch(apiUrl, {
            method: "GET",
            headers: {
                // แนบ LINE Access Token ส่งไปพิสูจน์ยืนยันสิทธิ์สูงสุดของแอดมิน/ผู้บริหาร
                Authorization: `Bearer ${liff.getAccessToken()}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    const mapped = data.map((s: ApiSampleResponse) => ({
                        id: String(s.id),
                        locationId: String(s.locationId),
                        status: s.status ? (s.status.toUpperCase() as any) : "SAFE",
                        collectedAt: s.collectionTime,
                        collectedBy: s.collectorId,
                        imageUrl: s.rawImageUrl,
                        imagePlotUrl: s.analyzedPlotUrl,
                        isDelete: s.isDeleted,
                        updatedBy: null,
                        phosphateVal: s.phosphateValue,
                        ammoniaVal: s.ammoniaValue,
                        location: s.location
                            ? {
                                  id: String(s.locationId),
                                  name: s.location.name,
                                  organization: s.location.organization,
                              }
                            : undefined,
                    }));
                    setSamples(mapped);
                } else {
                    setSamples([]);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [currentUser, router]);

    const filteredSamples = useMemo(() => {
        if (!currentUser) return [];

        const userRole = currentUser.role?.toLowerCase();
        if (viewMode === "MINE" || userRole === "collector") {
            return samples.filter((sample: any) => sample.collectedBy === currentUser.id);
        }

        return samples;
    }, [samples, viewMode, currentUser]);

    if (loading) {
        return (
            <div className="min-h-dvh bg-surface-muted pb-10 w-full p-5 sm:p-8 space-y-6">
                <div className="w-full h-52 rounded-3xl shimmer border border-border" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="w-full h-24 rounded-2xl bg-surface shimmer border border-border" />
                    ))}
                </div>
                <div className="w-full h-64 rounded-3xl shimmer border border-border" />
            </div>
        );
    }

    // แมปบทบาทผู้ใช้ให้แสดงผลคำกำกับบนปุ่มได้เสถียรทั้งพิมพ์เล็กพิมพ์ใหญ่
    const isUserAdmin = currentUser?.role?.toUpperCase() === "ADMIN";
    const isUserCollector = currentUser?.role?.toUpperCase() === "COLLECTOR";
    const isUserExecutive = currentUser?.role?.toUpperCase() === "EXECUTIVE" || currentUser?.role?.toUpperCase() === "OFFICER";

    return (
        <div className="min-h-screen w-full bg-surface-muted pb-16 transition-colors duration-300">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 space-y-6 pt-6 sm:pt-10">
                <div className="relative w-full rounded-xl bg-surface p-6 sm:p-8 border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="space-y-1.5">
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary flex items-center gap-2">
                            ระบบวิเคราะห์และติดตาม <span className="text-primary font-black">คุณภาพน้ำทะเล</span>
                        </h1>
                        <p className="text-text-secondary text-xs sm:text-sm">ศูนย์ข้อมูลคุณภาพสารเคมีแบบเรียลไทม์ และสถิติความแปรปรวนเชิงลึกเพื่อการเฝ้าระวังทางสิ่งแวดล้อม </p>
                    </div>
                    <ExportButtons />
                </div>

                {isUserAdmin && (
                    <div className="px-5 sm:px-8 mb-2 flex justify-end">
                        <div className="inline-flex rounded-xl p-1 bg-surface border border-border shadow-sm">
                            <button
                                onClick={() => setViewMode("ALL")}
                                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                                    viewMode === "ALL" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                ภาพรวมทั้งหมด
                            </button>
                            <button
                                onClick={() => setViewMode("MINE")}
                                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                                    viewMode === "MINE" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                ข้อมูลของฉัน
                            </button>
                        </div>
                    </div>
                )}

                {isUserCollector && <div className="px-5 sm:px-8 mb-2 text-xs text-text-secondary text-right">แสดงเฉพาะข้อมูลการจัดเก็บของคุณ</div>}
                {isUserExecutive && <div className="px-5 sm:px-8 mb-2 text-xs text-text-secondary text-right">แสดงภาพรวมข้อมูลทั้งหมดในระบบ</div>}

                <div className="px-5 sm:px-8 mt-4 sm:mt-5">
                    <AnalyticsCharts samples={filteredSamples} />
                </div>
            </div>
        </div>
    );
}
