// components/submit/MetadataFields.tsx
import { Clock } from "lucide-react";
import { SectionHead } from "./SharedAtoms";
import { getWeatherConditionLabel } from "@/lib/weather";

interface MetadataFieldsProps {
    collectionTime: string;
    setCollectionTime: (t: string) => void;
    oxygen?: string;
    setOxygen?: (o: string) => void;

    airTemperature?: number | null;
    rainAccumulation?: number | null;
    weatherCondCode?: number | null;
    temperature?: number | null;
    rainVolume?: number | null;
    weatherCondition?: number | null;
    weatherData?: {
        airTemperature?: number | null;
        rainAccumulation?: number | null;
        weatherCondCode?: number | null;
        temperature?: number | null;
        rainVolume?: number | null;
        weatherCondition?: number | null;
    } | null;
}

export function MetadataFields(props: MetadataFieldsProps) {
    const { collectionTime, setCollectionTime, weatherData } = props;

    const temp = props.airTemperature ?? props.temperature ?? weatherData?.airTemperature ?? weatherData?.temperature ?? null;
    const rain = props.rainAccumulation ?? props.rainVolume ?? weatherData?.rainAccumulation ?? weatherData?.rainVolume ?? null;
    const cond = props.weatherCondCode ?? props.weatherCondition ?? weatherData?.weatherCondCode ?? weatherData?.weatherCondition ?? null;

    // ฟังก์ชันจัดฟอร์แมตวันที่แบบ ISO Local String (YYYY-MM-DDTHH:mm)
    const formatLocalDateTime = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    // 🟢 1. คำนวณเวลาสูงสุด (ปัจจุบัน - ห้ามเลือกอนาคต)
    const now = new Date();
    const maxNow = formatLocalDateTime(now);

    // 🟢 2. คำนวณเวลาย้อนหลังสูงสุด 60 วัน (ห้ามเลือกลึกกว่า 60 วัน)
    const minDateObj = new Date();
    minDateObj.setDate(now.getDate() - 60);
    const min60Days = formatLocalDateTime(minDateObj);

    // 🟢 3. จัดการการเปลี่ยนเวลาพร้อมดักขอบเขต min/max
    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedValue = e.target.value;
        if (!selectedValue) return;

        if (selectedValue > maxNow) {
            setCollectionTime(maxNow);
        } else if (selectedValue < min60Days) {
            setCollectionTime(min60Days);
        } else {
            setCollectionTime(selectedValue);
        }
    };

    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <div className="text-sm font-semibold">
                <SectionHead icon={<Clock size={16} />} label="ข้อมูลการเก็บตัวอย่าง" />
            </div>

            <div className="p-3.5 sm:p-4 space-y-4">
                <div>
                    <label className="text-xs text-text-muted block mb-1.5 font-medium">เวลาที่เก็บตัวอย่าง</label>
                    <input
                        title="datetime"
                        type="datetime-local"
                        value={collectionTime}
                        min={min60Days} // 🟢 ล็อคห้ามเลือกย้อนหลังเกิน 60 วัน
                        max={maxNow} // 🟢 ล็อคห้ามเลือกอนาคต
                        required
                        onChange={handleTimeChange}
                        className="w-full px-3 py-2 bg-surface-subtle border border-border text-text rounded-lg text-xs focus:outline-hidden transition-colors min-h-10 cursor-pointer font-medium"
                    />
                </div>

                {/* กล่องแสดงข้อมูลสภาพอากาศ */}
                <div className="bg-card-general border border-border rounded-2xl p-5 sm:p-6">
                    <h4 className="text-sm font-semibold justify-center flex text-primary mb-4">ข้อมูลสภาพอากาศขณะเก็บตัวอย่าง</h4>

                    <div className="grid grid-cols-1 gap-3 text-center">
                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">อุณหภูมิ</span>
                            <span className="text-xl font-bold text-text mt-1 block">{temp !== null && temp !== undefined ? `${Number(temp).toFixed(1)}°C` : "-"}</span>
                        </div>

                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">ปริมาณฝน</span>
                            <span className="text-xl font-bold text-text mt-1 block">{rain !== null && rain !== undefined ? `${Number(rain).toFixed(1)} mm` : "-"}</span>
                        </div>

                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">สภาพอากาศ</span>
                            <span className="text-xl font-bold text-text mt-1 block truncate">{cond !== null && cond !== undefined ? getWeatherConditionLabel(cond) : "-"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
