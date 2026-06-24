"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import AnalyticsCharts, { SampleItem } from "@/components/AnalyticsCharts";
import ExportButtons from "@/components/dashboard/ExportButtons";

interface ApiSampleResponse {
    id: string;
    locationId: string;
    status: "SAFE" | "WARNING" | "DANGER";
    collectionTime: string;
    collectorId: string;
    imageUrl?: string | null;
    imagePlotUrl?: string | null;
    isDelete: boolean;
    updatedBy?: string | null;
    phosphate?: number | null;
    ammonia?: number | null;
    location?: {
        name: string;
        agency: string;
    } | null;
}

export default function ExecutiveDashboard() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [samples, setSamples] = useState<SampleItem[]>([]);
    const [loading, setLoading] = useState(true);

    // viewMode: 'ALL' = ภาพรวมทั้งหมด, 'MINE' = ของตัวเอง
    const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");

    useEffect(() => {
        if (!currentUser) return;
        if (
            currentUser.role !== "EXECUTIVE" &&
            currentUser.role !== "ADMIN" &&
            currentUser.role !== "COLLECTOR"
        ) {
            router.push("/map");
            return;
        }

        // 1. กำหนดค่าเริ่มต้นตามสิทธิ์การใช้งาน
        if (currentUser.role === "COLLECTOR") {
            setViewMode("MINE");
        } else {
            setViewMode("ALL");
        }

        // 2. ถ้าเป็น COLLECTOR ให้แนบตั๋วไอดีรหัสตัวเองไปกรองตั้งแต่ในระดับ API หลังบ้านเพื่อความปลอดภัย
        let apiUrl = "/api/samples";
        if (currentUser.role === "COLLECTOR") {
            apiUrl += `?collectedBy=${currentUser.id}`;
        }

        fetch(apiUrl)
            .then((res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    const mapped = data.map((s: ApiSampleResponse) => ({
                        id: s.id,
                        locationId: s.locationId,
                        status: s.status,
                        collectedAt: s.collectionTime,
                        collectedBy: s.collectorId,
                        imageUrl: s.imageUrl,
                        imagePlotUrl: s.imagePlotUrl,
                        isDelete: s.isDelete,
                        updatedBy: s.updatedBy,
                        phosphateVal: s.phosphate,
                        ammoniaVal: s.ammonia,
                        location: s.location
                            ? {
                                  id: s.locationId,
                                  name: s.location.name,
                                  organization: s.location.agency,
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

    // 3. ปรับปรุงระบบการกรองข้อมูลด้วย useMemo
    const filteredSamples = useMemo(() => {
        if (!currentUser) return [];

        // บังคับสิทธิ์ COLLECTOR หรือเมื่อ ADMIN เลือกกดสลับดูเฉพาะ "ข้อมูลของฉัน"
        if (viewMode === "MINE" || currentUser.role === "COLLECTOR") {
            return samples.filter(
                (sample: any) => sample.collectedBy === currentUser.id, //  แก้ไขจุดนี้: เปลี่ยนจาก userId เป็น collectedBy ให้ตรงกับโครงสร้างที่เราแมปไว้
            );
        }

        return samples;
    }, [samples, viewMode, currentUser]);

    if (loading) {
        return (
            <div className="min-h-dvh bg-surface-muted pb-10 w-full p-5 sm:p-8 space-y-6">
                <div className="w-full h-52 rounded-3xl shimmer border border-border" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {[1, 2, 3, 4].map((n) => (
                        <div
                            key={n}
                            className="w-full h-24 rounded-2xl bg-surface shimmer border border-border"
                        />
                    ))}
                </div>
                <div className="w-full h-64 rounded-3xl shimmer border border-border" />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-surface-muted pb-16 transition-colors duration-300">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 space-y-6 pt-6 sm:pt-10">
                <div className="relative w-full rounded-xl bg-surface p-6 sm:p-8 border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="space-y-1.5">
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary flex items-center gap-2">
                            ระบบวิเคราะห์และติดตาม{" "}
                            <span className="text-primary font-black">
                                คุณภาพน้ำทะเล
                            </span>
                        </h1>
                        <p className="text-text-secondary text-xs sm:text-sm">
                            ศูนย์ข้อมูลคุณภาพสารเคมีแบบเรียลไทม์
                            และสถิติความแปรปรวนเชิงลึกเพื่อการเฝ้าระวังทางสิ่งแวดล้อม{" "}
                        </p>
                    </div>
                    <ExportButtons />
                </div>

                {/* ส่วนปุ่มสลับมุมมองสำหรับ ADMIN เท่านั้น */}
                {currentUser?.role === "ADMIN" && (
                    <div className="px-5 sm:px-8 mb-2 flex justify-end">
                        <div className="inline-flex rounded-xl p-1 bg-surface border border-border shadow-sm">
                            <button
                                onClick={() => setViewMode("ALL")}
                                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                                    viewMode === "ALL"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                ภาพรวมทั้งหมด
                            </button>
                            <button
                                onClick={() => setViewMode("MINE")}
                                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                                    viewMode === "MINE"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                ข้อมูลของฉัน
                            </button>
                        </div>
                    </div>
                )}

                {/* ข้อความแสดงสถานะแจ้งเตือนมุมมองผู้ใช้ */}
                {currentUser?.role === "COLLECTOR" && (
                    <div className="px-5 sm:px-8 mb-2 text-xs text-text-secondary text-right">
                        แสดงเฉพาะข้อมูลการจัดเก็บของคุณ
                    </div>
                )}
                {currentUser?.role === "EXECUTIVE" && (
                    <div className="px-5 sm:px-8 mb-2 text-xs text-text-secondary text-right">
                        แสดงภาพรวมข้อมูลทั้งหมดในระบบ
                    </div>
                )}

                <div className="px-5 sm:px-8 mt-4 sm:mt-5">
                    {/* ส่งข้อมูลที่ผ่านการคัดกรองความปลอดภัยอย่างถูกต้องไปให้ชาร์ต */}
                    <AnalyticsCharts samples={filteredSamples} />
                </div>
            </div>
        </div>
    );
}
