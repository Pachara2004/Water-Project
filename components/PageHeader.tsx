"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Top bar แบบเดียวกับหน้า submit — ปุ่มย้อนกลับชิดซ้าย, หัวข้ออยู่กึ่งกลางจริงเสมอด้วย absolute center
// (ไม่ขยับตามความกว้างปุ่มซ้าย/spacer ขวา) ใช้ซ้ำได้ทุกหน้าที่ต้องการ header ลักษณะนี้
// onBack: กำหนดเองได้ | ไม่ส่ง = ย้อนกลับด้วย router.back()
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
