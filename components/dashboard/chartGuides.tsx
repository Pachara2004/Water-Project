"use client";

import { useRef, useState } from "react";
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
                    "ตัวเลขใหญ่คือค่าของช่วงวันที่ที่เลือกด้านบน",
                    'ป้ายเล็กใต้ตัวเลขอ่านว่า "ค่าช่วงก่อน → ค่าช่วงนี้" เขียว = ดีขึ้น แดง = แย่ลง',
                    'กดปุ่ม "เทียบ: รายสัปดาห์ / รายเดือน" มุมขวาบน เพื่อสลับรอบที่ใช้เปรียบเทียบ',
                ],
            },
            {
                heading: "ระวัง",
                items: [
                    "ตัวเลขบนป้ายเป็นของสัปดาห์/เดือนตามปฏิทิน คนละช่วงกับตัวเลขใหญ่ อย่าเอาไปบวกลบกัน",
                    'ขีด "—" แปลว่าช่วงก่อนหน้าไม่มีข้อมูลให้เทียบ ไม่ได้แปลว่าไม่มีการเปลี่ยนแปลง',
                    '"ตัวอย่างน้อย" แปลว่าฝั่งใดฝั่งหนึ่งมีไม่ถึง 10 ตัวอย่าง ผลต่างเหวี่ยงเกินกว่าจะเชื่อได้',
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
        title: "สภาพอากาศมีผลต่อค่าสารเคมีในน้ำหรือไม่",
        blocks: [
            { heading: "ดูอะไร", items: ["ฝนตกหรือน้ำอุ่นขึ้น มีส่วนทำให้สารเคมีในน้ำสูงขึ้นหรือไม่"] },
            {
                heading: "อ่านยังไง",
                items: [
                    "กดปุ่มด้านบนเลือกว่าจะดูฝนหรืออุณหภูมิน้ำ คู่กับสารตัวไหน",
                    "แต่ละแถวคือสภาพอากาศแบบหนึ่ง เรียงจากฝนน้อยสุด (บน) ลงไปฝนหนักสุด (ล่าง)",
                    "แท่งยาวขึ้นจากบนลงล่าง = ฝนยิ่งหนักค่ายิ่งสูง แท่งพอ ๆ กัน = สภาพอากาศแทบไม่มีผล",
                ],
            },
            {
                heading: "ระวัง",
                items: [
                    "แท่งสีจาง = ตัวอย่างน้อยเกินไป ค่าเฉลี่ยเหวี่ยงง่าย ส่วนแถวที่ไม่มีแท่ง = ไม่มีผลตรวจ ไม่ใช่ค่าเป็นศูนย์",
                    "แท่งไล่ยาวขึ้นไม่ได้แปลว่าฝนเป็นสาเหตุ อาจมีปัจจัยอื่นที่เกิดพร้อมกับฝน",
                    "อุณหภูมิน้ำเป็นค่าที่ประมาณจากแบบจำลอง ไม่ได้วัดจากหน้างาน",
                ],
            },
            {
                heading: "สำหรับคนที่อยากดูตัวเลข",
                items: [
                    "บรรทัดเล็กใต้ประโยคสรุปคือค่า r (-1 ถึง +1) ใกล้ +1 = ไปทางเดียวกัน ใกล้ -1 = ไปคนละทาง ใกล้ 0 = แทบไม่สัมพันธ์",
                    "|r| ต่ำกว่า 0.2 = แทบไม่ต่าง, 0.2–0.5 = มีแนวโน้มบ้าง, เกิน 0.5 = ชัดเจน",
                ],
            },
        ],
    },
};

// ปุ่ม (i) ข้างหัวข้อกราฟ กดแล้วเปิดกล่องอธิบาย — แพทเทิร์นเดียวกับปุ่มดูตัวอย่างสีใน components/submit/ImageZone.tsx
// กดเท่านั้น ไม่ใช้ hover เพราะจอสัมผัสไม่มี hover ให้เจอ (ดูหมายเหตุเดียวกันใน dashboardHelpers.tsx เรื่อง cursor-help)

// ที่ว่างขั้นต่ำที่กล่องยังอ่านได้ ถ้าด้านที่เลือกเหลือน้อยกว่านี้ กล่องจะเลื่อนอ่านเอาแทนการล้นขอบจอ
const MIN_PANEL_HEIGHT = 180;
// ระยะกันชนขอบจอ กันไม่ให้กล่องแตะขอบพอดีเป๊ะ
const VIEWPORT_GUTTER = 12;
// Navbar ยึดขอบล่างจอเมื่อแคบกว่า lg (ดู layout.tsx: lg:pl-50 คือจุดที่ Navbar ย้ายไปเป็นแถบข้าง)
// ที่ว่างด้านล่างจึงต้องหักส่วนนี้ออก ไม่งั้นกล่องจะไปจมอยู่ใต้ Navbar
const NAVBAR_HEIGHT = 96;
const NAVBAR_BREAKPOINT = 1024;

