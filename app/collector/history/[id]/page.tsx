"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { evaluateAgainstLocationType } from "@/lib/standards";
import { useLocationTypes } from "@/lib/hooks/useLocationTypes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ComparisonRow } from "@/components/StandardsComparison";

import CollectorHistoryDetailMobile from "./historyMobile";
import CollectorHistoryDetailDesktop from "./historyDesktop";

type WaterStatus = "safe" | "warning" | "danger";
interface LocationOption {
    id: number;
    name: string;
    agency: string;
}

interface SampleDetail {
    id: number;
    code?: string | null;
    collectorId: number;
    locationId: number;
    collectionTime: string;
    uploadedActiveAt: string;
    [key: string]: any;
    dissolvedOxygen: number | null;
    airTemperature: number | null;
    rainAccumulation: number | null;
    weatherCondCode: number | null;
    status: WaterStatus;
    rawImageUrl: string | null;
    analyzedPlotUrl: string | null;
    sampleImagesMap?: Record<number, { raw: string | null; plot: string | null }>;
    locationStatus?: WaterStatus | null;
    latestByParameter?: { parameterId: number; parameterName: string; value: number; collectedAt: string }[];
    location: {
        id: number;
        stationName: string;
        governingAgency: string;
        latitude: number;
        longitude: number;
    };
    collector: {
        id: number;
        lineProfileName: string;
        firstName?: string | null;
        lastName?: string | null;
    };
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function CollectorHistoryDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { currentUser } = useAppStore();
    const [sample, setSample] = useState<SampleDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { locationTypes } = useLocationTypes();

    const isMobile = useMediaQuery("(max-width: 767px)");

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({ collectionTime: "", locationId: "", oxygen: "" });
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [locationSearch, setLocationSearch] = useState("");
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const locationDropdownRef = useRef<HTMLDivElement>(null);

    const systemParameters = useMemo(() => {
        if (!sample || !Array.isArray(sample.measurements)) return [];

        const seen = new Map<number, { id: number; name: string; unit: string }>();
        sample.measurements.forEach((m: any) => {
            const id = m.parameter?.id || m.parameterId;
            if (!seen.has(id)) {
                seen.set(id, { id, name: m.parameter?.name || "unknown", unit: m.parameter?.unit || "mg/L" });
            }
        });
        return Array.from(seen.values());
    }, [sample]);

    const mockSubmitHook = useMemo(() => {
        if (!sample || systemParameters.length === 0 || !Array.isArray(sample.measurements)) return null;

        const resultsMap: Record<number, any> = {};
        const imagePreviewsMap: Record<number, string> = {};
        const imagePlotFilesMap: Record<number, any> = {};

        const countByParam = new Map<number, number>();
        sample.measurements.forEach((m: any) => {
            const pid = m.parameter?.id || m.parameterId;
            countByParam.set(pid, (countByParam.get(pid) || 0) + 1);
        });

        sample.measurements.forEach((m: any) => {
            const paramId = m.parameter?.id || m.parameterId;
            const key = m.sampleId ?? paramId;

            resultsMap[key] = {
                concentrated: m.value,
                confidence: m.confidence,
                status: sample.status,
                parameterId: paramId,
                // ซ่อนค่าจากภาพที่ AI ไม่พบหลอดทดลอง เฉพาะช่วงที่ยังรอผู้ดูแลระบบตรวจสอบเท่านั้น
                // marker [NO_TEST_TUBE] ไม่เคยถูกลบออกจาก message หลังอนุมัติ ถ้าดูแค่ marker ค่าจะถูกซ่อนค้างตลอดไป
                isTestTube: !(sample.reviewStatus === "PENDING" && typeof m.message === "string" && m.message.includes("[NO_TEST_TUBE]")),
                isDuplicateSubstance: (countByParam.get(paramId) || 0) > 1,
                originalValue: m.originalValue,
            };

            const specificImages = m.sampleId !== undefined ? sample.sampleImagesMap?.[m.sampleId] : undefined;

            imagePreviewsMap[key] = specificImages?.raw || sample.rawImageUrl || "";
            imagePlotFilesMap[key] = specificImages?.plot || sample.analyzedPlotUrl || "";
        });

        return {
            systemParameters,
            results: resultsMap,
            imagePreviews: imagePreviewsMap,
            imagePlotFiles: imagePlotFilesMap,
            overallStatus: sample.status,
            step: "results" as const,
            saved: true,
            setImageFiles: () => {},
            setImagePreviews: () => {},
            setIsRecommending: () => {},
            setNearestLocations: () => {},
            setStep: () => {},
            allLocations: [],
        };
    }, [sample, systemParameters]);

