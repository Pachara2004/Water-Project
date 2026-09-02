import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { alertError } from "@/lib/swal";
import { formatMeasuredValue } from "@/lib/chemLabels";
import { DbParameter, LocationItem, MeasurementResult, VerifyError } from "@/components/submit/types";

// ผลวิเคราะห์ดิบต่อภาพหนึ่งใบ ก่อนกระทบยอด (reconcile) กับสารอื่น ๆ ในชุดเดียวกัน
// ใช้ระหว่างขั้นตอน handleAnalyze → finalizeAnalysis เท่านั้น ไม่ได้ persist เป็น state ถาวร
interface AnalyzedItem {
    originalParamId: number; // ช่อง (toggle) ที่ผู้ใช้ถ่ายภาพนี้ใส่ไว้ตอนแรก
    originalParamName: string;
    targetParam: DbParameter; // สารจริงที่ AI ตรวจยืนยัน (จับคู่กับ systemParameters แล้ว)
    file: File;
    plottedFile: File | null;
    aiData: any; // response ดิบจาก /api/analyze
    isMismatch: boolean; // targetParam ตรงกับช่องเดิมหรือไม่
    isSystemUnknown: boolean; // AI ทำนายสารที่ระบบไม่รู้จัก (ไม่มีใน DB)
    notTestTube: boolean; // AI ไม่พบหลอดทดลองในภาพ — ค่าที่อ่านได้เชื่อไม่ได้ ต้องให้ผู้ดูแลระบบตัดสิน
}