export function ChartInfoButton({ guide }: { guide: GuideKey }) {
    const [open, setOpen] = useState(false);
    // ทิศทางและความสูงคำนวณตอนกดเปิด จากที่ว่างจริงรอบปุ่ม ณ ขณะนั้น
    const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const g = CHART_GUIDES[guide];

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }

        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            const bottomReserved = window.innerWidth < NAVBAR_BREAKPOINT ? NAVBAR_HEIGHT : VIEWPORT_GUTTER;
            const below = window.innerHeight - rect.bottom - bottomReserved;
            const above = rect.top - VIEWPORT_GUTTER;
            // กางขึ้นเมื่อข้างล่างไม่พอ และข้างบนมีที่ว่างมากกว่า — กราฟท้าย ๆ หน้าจะได้ไม่กางทะลุขอบล่าง
            const up = below < MIN_PANEL_HEIGHT && above > below;
            setPlacement({ up, maxHeight: Math.max(MIN_PANEL_HEIGHT, up ? above : below) });
        }
        setOpen(true);
    };

    return (
        <span className="inline-flex shrink-0">
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                aria-label={`คำอธิบาย: ${g.title}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
                <Info size={14} />
            </button>

            {open && (
                <>
                    {/* ตัวรับคลิกนอกกล่อง — โปร่งใส คลุมทั้งจอ กดที่ไหนก็ปิดได้ */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* กล่องยึดกับ "แถวหัวข้อ" ไม่ใช่ตัวปุ่ม — span ครอบปุ่มจึงจงใจไม่ใส่ relative
                        ผู้เรียกต้องใส่ relative ที่แถวหัวข้อ (ซึ่งกว้างเท่าการ์ด) กล่องจะได้กางเต็มความกว้างการ์ดพอดี
                        เหตุผล: ปุ่มทั้ง 5 จุดอยู่คนละตำแหน่งแนวนอน (ต่อท้ายหัวข้อที่ยาวไม่เท่ากัน) ถ้ายึดกับปุ่มจะล้นขอบจอ
                        จอกว้าง (sm ขึ้นไป) หดเป็นการ์ด w-80 ชิดขอบซ้ายของแถวหัวข้อ ซึ่งเป็นฝั่งเดียวกับที่ปุ่มอยู่
                        (ชิดขวาจะไปโผล่กลางการ์ดในแถวหัวข้อที่กว้างหลายคอลัมน์ ห่างจากปุ่มที่เพิ่งกดจนดูเหมือนคนละเรื่องกัน)

                        ทิศทางบน/ล่างและ maxHeight มาจากการวัดที่ว่างจริงตอนกดเปิด ไม่ใช่ค่าคงที่
                        (60vh ตายตัวไม่พอ เพราะจำกัดแค่ความสูง ไม่ได้ขยับจุดเริ่มต้น กราฟท้ายหน้าจึงยังกางทะลุขอบล่าง)

                        text-xs font-normal ที่กล่อง = ตัดการสืบทอดจากแถวหัวข้อที่ไปวางอยู่
                        (บางแถวเป็น font-semibold ทำให้ตัวหนังสือในกล่องหนากว่าจุดอื่น) กล่องทั้ง 5 จุดจะได้หน้าตาเหมือนกันเสมอ */}
                    <div
                        style={{ maxHeight: placement.maxHeight || undefined }}
                        className={`absolute left-0 right-0 z-50 flex flex-col gap-3 sm:right-auto sm:w-80 bg-surface border border-border rounded-2xl shadow-2xl p-3.5 animate-fade-in text-xs font-normal ${
                            placement.up ? "bottom-full mb-1" : "top-full mt-1"
                        }`}
                    >
                        <div className="flex items-center justify-between pb-1 border-b border-border shrink-0">
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

                        {/* flex-1 + min-h-0 ให้ส่วนเนื้อหากินที่ว่างที่เหลือแล้วเลื่อนเองเมื่อล้น
                            (min-h-0 จำเป็น ไม่งั้น flex item ยืดตามเนื้อหาจนดัน maxHeight ของกล่องพัง) */}
                        <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto">
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