    useEffect(() => {
        if (!currentUser) return;
        // officer (ผู้บริหาร) ไม่มีสิทธิ์หน้านี้ — ดูภาพรวมได้ที่ /dashboard เท่านั้น
        if (currentUser.role !== "collector" && currentUser.role !== "admin") router.push("/map");
    }, [currentUser, router]);

    useEffect(() => {
        let cancelled = false;
        async function fetchSample() {
            if (!currentUser || (currentUser.role !== "collector" && currentUser.role !== "admin") || !params.id) return;
            try {
                setError(null);
                const response = await fetch(`/api/samples/${params.id}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "ไม่สามารถดึงข้อมูลประวัติได้");
                if (!cancelled) setSample(data);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
                    setSample(null);
                }
            }
        }
        fetchSample();
        return () => {
            cancelled = true;
        };
    }, [currentUser, params.id]);

    useEffect(() => {
        if (!isEditing || locations.length > 0) return;
        fetch("/api/locations", {
            method: "GET",
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setLocations(data.map((l: any) => ({ id: l.id, name: l.name, agency: l.organization })));
            })
            .catch(console.error);
    }, [isEditing, locations.length]);

    const filteredLocations = locations.filter((l) => l.name?.toLowerCase().includes(locationSearch.toLowerCase()) || l.agency?.toLowerCase().includes(locationSearch.toLowerCase()));
    const isLocationValid = locations.some((l) => String(l.id) === editData.locationId && l.name === locationSearch) || (locations.length === 0 && editData.locationId !== "");

    if (error) return <div className="min-h-screen text-center p-8 text-xs text-text-danger">เกิดข้อผิดพลาด: {error}</div>;
    if (!sample) return null;
    if (!mockSubmitHook) return <div className="min-h-screen text-center p-8 text-xs text-text-muted">ไม่มีข้อมูลพารามิเตอร์เคมีในระบบ</div>;

    const resultEntries = Object.entries(mockSubmitHook.results)
        .map(([keyStr, measurement]) => {
            const key = Number(keyStr);
            const param = systemParameters.find((p) => p.id === measurement.parameterId);
            return param ? { key, param, measurement } : null;
        })
        .filter((e): e is { key: number; param: (typeof systemParameters)[number]; measurement: any } => e !== null);

    const collectorFullName = `${sample.collector.firstName || ""} ${sample.collector.lastName || ""}`.trim() || sample.collector.lineProfileName;

    const latestByParameter = sample.latestByParameter ?? [];
    const locationComparisonRows: ComparisonRow[] =
        locationTypes.length > 0 && latestByParameter.length > 0
            ? locationTypes.map((type) => ({
                  key: type.code,
                  label: type.labelTh,
                  status: evaluateAgainstLocationType(
                      latestByParameter.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                      type,
                  ),
              }))
            : [];

    const detailProps = {
        sample,
        mockSubmitHook,
        resultEntries,
        collectorFullName,
        locationComparisonRows,
        isEditing,
        locationDropdownRef,
        locationSearch,
        setLocationSearch,
        setLocationDropdownOpen,
        locationDropdownOpen,
        filteredLocations,
        isLocationValid,
        setEditData,
        editData,
        formatDateTime,
        router,
    };

    return isMobile ? <CollectorHistoryDetailMobile {...detailProps} /> : <CollectorHistoryDetailDesktop {...detailProps} />;
}
