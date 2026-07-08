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
    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <SectionHead icon={<Clock size={13} />} label="ข้อมูลการเก็บตัวอย่าง" />
            <div className="p-4 space-y-4">
                <div>
                    <label className="font-mono text-[9px] uppercase tracking-widest text-text-muted block mb-1.5">เวลาที่เก็บตัวอย่าง</label>
                    <input
                        type="datetime-local"
                        value={collectionTime}
                        required
                        onChange={(e) => setCollectionTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs focus:border-teal-500 focus:outline-none transition-colors min-h-[44px]"
                    />
                </div>
                <div>
                    <label className="font-mono text-[9px] uppercase tracking-widest text-text-muted block mb-1.5">ออกซิเจนละลายน้ำ — ไม่จำเป็น</label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="20"
                            value={oxygen}
                            onChange={(e) => setOxygen(e.target.value)}
                            placeholder="เช่น 6.5"
                            className="w-full px-3 py-2.5 pr-12 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs focus:border-teal-500 focus:outline-none transition-colors min-h-[44px]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-text-muted">mg/L</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
