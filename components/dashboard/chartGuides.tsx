"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

export type GuideKey = "kpi" | "hotspots" | "temporal" | "trend" | "correlation";

type GuideBlock = { heading: string; items: string[] };

// เนื้อหาคำอธิบายกราฟทั้ง 5 ส่วนของหน้าแดชบอร์ด — รวมไว้ที่เดียวเพราะ dashboardDesktop.tsx / dashboardMobile.tsx
// มีโครงเหมือนกันเป๊ะและต้องแก้คู่กันเสมอ ถ้าแยกข้อความไว้คนละไฟล์จะเพี้ยนจากกันเมื่อมีคนแก้คำในอนาคต
// โครงทุกกล่องเหมือนกัน: ดูอะไร -> อ่านยังไง -> ระวัง เพื่อให้ผู้ใช้จำรูปแบบได้
export const CHART_GUIDES: Record<GuideKey, { title: string; blocks: GuideBlock[] }> = {
    kpi: {
        title: "ตัวชี้วัดหลัก",
        blocks: [
            { heading: "ดูอะไร", items: ["สรุปภาพรวมคุณภาพน้ำของช่วงวันที่ที่เลือกไว้ด้านบน"] },
            {
                heading: "อ่านยังไง",
                items: [
                    "ตัวเลขใหญ่คือค่าของช่วงวันที่ที่เลือก",
                    "ป้ายเล็กใต้ตัวเลขคือการเปรียบเทียบกับรอบก่อนหน้า เขียว = ดีขึ้น แดง = แย่ลง",
                    'กดปุ่ม "เทียบ: รายสัปดาห์ / รายเดือน" มุมขวาบน เพื่อสลับรอบที่ใช้เปรียบเทียบ',
                ],
            },
            {
                heading: "ระวัง",
                items: [
                    'ขีด "—" แปลว่ารอบก่อนหน้าไม่มีข้อมูลให้เทียบ ไม่ได้แปลว่าไม่มีการเปลี่ยนแปลง',
                    'อัตราปลอดภัยใช้หน่วย pp เช่น "ลด 5pp" คือจาก 80% เหลือ 75%',
                ],
            },
        ],
    },
    hotspots: {
        title: "Danger Hotspots",
        blocks: [
            { heading: "ดูอะไร", items: ["สถานีที่ตรวจเจอน้ำอยู่ในระดับอันตรายบ่อยที่สุด ใช้ตัดสินใจว่าควรส่งคนไปดูที่ไหนก่อน"] },
            {
                heading: "อ่านยังไง",
                items: [
                    'ช่อง "อัตรา" คือเจออันตรายคิดเป็นกี่เปอร์เซ็นต์ของการตรวจทั้งหมดที่สถานีนั้น',
                    'ช่อง "ครั้ง" คือเจออันตรายกี่ครั้ง จากที่ตรวจไปทั้งหมดกี่ครั้ง',
                ],
            },
            {
                heading: "ระวัง",
                items: ["ตารางเรียงตามจำนวนครั้งที่เจอ สถานีที่ออกไปตรวจบ่อยจึงมีโอกาสติดอันดับมากกว่าโดยธรรมชาติ"],
            },
        ],
    },
    temporal: {
        title: "กราฟเปรียบเทียบความต่างของคุณภาพน้ำในช่วงเก็บตัวอย่าง",
        blocks: [
            { heading: "ดูอะไร", items: ["เวลาที่ออกไปเก็บตัวอย่างน้ำ มีผลต่อค่าที่วัดได้หรือไม่"] },
            {
                heading: "อ่านยังไง",
                items: [
                    "แท่งสีฟ้าคือตัวอย่างที่เก็บก่อนเที่ยง (00:00–11:59)",
                    "แท่งสีเหลืองคือตัวอย่างที่เก็บหลังเที่ยง (12:00–23:59)",
                    "แท่งยิ่งสูง แปลว่าค่าเฉลี่ยของสารตัวนั้นยิ่งสูง",
                ],
            },
        ],
    },
    trend: {
        title: "กราฟวิเคราะห์แนวโน้มสะสมตามเกณฑ์มาตรฐานของ PCD",
        blocks: [
            { heading: "ดูอะไร", items: ["ดูแนวโน้มของค่าเฉลี่ยสารเทียบกับเกณฑ์มาตรฐานของกรมควบคุมมลพิษ (PCD)"] },
            {
                heading: "อ่านยังไง",
                items: ["เส้นทึบคือค่าที่วัดได้จริง", "เส้นประคือเกณฑ์ที่ไม่ควรเกิน (ดูชื่อเกณฑ์ได้ใต้กราฟ)", "เส้นทึบอยู่ต่ำกว่าเส้นประ แปลว่ายังอยู่ในเกณฑ์"],
            },
        ],
    },
    correlation: {
        title: "กราฟความสัมพันธ์เชิงสถิติระหว่างสภาพภูมิอากาศ",
        blocks: [
            { heading: "ดูอะไร", items: ["ฝนตกหรืออากาศร้อน มีส่วนทำให้สารเคมีในน้ำสูงขึ้นหรือไม่"] },
            {
                heading: "อ่านยังไง",
                items: [
                    "กดปุ่มด้านบนเพื่อเลือกว่าจะดูฝนหรืออุณหภูมิ คู่กับสารตัวไหน",
                    "ช่องสี่เหลี่ยมยิ่งเข้ม แปลว่ามีผลตรวจตกอยู่ตรงนั้นเยอะ",
                    "เส้นประคือทิศทางโดยรวมของความสัมพันธ์",
                ],
            },
            {
                heading: "ตัวเลข r บนการ์ด",
                items: [
                    "r มีค่าตั้งแต่ -1 ถึง +1 บอกว่าสองสิ่งนี้ไปด้วยกันแค่ไหน",
                    "เข้าใกล้ +1 คือไปทิศทางเดียวกัน เช่น ฝนยิ่งตกมาก สารเคมีก็ยิ่งสูงตาม",
                    "เข้าใกล้ -1 คือไปคนละทิศทาง เช่น ฝนยิ่งตกมาก สารเคมีกลับยิ่งลดลง",
                    "ใกล้ 0 คือแทบไม่มีความสัมพันธ์กัน",
                    "n คือจำนวนผลตรวจที่ใช้คำนวณ ยิ่งมากยิ่งเชื่อถือได้ ถ้าน้อยกว่า 5 ระบบจะไม่วาดให้",
                ],
            },
        ],
    },
};