const getNowLocalDateTimeString = () => {
    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function useSubmitSample() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();

    // ── States ──
    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    const [isLoadingParams, setIsLoadingParams] = useState(true);
    // เซ็ตของสารที่เปิด toggle ไว้ (แทนแนวคิด "โหมดเดี่ยว/คู่" เดิม — รองรับ N สารโดยไม่ผูกกับจำนวน)
    // ค่าเริ่มต้นว่าง (ปิดหมด) ตามที่ต้องการเมื่อเข้าจากหน้า /collector
    const [enabledParamIds, setEnabledParamIds] = useState<Set<number>>(new Set());
    // เหตุผลที่ผลวิเคราะห์ของแต่ละสารถูกบล็อก (ไม่ใช่หลอดทดลอง / สารผิดชนิดที่ระบบไม่รู้จัก)
    const [verifyErrors, setVerifyErrors] = useState<Record<number, VerifyError>>({});
    // ผลวิเคราะห์ทั้งชุดที่พักไว้เมื่อมีภาพที่ AI ไม่พบหลอดทดลอง — ยังไม่ commit เข้าหน้าผลลัพธ์
    // ผู้ใช้เลือกได้ระหว่างถ่ายภาพใหม่ (ล้างทิ้ง) หรือกดยืนยันส่งให้ผู้ดูแลระบบตรวจสอบ (confirmSubmitBlocked)
    const [pendingAnalyzedItems, setPendingAnalyzedItems] = useState<AnalyzedItem[]>([]);
    const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
    const [imagePlotFiles, setImagePlotFiles] = useState<Record<number, File>>({});
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(searchParams.get("locationId"));
    const [locationName, setLocationName] = useState("");
    const [locationType, setLocationType] = useState("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
    const [results, setResults] = useState<Record<number, MeasurementResult>>({});
    // กรณีสารซ้ำ (≥2 ภาพชี้ parameterId เดียวกัน): ผู้ส่งเลือกเก็บได้ภาพเดียวต่อสาร
    // map parameterId → key (virtual key) ของ entry ที่เลือกไว้ | ค่าเริ่มต้นตั้งเป็นภาพ confidence สูงสุดใน finalizeAnalysis
    const [duplicateChoice, setDuplicateChoice] = useState<Record<number, number>>({});
    const [overallStatus, setOverallStatus] = useState<"safe" | "warning" | "danger">("safe");
    const [saved, setSaved] = useState(false);
    // id ของ sample ตัวแรกที่บันทึกสำเร็จในรอบนี้ — ใช้พาไปหน้ารายละเอียดของชุดนี้โดยตรงหลังบันทึกเสร็จ
    const [savedSampleId, setSavedSampleId] = useState<number | null>(null);
    // ผู้ใช้กดปุ่ม "ส่งให้ผู้เชี่ยวชาญตรวจสอบ" เอง (conf สูงพอที่จะ auto-approve ได้ แต่เลือกส่งเข้าคิว pending แทน)
    const [submittedForReview, setSubmittedForReview] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [nearestLocations, setNearestLocations] = useState<LocationItem[]>([]);
    const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [oxygen, setOxygen] = useState("");
    const [collectionTime, setCollectionTime] = useState<string>(() => getNowLocalDateTimeString());

    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    // sessionGroup ต้อง unique จริง เพราะ ReviewRequest ผูกกับมันโดยตรง (sessionGroup @unique)
    // ใช้ crypto.randomUUID() เป็นส่วนรับประกันความไม่ซ้ำ แทนเลขสุ่ม 3 หลักเดิมที่ชนกันได้ง่าย
    const generateSessionId = () => {
        const now = new Date();
        const yymm = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const uniquePart = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${yymm}-${uniquePart}`;
    };
    const [sessionId, setSessionId] = useState<string>(generateSessionId);

    // เพิ่ม State และ Ref สำหรับเก็บค่าพิกัดดิบทั้งสองฝั่ง
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [exifCoords, setExifCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [activeSource, setActiveSource] = useState<"gps" | "exif" | "manual">("manual");

    // ฟังก์ชันสำหรับคำนวณเรียงลำดับสถานีใกล้เคียงใหม่ตามพิกัดที่เลือก
    const updateNearestByCoords = useCallback(
        (coords: { lat: number; lng: number }) => {
            if (!allLocations.length) return;
            import("@/lib/exif").then(({ calculateDistance }) => {
                const sorted = [...allLocations].sort((a, b) => calculateDistance(coords.lat, coords.lng, a.lat, a.lng) - calculateDistance(coords.lat, coords.lng, b.lat, b.lng));
                setNearestLocations(sorted.slice(0, 5));
            });
        },
        [allLocations],
    );

    // เมื่อคลิกเลือกแหล่งพิกัด (GPS หรือ EXIF)
    const handleSelectSource = (source: "gps" | "exif") => {
        setActiveSource(source);
        if (source === "gps" && gpsCoords) {
            updateNearestByCoords(gpsCoords);
        } else if (source === "exif" && exifCoords) {
            updateNearestByCoords(exifCoords);
        }
    };
    // ── Effects ──
    useEffect(() => {
        setIsLoadingParams(true);
        fetch("/api/parameters")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (Array.isArray(data)) {
                    setSystemParameters(data);
                    // ค่าเริ่มต้น: เปิดกล่องอัปโหลดของทุกสารให้หมด ผู้ใช้ไม่ต้องมากดเปิดเองทีละตัว
                    setEnabledParamIds(new Set(data.map((p: DbParameter) => p.id)));
                }
            })
            .catch((err) => console.error("Fetch Parameters Error:", err))
            .finally(() => setIsLoadingParams(false));
    }, []);

    // สารที่เปิด toggle ไว้จริง — ตัดสินใจจาก enabledParamIds ล้วน ๆ ไม่ผูกกับจำนวน (รองรับ N สาร)
    const activeParameters = systemParameters.filter((p) => enabledParamIds.has(p.id));

    // ผู้ส่งเลือกภาพหลักของกลุ่มสารซ้ำ (parameterId → key ที่เลือก)
    const chooseDuplicate = (parameterId: number, key: number) => {
        setDuplicateChoice((prev) => ({ ...prev, [parameterId]: key }));
    };

    // key ของทุก entry ที่จะถูกบันทึกจริง = entry ที่ไม่ซ้ำ + entry ของสารซ้ำที่ถูกเลือกไว้เท่านั้น
    // ใช้ทั้งตอน handleSave (กรองส่ง) และให้ UI ตัดสิน review ตามเฉพาะภาพที่จะบันทึก
    const savedEntryKeys = new Set<number>(
        Object.entries(results)
            .filter(([keyStr, r]) => !r.isDuplicateSubstance || duplicateChoice[r.parameterId] === Number(keyStr))
            .map(([keyStr]) => Number(keyStr)),
    );

    const toggleParam = (paramId: number) => {
        setEnabledParamIds((prev) => {
            const next = new Set(prev);
            if (next.has(paramId)) next.delete(paramId);
            else next.add(paramId);
            return next;
        });
        // เปิด/ปิดสารใหม่ = เคลียร์สถานะบล็อกของช่องนั้นทิ้ง (ถ้ามีค้างจากรอบก่อน)
        setVerifyErrors((prev) => {
            if (!prev[paramId]) return prev;
            const next = { ...prev };
            delete next[paramId];
            return next;
        });
    };

    useEffect(() => {
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d)) setAllLocations(d);
            })
            .catch(console.error);
    }, []);

    // ─── 1. ดึง GPS มือถือปัจจุบัน และตั้งค่า activeSource อัตโนมัติ ───
    useEffect(() => {
        if (typeof window === "undefined" || !navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setGpsCoords(coords);

                // ถ้ามี locationId ส่งมาจาก URL (BottomSheet) ให้คงสถานะ manual ไว้ ไม่สลับไป gps
                const hasPreselected = !!searchParams.get("locationId");

                setActiveSource((prev) => {
                    if (prev === "manual" && !hasPreselected) {
                        return "gps";
                    }
                    return prev;
                });
            },
            (err) => {
                console.warn("ไม่สามารถดึง GPS ปัจจุบันได้:", err.message);
                setGpsCoords(null);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }, [searchParams]);

    const [weatherData, setWeatherData] = useState<{
        airTemperature: number | null;
        rainAccumulation: number | null;
        weatherCondCode: number | null;
    } | null>(null);

    // 🟢 Effect ดึงสภาพอากาศอิงตามสถานที่และเวลาที่เลือก
    useEffect(() => {
        if (!currentLocationId || !collectionTime) {
            setWeatherData(null);
            return;
        }

        const controller = new AbortController();

        fetch(`/api/weather/preview?locationId=${currentLocationId}&collectionTime=${encodeURIComponent(collectionTime)}`, {
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) {
                    setWeatherData(data);
                }
            })
            .catch((err) => {
                if (err.name !== "AbortError") {
                    console.error("Fetch weather preview error:", err);
                }
            });

        return () => controller.abort();
    }, [currentLocationId, collectionTime]);

    useEffect(() => {
        if (!currentLocationId || !allLocations.length) return;
        const loc = allLocations.find((l) => l.id.toString() === currentLocationId);
        if (loc) {
            setLocationName(loc.name);
            setLocationType(loc.type);
        }
    }, [currentLocationId, allLocations]);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") router.push("/map");
    }, [currentUser, router]);

    // 1. แกะ EXIF และสลับมาใช้พิกัดรูปภาพทันที
    const processImageExif = useCallback(
        async (file: File) => {
            try {
                const { getExifLocation } = await import("@/lib/exif");
                const coords = await getExifLocation(file);

                if (coords) {
                    const exif = { lat: coords.latitude, lng: coords.longitude };
                    setExifCoords(exif);
                    setActiveSource("exif");
                    updateNearestByCoords(exif);
                } else {
                    console.warn("รูปภาพนี้ไม่มีข้อมูลพิกัด EXIF GPS");
                    setExifCoords(null);
                }
            } catch (err) {
                console.error("ไม่สามารถอ่านค่า EXIF จากรูปภาพได้:", err);
                setExifCoords(null);
            }
        },
        [updateNearestByCoords],
    );
    // 2. ฟังก์ชันสลับปุ่ม (ใช้ Functional Update อ่านค่า State ล่าสุดเสมอ ป้องกัน Stale Closure)
    const onSelectSource = useCallback(
        (source: "gps" | "exif") => {
            setActiveSource(source);

            setGpsCoords((latestGps) => {
                setExifCoords((latestExif) => {
                    if (source === "gps" && latestGps) {
                        updateNearestByCoords(latestGps);
                    } else if (source === "exif" && latestExif) {
                        updateNearestByCoords(latestExif);
                    }
                    return latestExif;
                });
                return latestGps;
            });
        },
        [updateNearestByCoords],
    );

    // ── AI Image Plotter Canvas Helper ──
    const generateAiImagePlot = (file: File, aiData: any): Promise<File | null> =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = hiddenCanvasRef.current;
                if (!canvas) return resolve(null);
                const ctx = canvas.getContext("2d");
                if (!ctx) return resolve(null);

                //    จำกัดด้านที่ยาวสุดของ canvas: รูปจากมือถือความละเอียดสูง (เช่น 4000px+) ทำให้ canvas.toBlob()
                const MAX_DIM = 2000;
                const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const box = aiData["bounding box"];
                if (box?.length === 4) {
                    // พิกัด bounding box อยู่ในสเปซของรูปต้นฉบับ ต้องคูณ scale ให้ตรงกับ canvas ที่ย่อแล้ว
                    const [x_min, y_min, x_max, y_max] = box.map((v: number) => v * scale);
                    ctx.strokeStyle = "#28a745";
                    ctx.lineWidth = Math.max(4, canvas.width * 0.005);
                    ctx.strokeRect(x_min, y_min, x_max - x_min, y_max - y_min);

                    const confPct = aiData.confidence;
                    const labelSource = aiData.verifiedParameterName || aiData.parameterName;
                    const paramLabel = labelSource ? labelSource.charAt(0).toUpperCase() + labelSource.slice(1).toLowerCase() : "Vial";
                    const label = `${paramLabel} | ${formatMeasuredValue(aiData.concentrated)} mg/L ค่าความมั่นใจ ${confPct}`;
                    const fs = Math.max(16, Math.floor(canvas.width * 0.018));
                    ctx.font = `bold ${fs}px Arial`;
                    const tw = ctx.measureText(label).width,
                        lh = fs * 1.4;
                    ctx.fillStyle = "#28a745";
                    ctx.fillRect(x_min - 2, y_min - lh, tw + 20, lh);
                    ctx.fillStyle = "white";
                    ctx.fillText(label, x_min + 10, y_min - lh * 0.3);
                }
                // ส่งออกเป็น JPEG (เบากว่า PNG และตรงกับนามสกุล .jpg) ลดโอกาส toBlob ล้มบนมือถือลงอีก
                const outName = `plotted-${file.name.replace(/\.[^.]+$/, "")}.jpg`;
                canvas.toBlob((blob) => resolve(blob ? new File([blob], outName, { type: "image/jpeg" }) : null), "image/jpeg", 0.9);
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });

    // จัดกลุ่ม AnalyzedItem ตามสารจริง (targetParam.id) ที่ AI เจอ — ใช้ตรวจว่ามีสารซ้ำ (≥2 ภาพชนกัน) ไหม
    const groupByTargetParam = (items: AnalyzedItem[]): Map<number, AnalyzedItem[]> => {
        const groups = new Map<number, AnalyzedItem[]>();
        items.forEach((item) => {
            const arr = groups.get(item.targetParam.id) ?? [];
            arr.push(item);
            groups.set(item.targetParam.id, arr);
        });
        return groups;
    };

    // เก็บผลวิเคราะห์เป็นผลลัพธ์สุดท้าย: rebuild state ทั้งหมดตาม "สารจริง" (targetParam.id) ของทุกภาพที่วิเคราะห์ผ่าน
    // สลับสารให้เสมอโดยไม่ถาม (ผู้ใช้เห็นแบนเนอร์ "เปลี่ยนชนิดสารให้อัตโนมัติ" ที่หน้าผลลัพธ์แทน)
    // กรณีสารซ้ำ (≥2 ภาพชี้สารเดียวกัน): ไม่บังคับให้เลือก — เก็บทั้งสองภาพแยกเป็นคนละรายการ (คนละ virtual key กันชนกัน)
    // แล้วติดธง isDuplicateSubstance ไว้ให้ handleSave บังคับส่งเข้าคิว pending เสมอไม่ว่า confidence จะสูงแค่ไหน
    const finalizeAnalysis = (items: AnalyzedItem[]) => {
        const groups = groupByTargetParam(items);

        const newImageFiles: Record<number, File> = {};
        const newImagePreviews: Record<number, string> = {};
        const newImagePlotFiles: Record<number, File> = {};
        const newResults: Record<number, MeasurementResult> = {};
        const finalParamIds = new Set<number>();
        // ตัวเลือกเริ่มต้นของกลุ่มสารซ้ำ: parameterId → key ของภาพ confidence สูงสุด (ผู้ส่งเปลี่ยนได้ทีหลัง)
        const newDuplicateChoice: Record<number, number> = {};
        let hasDanger = false;
        let hasWarning = false;

        groups.forEach((arr, paramId) => {
            finalParamIds.add(paramId);
            const isDuplicateSubstance = arr.length > 1;
            let bestKey: number | null = null;
            let bestConfidence = -Infinity;

            arr.forEach((it) => {
                // ไม่ชนกัน: ใช้ paramId จริงเป็น key ตามเดิม | ชนกัน: ต้องใช้ virtual key แยกกัน ไม่งั้นทับกันเหลือรายการเดียว
                const key = isDuplicateSubstance ? paramId * 1_000_000 + it.originalParamId : paramId;

                if (isDuplicateSubstance) {
                    const conf = typeof it.aiData.confidence === "number" ? it.aiData.confidence : -Infinity;
                    if (conf > bestConfidence) {
                        bestConfidence = conf;
                        bestKey = key;
                    }
                }

                newImageFiles[key] = it.file;
                if (imagePreviews[it.originalParamId]) newImagePreviews[key] = imagePreviews[it.originalParamId];
                if (it.plottedFile) newImagePlotFiles[key] = it.plottedFile;

                // null = สารนี้ยังไม่มีเกณฑ์กำหนด ตัดสินไม่ได้ — ต้องส่ง null ต่อ ห้าม ?? "safe"
                // เพราะจะกลายเป็นบอกผู้ใช้ว่า "ปลอดภัย" ทั้งที่ไม่เคยมีเกณฑ์ให้เทียบ
                // ภาพที่ไม่พบหลอดทดลอง: ค่าที่อ่านได้เชื่อไม่ได้ จึงตัดสินสถานะไม่ได้ → null เสมอ
                // ค่า concentrated/confidence ที่โมเดลคืนมาในกรณีนี้เป็น 0 เปล่า ๆ ไม่ใช่ผลวัด
                // จึงคงไว้ใน state แค่ให้ UI มีอะไรอ้างอิง แต่ตอนบันทึกจะถูกแทนด้วย null (ดู handleSave)
                const currentStatus = it.notTestTube
                    ? null
                    : ((it.aiData.status?.toLowerCase() ?? null) as "safe" | "warning" | "danger" | null);
                newResults[key] = {
                    concentrated: it.aiData.concentrated,
                    status: currentStatus,
                    message: it.aiData.message || "",
                    confidence: it.aiData.confidence,
                    boundingBox: it.aiData["bounding box"],
                    isTestTube: !it.notTestTube,
                    // ไม่พบหลอด → ชนิดสารที่ AI ทำนายเชื่อไม่ได้ ใช้ชื่อช่องที่ผู้ใช้เลือกไว้เดิม
                    verifiedParameterName: it.notTestTube ? it.targetParam.name : it.aiData.verifiedParameterName || it.targetParam.name,
                    autoSwitchedFrom: it.isMismatch && !it.isSystemUnknown ? it.originalParamName : undefined,
                    parameterId: paramId,
                    isDuplicateSubstance,
                    isSystemUnknown: it.isSystemUnknown,
                };

                if (currentStatus === "danger") hasDanger = true;
                if (currentStatus === "warning") hasWarning = true;
            });

            if (isDuplicateSubstance && bestKey !== null) newDuplicateChoice[paramId] = bestKey;
        });

        setImageFiles(newImageFiles);
        setImagePreviews(newImagePreviews);
        setImagePlotFiles(newImagePlotFiles);
        setEnabledParamIds(finalParamIds); // toggle สะท้อนองค์ประกอบสุดท้ายจริงหลังกระทบยอด
        setResults(newResults);
        setDuplicateChoice(newDuplicateChoice);
        setOverallStatus(hasDanger ? "danger" : hasWarning ? "warning" : "safe");
        setStep("results");
    };

    // ── Handlers ──
    const handleAnalyze = async () => {
        if (activeParameters.length === 0) return;
        setStep("analyzing");
        setVerifyErrors({}); // ล้างผลบล็อกรอบก่อนหน้าก่อนเริ่มวิเคราะห์ใหม่

        try {
            const newErrors: Record<number, VerifyError> = {};
            const items: AnalyzedItem[] = [];

            for (const param of activeParameters) {
                const file = imageFiles[param.id];
                if (!file) throw new Error(`ไม่พบไฟล์ภาพของสาร ${param.name}`);

                const fd = new FormData();
                fd.append("image", file);
                fd.append("parameterName", param.name.toLowerCase());

                const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                    body: fd,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `วิเคราะห์สาร ${param.name} ไม่สำเร็จ`);
                }

                const data = await res.json();

                // ── ด่านตรวจก่อนรับผล (mirror ลำดับฝั่ง AI: เช็คหลอดทดลองก่อน แล้วค่อยเช็คชนิดสาร) ──
                const isTestTube = data.isTestTube ?? true;
                const verifiedName: string = data.verifiedParameterName || param.name;
                const isMismatch = verifiedName.toLowerCase() !== param.name.toLowerCase();

                if (!isTestTube) {
                    // ด่าน 1: ไม่พบหลอดทดลองในภาพ — ค่าที่ AI อ่านได้เชื่อไม่ได้ แต่ไม่ทิ้งผล
                    // เก็บ item ไว้ให้ผู้ใช้เลือก: ถ่ายภาพใหม่ หรือยืนยันส่งให้ผู้ดูแลระบบตรวจสอบ
                    // คงสารไว้ที่ช่องเดิมเสมอ (ไม่ auto-switch) เพราะเมื่อไม่พบหลอด ชนิดสารที่ AI ทำนายก็เชื่อไม่ได้
                    // ไม่สร้างภาพ plot เพราะ bounding box ไม่มีความหมายเมื่อไม่พบหลอด
                    newErrors[param.id] = {
                        reason: "not_test_tube",
                        detail: "ไม่พบหลอดทดลองในภาพ หรือภาพอาจเบลอเกินไป กรุณาถ่ายรูปที่มีขวดบรรจุสารให้ชัดเจน ไม่เบลอ แล้ววิเคราะห์ใหม่ หรือกดยืนยันส่งให้ผู้ดูแลระบบตรวจสอบ",
                    };
                    items.push({
                        originalParamId: param.id,
                        originalParamName: param.name,
                        targetParam: param,
                        file,
                        plottedFile: null,
                        aiData: data,
                        isMismatch: false,
                        isSystemUnknown: false,
                        notTestTube: true,
                    });
                    continue;
                }

                // ด่าน 2: AI ตรวจพบว่าสารในภาพเป็นคนละชนิดกับช่องเดิม — หาสารจริงจาก systemParameters
                let targetParam = param;
                let isSystemUnknown = false;
                
                if (isMismatch) {
                    const matchedParam = systemParameters.find((p) => p.name.toLowerCase() === verifiedName.toLowerCase());
                    if (!matchedParam) {
                        // AI ตรวจเจอสารที่ระบบไม่รู้จัก (ไม่มีในฐานข้อมูล) — ให้ targetParam เป็นตัวเดิม แต่บันทึก flag ไว้
                        targetParam = param;
                        isSystemUnknown = true;
                    } else {
                        targetParam = matchedParam;
                    }
                }

                const plotted = await generateAiImagePlot(file, data);

                items.push({
                    originalParamId: param.id,
                    originalParamName: param.name,
                    targetParam,
                    file,
                    plottedFile: plotted,
                    aiData: data,
                    isMismatch,
                    isSystemUnknown,
                    notTestTube: false,
                });
            }

            // ถ้ามีสารตัวใดไม่ผ่านด่าน → ยังไม่เข้าหน้าผลลัพธ์ กลับไปหน้ากรอกข้อมูลพร้อมแบนเนอร์เตือน
            // คงรูปทุกใบไว้ตามเดิม ไม่ล้างทิ้ง — ผู้ใช้ถ่ายทับเองได้ หรือกดยืนยันส่งชุดนี้ทั้งอย่างนั้น
            // ผลวิเคราะห์ทั้งชุดถูกพักไว้ใน pendingAnalyzedItems รอ confirmSubmitBlocked มา commit
            if (Object.keys(newErrors).length > 0) {
                setVerifyErrors(newErrors);
                setPendingAnalyzedItems(items);
                setStep("upload");
                return;
            }

            // จัดกลุ่มตามสารจริงแล้ว commit ตรง ๆ — สารซ้ำไม่ต้องให้เลือก เก็บทั้งคู่แยกกัน (ดูรายละเอียดใน finalizeAnalysis)
            finalizeAnalysis(items);
        } catch (err: any) {
            console.error("Analysis failed:", err);
            alertError("วิเคราะห์ภาพล้มเหลว", err.message);
            setStep("upload");
        }
    };


    const handleSave = async (forceReview = false, reviewNote?: string, allowAdminChange = false) => {
        if (Object.keys(results).length === 0 || !currentLocationId || !currentUser) return;

        try {
            let firstSavedId: number | null = null;

            // วนตาม key จริงใน results (virtual key เมื่อสารซ้ำ) แทน activeParameters เพราะสารซ้ำมี 2 รายการต่อ parameterId เดียวกัน
            for (const [keyStr, resData] of Object.entries(results)) {
                const key = Number(keyStr);

                // สารซ้ำ: บันทึกเฉพาะภาพที่ผู้ส่งเลือกไว้เท่านั้น (ตัวที่ไม่เลือกไม่ถูกส่งขึ้น server เลย)
                if (resData.isDuplicateSubstance && duplicateChoice[resData.parameterId] !== key) continue;

                const rawFile = imageFiles[key];
                const plotFile = imagePlotFiles[key];
                const paramMeta = systemParameters.find((p) => p.id === resData.parameterId);

                if (!rawFile || !paramMeta) continue;

                const fd = new FormData();
                fd.append("locationId", currentLocationId);
                // ไม่ส่ง status แล้ว — server คำนวณเองจากค่าที่วัดได้จริง และไม่เคยเชื่อค่าจาก client อยู่แล้ว
                fd.append("collectionTime", `${collectionTime}:00+07:00`);
                if (oxygen) fd.append("oxygen", oxygen);
                if (reviewNote) fd.append("reviewNote", reviewNote);
                
                // บังคับส่งให้แอดมินถ้ามีแรงจูงใจ (เช่น มีสารซ้ำ หรือ ความมั่นใจต่ำ หรือ ผู้ใช้บังคับส่งเอง)
                if (forceReview) fd.append("forceReview", "true");

                let finalMessage = resData.message || null;
                if (allowAdminChange) {
                    finalMessage = finalMessage ? `[USER_REQUEST_CHANGE] ${finalMessage}` : "[USER_REQUEST_CHANGE]";
                }

                // marker บอกทั้ง server และหน้าแสดงผลว่าค่านี้มาจากภาพที่ AI ไม่พบหลอดทดลอง
                // server ใช้บังคับเข้าคิวรอตรวจสอบ โดยไม่ต้องเชื่อ forceReview จาก client เพียงอย่างเดียว
                if (resData.isTestTube === false) {
                    finalMessage = finalMessage ? `[NO_TEST_TUBE] ${finalMessage}` : "[NO_TEST_TUBE]";
                }

                const singleMeasurementPayload = [
                    {
                        parameterId: resData.parameterId,
                        // AI ไม่พบหลอดทดลอง → โมเดลคืนเลข 0 มาให้ แต่ไม่ใช่ผลวัด ส่ง null ไปตรง ๆ
                        // (server บังคับซ้ำอีกชั้นจาก marker ใน message — ฝั่งนี้แค่ให้ payload ตรงกับที่จะถูกเก็บจริง)
                        // ?? ไม่ใช่ || — ค่า 0 ที่วัดได้จริงจากภาพที่มีหลอดทดลองต้องคงไว้
                        value: resData.isTestTube === false ? null : resData.concentrated ?? null,
                        confidence: resData.isTestTube === false ? null : resData.confidence ?? null,
                        boundingBox: resData.boundingBox ? JSON.stringify(resData.boundingBox) : null,
                        message: finalMessage,
                    },
                ];
                fd.append("measurements", JSON.stringify(singleMeasurementPayload));

                fd.append(`image_raw_${resData.parameterId}`, rawFile);
                if (plotFile) fd.append(`image_plot_${resData.parameterId}`, plotFile);

                const res = await fetch("/api/samples", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                    body: fd,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `เกิดข้อผิดพลาดในการบันทึกสาร ${paramMeta.name}`);
                }

                // เก็บ id ของ sample ตัวแรกที่บันทึกสำเร็จในชุดนี้ ไว้พาไปหน้ารายละเอียดโดยตรงหลังบันทึกเสร็จ
                if (firstSavedId === null) {
                    const savedData = await res.json();
                    if (savedData?.id) firstSavedId = savedData.id;
                }
            }

            if (firstSavedId !== null) setSavedSampleId(firstSavedId);
            setSaved(true);
            setSubmittedForReview(forceReview);
        } catch (err: any) {
            console.error("Save failed:", err);
            // ... ลอจิก Swal แจ้งเตือนข้อผิดพลาดตามเดิม
        }
    };

    // ผู้ใช้ยืนยันส่งชุดที่มีภาพซึ่ง AI ไม่พบหลอดทดลอง → commit ผลที่พักไว้เข้าหน้าผลลัพธ์ตามปกติ
    // รายการที่ไม่พบหลอดจะไม่มีสถานะ (status = null) และถูกบังคับเข้าคิวรอตรวจสอบตอนบันทึก
    const confirmSubmitBlocked = () => {
        if (pendingAnalyzedItems.length === 0) return;
        setVerifyErrors({});
        finalizeAnalysis(pendingAnalyzedItems);
        setPendingAnalyzedItems([]);
    };

    // เคลียร์ผลวิเคราะห์/รูป/ข้อผิดพลาดทั้งหมด กลับไปเริ่มถ่ายภาพใหม่ — ใช้เมื่อผลลัพธ์ไม่ใช่สิ่งที่ต้องการบันทึก
    // คงค่าสถานี/เวลา/toggle สารไว้ตามเดิม (ไม่ต้องกรอกซ้ำ) แต่ออก sessionGroup ใหม่เพราะเป็นการเก็บตัวอย่างรอบใหม่จริง ๆ
    const resetToUpload = () => {
        setResults({});
        setDuplicateChoice({});
        setImageFiles({});
        setImagePreviews({});
        setImagePlotFiles({});
        setVerifyErrors({});
        setPendingAnalyzedItems([]);
        setSaved(false);
        setSavedSampleId(null);
        setSubmittedForReview(false);
        setSessionId(generateSessionId());
        setStep("upload");
    };

    const clearLocation = () => {
        setCurrentLocationId(null);
        setLocationName("");
        setSearchQuery("");
    };

    const revertAutoSwitch = (key: number) => {
        setResults((prev) => {
            const current = prev[key];
            if (!current || !current.autoSwitchedFrom) return prev;
            
            const originalParam = systemParameters.find(p => p.name.toLowerCase() === current.autoSwitchedFrom?.toLowerCase());
            if (!originalParam) return prev;

            const newResults = {
                ...prev,
                [key]: {
                    ...current,
                    parameterId: originalParam.id,
                    userInsistedOriginal: true,
                    autoSwitchedFrom: undefined,
                    isDuplicateSubstance: false,
                },
            };

            // Recalculate isDuplicateSubstance for all items
            const counts = new Map<number, number>();
            Object.values(newResults).forEach((r) => {
                counts.set(r.parameterId, (counts.get(r.parameterId) || 0) + 1);
            });

            const finalResults: Record<number, MeasurementResult> = {};
            Object.entries(newResults).forEach(([k, r]) => {
                finalResults[Number(k)] = {
                    ...r,
                    isDuplicateSubstance: (counts.get(r.parameterId) || 0) > 1,
                };
            });

            return finalResults;
        });
    };

    return {
        systemParameters,
        activeParameters,
        enabledParamIds,
        toggleParam,
        verifyErrors,
        setVerifyErrors,
        pendingAnalyzedItems,
        setPendingAnalyzedItems,
        confirmSubmitBlocked,
        isLoadingParams,
        imageFiles,
        setImageFiles,
        imagePreviews,
        setImagePreviews,
        imagePlotFiles,
        setImagePlotFiles,
        hiddenCanvasRef,
        router,
        currentUser,
        currentLocationId,
        setCurrentLocationId,
        locationName,
        setLocationName,
        locationType,
        setLocationType,
        step,
        setStep,
        results,
        duplicateChoice,
        chooseDuplicate,
        savedEntryKeys,
        overallStatus,
        saved,
        savedSampleId,
        submittedForReview,
        isRecommending,
        setIsRecommending,
        nearestLocations,
        setNearestLocations,
        allLocations,
        searchQuery,
        weatherData,
        setSearchQuery,
        collectionTime,
        setCollectionTime,
        oxygen,
        setOxygen,
        sessionId,
        handleAnalyze,
        handleSave,
        resetToUpload,
        clearLocation,
        revertAutoSwitch,

        gpsCoords,
        exifCoords,
        activeSource,
        handleSelectSource,
        processImageExif,
        onSelectSource,
    };
}
