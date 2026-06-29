"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import liff from "@line/liff";

export default function ExportButtons() {
    const [isExporting, setIsExporting] = useState<"csv" | "excel" | null>(null);

    // 1. ฟังก์ชันส่งออกเป็นไฟล์ CSV
    const handleExportCSV = async () => {
        setIsExporting("csv");
        try {
            const res = await fetch("/api/samples/export-csv", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            if (!res.ok) throw new Error("Failed to export CSV file");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Water_Quality_Report_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("CSV Export failed:", error);
            alert("ไม่สามารถส่งออกไฟล์ CSV ได้");
        } finally {
            setIsExporting(null);
        }
    };

    // 2. ฟังก์ชันส่งออกเป็นไฟล์ Excel (.xlsx) แบบมี Sheet โครงสร้างสวยงาม
    const handleExportExcel = async () => {
        setIsExporting("excel");
        try {
            // เรียกยิง API ส่งออกตรงๆ พร้อมแนบสิทธิ์ความปลอดภัยใน headers
            const res = await fetch("/api/samples/export", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            if (!res.ok) throw new Error("Failed to export Excel file");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Water_Quality_With_Images_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Excel Export failed:", error);
            alert("ไม่สามารถส่งออกไฟล์ Excel ได้");
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* ปุ่มดาวน์โหลด CSV */}
            <button
                onClick={handleExportCSV}
                disabled={isExporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-subtle active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer shadow-sm min-h-[40px]"
            >
                {isExporting === "csv" ? <Loader2 size={14} className="animate-spin text-primary" /> : <FileText size={14} className="text-orange-500" />}
                ส่งออกไฟล์ CSV (.csv)
            </button>

            {/* ปุ่มดาวน์โหลด Excel */}
            <button
                onClick={handleExportExcel}
                disabled={isExporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-subtle active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer shadow-sm min-h-[40px]"
            >
                {isExporting === "excel" ? <Loader2 size={14} className="animate-spin text-primary" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                ส่งออกไฟล์ Excel (.xlsx)
            </button>
        </div>
    );
}
