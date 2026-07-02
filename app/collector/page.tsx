"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { useRouter } from "next/navigation";
import { Camera, FileText, FlaskConical, MapPin, Calendar, Beaker, ImageOff} from "lucide-react"; /* prettier-ignore */

import StatusBadge from "@/components/map/StatusBadge";

interface CollectorSample {
    id: number;
    locationId: number;
    status: "safe" | "warning" | "danger";
    collectedAt: string | Date;
    collectedBy: number;
    imageUrl?: string | null;
    imagePlotUrl?: string | null;
    phosphateVal?: number | null;
    ammoniaVal?: number | null;
    isDeleted: boolean;
    updatedBy?: number | null;
    location?: {
        id: number;
        name: string;
        organization: string;
    } | null;
}

export default function CollectorDashboard() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [samples, setSamples] = useState<CollectorSample[]>([]);
    const [loading, setLoading] = useState(true);
    const [showOnlyMine, setShowOnlyMine] = useState(true);

    // สเตตัสสำหรับเก็บไอดีของการ์ดที่รูปภาพโหลดพัง (Image Fallback State)
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") {
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
                        phosphateVal: s.phosphateValue,
                        ammoniaVal: s.ammoniaValue,
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

    const handleImageError = (sampleId: number) => {
        setImageErrors((prev) => ({ ...prev, [sampleId]: true }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-muted p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
                <div className="w-full h-48 rounded-2xl shimmer border border-border/60" />
                <div className="w-48 h-5 bg-surface-subtle shimmer rounded-md mt-10" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="w-full h-28 rounded-2xl bg-surface border border-border/60 flex p-5 gap-4">
                            <div className="w-16 h-16 rounded-xl bg-surface-subtle shimmer flex-shrink-0" />
                            <div className="flex-1 space-y-3 mt-1">
                                <div className="w-1/2 h-3 bg-surface-subtle rounded" />
                                <div className="w-full h-4 bg-surface-subtle rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-surface-muted pb-16 transition-colors duration-300">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 space-y-6 pt-6 sm:pt-10">
                <div className="relative w-full rounded-xl bg-surface p-6 sm:p-8 border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary flex items-center">
                            ศูนย์ข้อมูล<span className="text-primary font-bold">ผู้เก็บตัวอย่างน้ำ</span>
                        </h1>
                        <p className="text-black text-xs sm:text-sm">ระบบรายงานและสืบค้นผลวิเคราะห์สารเคมีในน้ำทะเลชายฝั่ง</p>
                    </div>

                    <button
                        onClick={() => router.push("/submit")}
                        className="w-full sm:w-auto py-3 px-6 min-h-[48px] bg-primary hover:bg-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer text-sm shrink-0"
                    >
                        <Camera size={16} strokeWidth={2.5} />
                        <span>ส่งตรวจคุณภาพน้ำ</span>
                    </button>
                </div>

                {/* Filtering Title Bar */}
                <div className="flex flex-col-2 sm:flex-row sm:items-center justify-between sm:justify-between gap-3 pt-4 px-1">
                    <div className="inline-flex items-center gap-2">
                        <FileText size={15} className="text-primary" />
                        <h2 className="text-xs sm:text-xs uppercase text-text-secondary font-semibold">ประวัติการส่งตรวจคุณภาพน้ำ</h2>
                    </div>

                    <div className="inline-flex items-center gap-1 bg-surface border border-border/50 px-3 py-1.5 rounded-md shadow-xs shrink-0 w-max">
                        <span className="text-xs font-semibold text-black">ข้อมูลของฉัน</span>
                        <button
                            title="button"
                            type="button"
                            onClick={() => setShowOnlyMine(!showOnlyMine)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out outline-none ${
                                showOnlyMine ? "bg-primary" : "bg-border"
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-0.5 ${
                                    showOnlyMine ? "translate-x-4.5" : "translate-x-0.5"
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Content Core Render */}
                {(() => {
                    const displayedSamples = (showOnlyMine ? samples.filter((s) => s.collectedBy === currentUser?.id) : samples).filter((s) => !s.isDeleted); // 👈 เปลี่ยนเป็นตัวแปรใหม่

                    if (displayedSamples.length === 0) {
                        return (
                            <div className="text-center p-12 bg-surface rounded-2xl border border-border/60 flex flex-col items-center">
                                <div className="w-12 h-12 bg-surface-subtle rounded-xl flex items-center justify-center mb-4 border border-border/60 text-text-muted">
                                    <FileText size={20} />
                                </div>
                                <p className="text-text-primary font-bold mb-1.5 text-sm sm:text-base">{showOnlyMine ? "คุณยังไม่มีประวัติการส่งข้อมูล" : "ยังไม่มีประวัติการส่งข้อมูลในระบบ"}</p>
                                <p className="text-xs text-text-secondary mb-6 max-w-sm leading-relaxed">เริ่มต้นส่งภาพชุดทดสอบคุณภาพน้ำเพื่อบันทึกและประมวลผลค่าน้ำในพื้นที่ของท่าน</p>
                                <button
                                    onClick={() => router.push("/submit")}
                                    className="px-5 py-2.5 min-h-[42px] bg-primary text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2"
                                >
                                    <Camera size={14} />
                                    <span>ส่งผลตรวจครั้งแรก</span>
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {displayedSamples.map((sample) => {
                                const hasImageError = imageErrors[sample.id];

                                return (
                                    <div
                                        key={sample.id}
                                        onClick={() => router.push(`/collector/history/${sample.id}`)}
                                        className="bg-surface rounded-2xl p-4 border border-border/50 shadow-xs hover:shadow-md flex flex-col justify-between transition-all duration-200 cursor-pointer group hover:border-border-strong relative"
                                    >
                                        {/* Top Row: Meta and Badges */}
                                        <div className="flex gap-4 items-start w-full">
                                            {/* Thumbnail Section */}
                                            {sample.imageUrl && !hasImageError ? (
                                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-subtle border border-border/60 flex-shrink-0 relative bg-neutral-100">
                                                    <img
                                                        src={sample.imageUrl}
                                                        alt="sample data"
                                                        onError={() => handleImageError(sample.id)}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                                                    />
                                                </div>
                                            ) : sample.imageUrl && hasImageError ? (
                                                <div
                                                    className="w-16 h-16 border border-border/60 rounded-xl flex flex-col items-center justify-center gap-0.5 animate-fade-in text-text-muted"
                                                    title="ไม่สามารถโหลดรูปภาพได้"
                                                >
                                                    <ImageOff size={16} strokeWidth={2.5} />
                                                    <span className="text-[8px] font-black uppercase tracking-wider opacity-80">Error</span>
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 bg-surface-subtle rounded-xl flex items-center justify-center border border-border/60 flex-shrink-0 text-primary">
                                                    <FlaskConical size={18} strokeWidth={2.5} />
                                                </div>
                                            )}

                                            {/* Content Data Stack */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-text-primary truncate">
                                                    <MapPin size={13} className="text-primary shrink-0" />
                                                    <span className="truncate">{sample.location?.name || "ไม่ทราบสถานที่"}</span>
                                                </div>

                                                <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold">
                                                    <Calendar size={11} className="shrink-0" />
                                                    <span>
                                                        {new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Metric Divider */}
                                        <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3 text-[11px] font-bold text-text-secondary">
                                                <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md">
                                                    <Beaker size={11} className="text-blue-500" />
                                                    <span>P: {sample.phosphateVal !== null && sample.phosphateVal !== undefined ? `${sample.phosphateVal} mg/L` : "-"}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md">
                                                    <Beaker size={11} className="text-amber-500" />
                                                    <span>N: {sample.ammoniaVal !== null && sample.ammoniaVal !== undefined ? `${sample.ammoniaVal} mg/L` : "-"}</span>
                                                </div>
                                            </div>

                                            <StatusBadge status={sample.status} size="sm" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
