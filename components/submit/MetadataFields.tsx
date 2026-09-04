// components/submit/MetadataFields.tsx
import { Clock, RotateCcw } from "lucide-react";
import { SectionHead } from "./SharedAtoms";
import { getWeatherConditionLabel } from "@/lib/weather";
import type { WeatherStatus } from "./NavWorkflow";

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

    weatherStatus?: WeatherStatus;
    retryWeather?: () => void;
}

/**
 * ช่องแสดงค่าอากาศ 1 ตัว
 * ระหว่างโหลดแสดงแถบ skeleton แทนขีด "-" เพื่อไม่ให้ "ยังโหลดอยู่" ดูเหมือน "ไม่มีข้อมูล"
 */
function WeatherTile({ label, value, isLoading }: { label: string; value: string | null; isLoading: boolean }) {
    return (
        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
            <span className="text-xs font-bold text-secondary block uppercase">{label}</span>
            {isLoading ? (
                <span className="h-7 mt-1 mx-auto block w-24 rounded-md bg-border animate-pulse" aria-label="กำลังโหลด" />
            ) : (
                <span className="text-xl font-bold text-text mt-1 block truncate">{value ?? "-"}</span>
            )}
        </div>
    );
}

export function MetadataFields(props: MetadataFieldsProps) {
    const { collectionTime, setCollectionTime, weatherData, weatherStatus = "idle", retryWeather } = props;
    const isWeatherLoading = weatherStatus === "loading";
    // ดึงไม่สำเร็จกับไม่มีข้อมูลของชั่วโมงนั้น บล็อกปุ่มวิเคราะห์เหมือนกัน แต่แจ้งผู้ใช้คนละแบบ
    const weatherProblem = weatherStatus === "error" ? "ดึงข้อมูลสภาพอากาศไม่สำเร็จ" : weatherStatus === "unavailable" ? "ไม่พบข้อมูลสภาพอากาศของสถานีนี้ในเวลาที่เลือก" : null;

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
                        <WeatherTile label="อุณหภูมิ" isLoading={isWeatherLoading} value={temp !== null && temp !== undefined ? `${Number(temp).toFixed(1)}°C` : null} />
                        <WeatherTile label="ปริมาณฝน" isLoading={isWeatherLoading} value={rain !== null && rain !== undefined ? `${Number(rain).toFixed(1)} mm` : null} />
                        <WeatherTile label="สภาพอากาศ" isLoading={isWeatherLoading} value={cond !== null && cond !== undefined ? getWeatherConditionLabel(cond) : null} />
                    </div>

                    {isWeatherLoading && <p className="text-xs text-text-muted text-center mt-3">กำลังดึงข้อมูลสภาพอากาศของเวลาที่เลือก…</p>}

                    {weatherProblem && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                            <p className="text-xs text-text-danger text-center leading-relaxed">{weatherProblem}</p>
                            <p className="text-xs text-text-muted text-center leading-relaxed">ต้องมีข้อมูลสภาพอากาศก่อนจึงจะส่งวิเคราะห์ได้</p>
                            {retryWeather && (
                                <button
                                    type="button"
                                    onClick={retryWeather}
                                    className="mt-1 px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-2 bg-surface-subtle border border-border text-text hover:bg-surface transition-colors cursor-pointer"
                                >
                                    <RotateCcw size={14} />
                                    <span>ลองใหม่</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