// ปุ่ม (i) ข้างหัวข้อกราฟ กดแล้วเปิด popover อธิบาย — แพทเทิร์นเดียวกับปุ่มดูตัวอย่างสีใน components/submit/ImageZone.tsx
// กดเท่านั้น ไม่ใช้ hover เพราะจอสัมผัสไม่มี hover ให้เจอ (ดูหมายเหตุเดียวกันใน dashboardHelpers.tsx เรื่อง cursor-help)
// คืน <span className="relative inline-flex"> ห่อปุ่ม+popover ไว้ในตัวเอง เพื่อไม่ต้องไปเพิ่ม relative ที่ทุกจุดเรียกใช้
export function ChartInfoButton({ guide }: { guide: GuideKey }) {
    const [open, setOpen] = useState(false);
    const g = CHART_GUIDES[guide];

    return (
        <span className="relative inline-flex shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={`คำอธิบาย: ${g.title}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
                <Info size={14} />
            </button>

            {open && (
                <>
                    {/* ตัวรับคลิกนอกกล่อง — โปร่งใส คลุมทั้งจอ กดที่ไหนก็ปิดได้ */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl p-3.5 animate-fade-in space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-border">
                            <span className="text-xs font-semibold text-text">{g.title}</span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="ปิด"
                                className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
                            >
                                <X size={13} />
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
                            {g.blocks.map((block, i) => (
                                <div key={i}>
                                    <p className="text-xs font-semibold text-text-primary mb-1">{block.heading}</p>
                                    <ul className="space-y-1">
                                        {block.items.map((item, j) => (
                                            <li key={j} className="text-xs leading-relaxed text-text-secondary flex gap-1.5">
                                                <span className="text-text-muted shrink-0">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </span>
    );
}
