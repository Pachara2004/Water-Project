// components/submit/MetadataFields.tsx
import { Clock } from "lucide-react";
import { SectionHead } from "./SharedAtoms";

interface MetadataFieldsProps {
    collectionTime: string;
    setCollectionTime: (t: string) => void;
    oxygen: string;
    setOxygen: (o: string) => void;
}

export function MetadataFields({ collectionTime, setCollectionTime, oxygen, setOxygen }: MetadataFieldsProps) {
    // คำนวณเวลาปัจจุบันให้อยู่ในฟอร์แมต YYYY-MM-THH:mm สำหรับใส่ค่า max
    const getNowMaxString = () => {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };

    const maxNow = getNowMaxString();

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedValue = e.target.value;

        // ดักจับถ้าผู้ใช้เลือก/พิมพ์เวลาอนาคต
        if (selectedValue > maxNow) {
            setCollectionTime(maxNow);
        } else {
            setCollectionTime(selectedValue);
        }
    };

    const handleOxygenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;

        // 1. ถ้ายอมให้ว่างเวลากดลบตัวเลขทั้งหมด
        if (val === "") {
            setOxygen("");
            return;
        }

        // 2. ตัดทุกตัวอักษรที่ไม่ใช่ตัวเลขและจุดทศนิยมออกทันที
        val = val.replace(/[^0-9.]/g, "");

        // 3. ป้องกันการพิมพ์จุดซ้ำ (เช่น 6.5.5) ให้เหลือจุดแรกจุดเดียว
        const parts = val.split(".");
        if (parts.length > 2) {
            val = `${parts[0]}.${parts.slice(1).join("")}`;
        }

        // 4. ถ้าพิมพ์แค่จุดตัวเดียว "." ให้ปล่อยไว้ก่อน เพื่อให้พิมพ์ทศนิยมต่อได้ (เช่น .5)
        if (val === ".") {
            setOxygen("0.");
            return;
        }

        const num = parseFloat(val);
        if (isNaN(num)) {
            setOxygen("");
            return;
        }

        // 5. ดักขอบเขต 0 - 20 mg/L
        if (num < 0) {
            setOxygen("0");
        } else if (num > 20) {
            setOxygen("20");
        } else {
            setOxygen(val);
        }
    };

    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <div className="text-sm font-semibold">
                <SectionHead icon={<Clock size={16} />} label="ข้อมูลการเก็บตัวอย่าง" />
            </div>
            <div className="p-3.5 sm:p-4 space-y-3.5">
                <div>
                    <label className="text-xs text-text-muted block mb-1.5 font-medium">เวลาที่เก็บตัวอย่าง</label>
                    <input
                        title="datetime"
                        type="datetime-local"
                        value={collectionTime}
                        max={maxNow}
                        required
                        onChange={handleTimeChange}
                        className="w-full px-3 py-2 bg-surface-subtle border border-border text-text rounded-lg text-xs focus:border-primary focus:outline-hidden transition-colors min-h-10 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                        <label className="text-xs text-text-muted block font-medium">ออกซิเจนละลายน้ำ (ไม่บังคับ)</label>
                        <span className="text-[10px] text-text-muted font-medium shrink-0">(0.0 - 20.0)</span>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={oxygen}
                            onChange={handleOxygenChange}
                            placeholder="เช่น 6.5"
                            className="w-full px-3 py-2 pr-12 bg-surface-subtle border border-border text-text rounded-lg text-xs focus:border-primary focus:outline-hidden transition-colors min-h-10 font-mono font-medium"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-semibold pointer-events-none">mg/L</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
