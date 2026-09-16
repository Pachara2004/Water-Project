/**
 * @file PageHeader.tsx
 * @project Water Monitoring Project
 * @module UI / Layout
 * @description
 * แถบหัวหน้าจอแบบ sticky ใช้ซ้ำได้ทุกหน้า: ปุ่มย้อนกลับชิดซ้าย หัวข้ออยู่กึ่งกลางจริงเสมอ
 * ด้วย absolute center (ไม่ขยับตามความกว้างของปุ่มซ้าย/spacer ขวา) รูปแบบเดียวกับหน้า submit
 *
 * Reusable sticky top bar: back button on the left, title absolutely centered
 * so it never shifts with the left button / right spacer widths.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-24
 * @version 1.0.0
 *
 * @lastModified 2026-07-24 15:33
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-24 15:33 by Nopparut U. - แยก header ออกจากหน้า submit เป็นคอมโพเนนต์กลาง
 *
 * @client-side ทำงานฝั่ง Client ('use client') เพราะใช้ useRouter
 * @license Private / Proprietary
 */

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * แถบหัวหน้าจอพร้อมปุ่มย้อนกลับ
 *
 * @param title - หัวข้อที่แสดงกึ่งกลางแถบ
 * @param onBack - callback ตอนกดย้อนกลับ; ไม่ส่ง = ใช้ `router.back()`
 */
export default function PageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
    const router = useRouter();
    const handleBack = onBack ?? (() => router.back());

    return (
        <header className="bg-card-general border-b border-border sticky top-0 z-20">
            <div className="w-full px-4 h-13 flex items-center justify-between relative">
                {/* ฝั่งซ้าย: ปุ่มย้อนกลับ */}
                <div className="flex items-center gap-3 z-10">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-xs font-medium text-text hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-surface-subtle transition-all cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        <span>ย้อนกลับ</span>
                    </button>
                </div>

                {/* ตรงกลาง: หัวข้อ (อยู่ตรงกลางของ header เสมอ) — สีฟ้า primary ตัวหนา (font-semibold) ทั้งมือถือและ desktop */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-sm font-semibold text-primary pointer-events-auto">{title}</h1>
                </div>

                {/* ฝั่งขวา: spacer เพื่อความสมดุล */}
                <div className="w-20" />
            </div>
        </header>
    );
}
