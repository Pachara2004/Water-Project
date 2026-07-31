"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Check } from "lucide-react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import Popup from "@/components/Popup";

// สิทธิ์ส่งออกไฟล์ตรงกับ allowedRoles ของ /api/samples/export และ /export-csv
// collector เข้าหน้าแดชบอร์ดได้แต่ส่งออกไม่ได้ ปุ่มจึงต้องไม่โผล่
const EXPORT_ROLES = ["officer", "admin"];

// เพดานของ XLSX ฝั่ง server (MAX_XLSX_ROWS) — ซ้ำไว้ที่นี่เพื่อเตือนก่อนกด ไม่ใช่เพื่อบังคับ
// การบังคับจริงอยู่ที่ route เท่านั้น (ตอบ 413) ตัวเลขนี้แค่ทำให้ผู้ใช้ไม่ต้องรอจนโดนปฏิเสธ
const XLSX_ROW_LIMIT = 2000;

export type ExportFilters = {
    viewMode: "ALL" | "MINE";
    startDate: string;
    endDate: string;
    agency: string;
    locationId: number | null;
};

type ExportFormat = "csv" | "excel";
type ExportScope = "filtered" | "all";

export default function ExportButtons({ className = "w-full", filters }: { className?: string; filters: ExportFilters }) {
    const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
    const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null); // รูปแบบที่รอผู้ใช้ยืนยันขอบเขตใน popup
    const [scope, setScope] = useState<ExportScope>("filtered");
    const [counts, setCounts] = useState<{ filtered: number; all: number; filteredLabel: string } | null>(null);
    const [countError, setCountError] = useState(false);
    const currentUser = useAppStore((state) => state.currentUser);

    const canExport = currentUser !== null && EXPORT_ROLES.includes(currentUser.role);

    const buildQuery = (exportScope: ExportScope) => {
        const params = new URLSearchParams({
            scope: exportScope,
            viewMode: filters.viewMode,
            startDate: filters.startDate,
            endDate: filters.endDate,
            agency: filters.agency,
        });
        if (filters.locationId) params.set("locationId", String(filters.locationId));
        return params.toString();
    };

    // เปิด popup พร้อมล้างผลนับของรอบก่อน (ล้างที่นี่ ไม่ใช่ใน effect เพื่อไม่ให้ setState ยิงซ้อนตอน render)
    const openExportDialog = (format: ExportFormat) => {
        setScope("filtered");
        setCounts(null);
        setCountError(false);
        setPendingFormat(format);
    };

    // นับจำนวนแถวตอนเปิด popup — ผู้ใช้จะได้รู้ตัวก่อนว่ากำลังจะโหลด 12 แถวหรือ 12,000 แถว
    useEffect(() => {
        if (pendingFormat === null) return;
        let cancelled = false;

        fetch(`/api/samples/export/count?${buildQuery("filtered")}`, {
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Count failed");
                return res.json();
            })
            .then((data) => {
                if (!cancelled) setCounts(data);
            })
            .catch(() => {
                if (!cancelled) setCountError(true);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingFormat, filters.viewMode, filters.startDate, filters.endDate, filters.agency, filters.locationId]);

    // ชื่อไฟล์มาจาก Content-Disposition ที่ server ตั้งไว้ (บอกช่วงวันที่/ขอบเขตจริง)
    // อ่าน filename* ก่อนเพราะเป็นตัวที่รองรับภาษาไทย ส่วน filename เป็นแค่ ASCII สำรอง
    const filenameFromResponse = (res: Response, fallback: string) => {
        const disposition = res.headers.get("Content-Disposition") || "";
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match) {
            try {
                return decodeURIComponent(utf8Match[1]);
            } catch {
                /* ชื่อที่ decode ไม่ได้ ให้ตกไปใช้ตัวสำรองด้านล่าง */
            }
        }
        const asciiMatch = disposition.match(/filename="([^"]+)"/i);
        return asciiMatch ? asciiMatch[1] : fallback;
    };

    const runExport = async (format: ExportFormat, exportScope: ExportScope) => {
        setIsExporting(format);
        setPendingFormat(null);
        const endpoint = format === "csv" ? "/api/samples/export-csv" : "/api/samples/export";

        try {
            const res = await fetch(`${endpoint}?${buildQuery(exportScope)}`, {
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });

            if (!res.ok) {
                // 413 = ข้อมูลเกินเพดาน XLSX — server ส่งข้อความบอกทางออกมาด้วย แสดงให้ผู้ใช้เห็นตรง ๆ
                const message = await res
                    .json()
                    .then((body) => body?.error)
                    .catch(() => null);
                throw new Error(message || `ส่งออกไม่สำเร็จ (${res.status})`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", filenameFromResponse(res, format === "csv" ? "water-quality.csv" : "water-quality.xlsx"));
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(`${format} export failed:`, error);
            alert(error instanceof Error ? error.message : "ไม่สามารถส่งออกไฟล์ได้");
        } finally {
            setIsExporting(null);
        }
    };

    if (!canExport) return null;

    const selectedCount = counts ? (scope === "all" ? counts.all : counts.filtered) : null;
    const overXlsxLimit = pendingFormat === "excel" && selectedCount !== null && selectedCount > XLSX_ROW_LIMIT;

    const scopeOption = (value: ExportScope, title: string, detail: string, count: number | null) => (
        <button
            key={value}
            onClick={() => setScope(value)}
            className={`w-full text-left px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
                scope === value ? "border-primary bg-primary/5" : "border-border bg-surface-subtle hover:bg-surface-muted"
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-text-primary">{title}</span>
                {scope === value && <Check size={14} className="text-primary shrink-0" />}
            </div>
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">{detail}</p>
            <p className="text-[11px] text-text-muted mt-1.5">{count === null ? "กำลังนับจำนวน…" : `${count.toLocaleString("th-TH")} แถว`}</p>
        </button>
    );

    return (
        <>
            <div className={`grid grid-cols-2 gap-3 ${className}`}>
                {/* ปุ่มดาวน์โหลด CSV */}
                <button
                    onClick={() => openExportDialog("csv")}
                    disabled={isExporting !== null}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-subtle active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer"
                >
                    {isExporting === "csv" ? <Loader2 size={14} className="animate-spin text-primary" /> : <FileText size={14} className="text-orange-500" />}
                    ส่งออกไฟล์ CSV
                </button>

                {/* ปุ่มดาวน์โหลด Excel */}
                <button
                    onClick={() => openExportDialog("excel")}
                    disabled={isExporting !== null}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-subtle active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer"
                >
                    {isExporting === "excel" ? <Loader2 size={14} className="animate-spin text-primary" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                    ส่งออกไฟล์ Excel
                </button>
            </div>

            {pendingFormat !== null && (
                <Popup onClose={() => setPendingFormat(null)} title={pendingFormat === "csv" ? "ส่งออกไฟล์ CSV" : "ส่งออกไฟล์ Excel"} maxWidth="max-w-md">
                    <div className="space-y-3">
                        {scopeOption("filtered", "ตามฟิลเตอร์ปัจจุบัน", counts?.filteredLabel || "ช่วงวันที่และหน่วยงานที่เลือกไว้บนแดชบอร์ด", counts?.filtered ?? null)}
                        {scopeOption("all", "ทั้งหมดในระบบ", "ข้อมูลที่ยืนยันแล้วทุกรายการ ไม่จำกัดช่วงวันที่และหน่วยงาน", counts?.all ?? null)}

                        {countError && <p className="text-[11px] text-amber-600 leading-relaxed">นับจำนวนแถวไม่สำเร็จ — ยังส่งออกได้ตามปกติ แต่จะไม่รู้ขนาดไฟล์ล่วงหน้า</p>}

                        {overXlsxLimit && (
                            <p className="text-[11px] text-red-500 leading-relaxed">
                                เกินเพดาน {XLSX_ROW_LIMIT.toLocaleString("th-TH")} แถวของไฟล์ Excel (เพราะต้องฝังรูปภาพทุกแถว) — กรุณาแคบช่วงวันที่ลง หรือใช้การส่งออกแบบ CSV ที่ไม่จำกัดจำนวนแถว
                            </p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setPendingFormat(null)}
                                className="flex-1 py-3 text-xs font-semibold rounded-2xl bg-surface-subtle border border-border text-text-secondary hover:bg-surface-muted transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => runExport(pendingFormat, scope)}
                                disabled={overXlsxLimit || selectedCount === 0}
                                className="flex-1 py-3 text-xs font-semibold rounded-2xl bg-primary hover:bg-navy-dark text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {selectedCount === 0 ? "ไม่มีข้อมูลให้ส่งออก" : "ดาวน์โหลด"}
                            </button>
                        </div>
                    </div>
                </Popup>
            )}
        </>
    );
}
