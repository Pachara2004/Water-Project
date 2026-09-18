/**
 * @file app/collector/history/[id]/page.tsx
 * @project Water Monitoring Project
 * @module App / Collector / History
 * @description
 * หน้ารายละเอียดตัวอย่างน้ำหนึ่งชุด (/collector/history/[id] โดย id = sessionGroup) โหลดจาก /api/samples/[id]
 * และรายชื่อสถานีสำหรับแก้ไข สร้าง mockSubmitHook ให้ ImageZone/ResultsPanel ของหน้า submit นำมาแสดงซ้ำ
 * แบบอ่านอย่างเดียว ซ่อนค่าจากภาพที่ AI ไม่พบหลอดทดลองเฉพาะช่วงที่ยังรอตรวจสอบ กันสิทธิ์ officer ตอน render
 *
 * Sample-session detail page: fetches the session, adapts it into the submit-page components
 * (read-only), supports editing collection time / station / oxygen, and guards officer access.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-06-18
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-24 – 2026-08-24)
 *
 * @lastModified 2026-09-02 14:13
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-06-18 14:22 by Nopparut U. - สร้างหน้าประวัติรายรายการ
 * - 2026-06-19 15:13 by Nopparut U. - เพิ่มแก้ไขประวัติพร้อม validate
 * - 2026-07-06 10:53 by Pachara P. - แสดงสารแบบ dynamic
 * - 2026-07-16 13:13 by Nopparut U. - รองรับ workflow สารซ้ำ
 * - 2026-07-20 15:07 by Pachara P. - ใช้ sessionGroup แทน code
 * - 2026-07-23 09:35 by Pachara P. - แยก view เป็น desktop/mobile
 * - 2026-07-27 16:01 by Nopparut U. - กัน officer เข้าหน้านี้
 * - 2026-09-02 14:13 by Nopparut U. - ซ่อนค่าจากภาพที่ AI ไม่พบหลอดทดลองระหว่างรอตรวจสอบ
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @auth collector และ admin เท่านั้น ยิง API ด้วย LIFF access token
 * @notes marker [NO_TEST_TUBE] ไม่ถูกลบหลังอนุมัติ จึงต้องดู reviewStatus ควบคู่ ไม่ใช่ marker อย่างเดียว
 * @license Private / Proprietary
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { evaluateAgainstLocationType, snapshotToLocationTypes, type StandardSnapshotRow } from "@/lib/standards";
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

/** ชุดตัวอย่างตามที่ /api/samples/[id] ส่งกลับ ฟิลด์ค่าสารเป็น dynamic key */
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
    // เกณฑ์เวอร์ชันที่ใช้ตัดสินตัวอย่างนี้ null = ใช้เกณฑ์ปัจจุบัน
    standardVersion?: { id: number; version: number; createdAt: string; snapshot: StandardSnapshotRow[] } | null;
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

/** วันเวลาแบบไทย สำหรับแสดงในหน้ารายละเอียด */
function formatDateTime(value: string) {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** โหลดชุดตัวอย่าง จัดการโหมดแก้ไข แล้วเลือก view ตามจอ */
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
    // เทียบด้วยเกณฑ์ชุดที่ตัดสินตัวอย่างนี้จริง ไม่ใช่เกณฑ์ปัจจุบันที่อาจถูกแก้ไปแล้ว
    const comparisonTypes = sample.standardVersion ? snapshotToLocationTypes(sample.standardVersion.snapshot) : locationTypes;
    const standardVersionLabel = sample.standardVersion
        ? `ประเมินด้วยเกณฑ์เวอร์ชัน ${sample.standardVersion.version} (${formatDateTime(sample.standardVersion.createdAt)})`
        : null;
    const locationComparisonRows: ComparisonRow[] =
        comparisonTypes.length > 0 && latestByParameter.length > 0
            ? comparisonTypes.map((type) => ({
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
        standardVersionLabel,
        // ส่งให้ ResultsPanel เทียบด้วยเวอร์ชันเดียวกับการ์ดผลประเมินสถานที่ ไม่ใช่เกณฑ์ปัจจุบัน
        comparisonTypes: sample.standardVersion ? comparisonTypes : undefined,
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
