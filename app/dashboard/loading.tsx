import { LucideSearch } from "lucide-react";

// Skeleton ของส่วนข้อมูล — mirror โครงการ์ดจริงใน dashboardDesktop/Mobile (คลาส/grid/typography เดียวกัน)
// ความสูงมาจากโครงของจริง ไม่ hardcode มั่ว: KPI/ตาราง = สูงตามเนื้อหา (typography เดียวกัน)
// | กราฟ = h-64 เท่าที่การ์ดจริงกำหนดไว้เอง (ดู bg chart cell / trend chart body ในการ์ดจริง)
// วางบาร์ placeholder ด้วย &nbsp; ในกล่อง text-* ให้ความสูงบรรทัดเท่าตัวจริงโดยไม่ต้องกำหนด h เอง
// มี animate-pulse ในตัวเพื่อให้ทำงานได้เองเมื่อถูกเรียกนอก route loading
// บาร์ placeholder — &nbsp; ในกล่อง text-* ของ parent ทำให้ความสูงบรรทัดเท่าตัวจริงโดยไม่ต้องกำหนด h
function Bar({ w, tone = "bg-surface-subtle" }: { w: string; tone?: string }) {
    return <span className={`inline-block max-w-full rounded ${w} ${tone}`}>&nbsp;</span>;
}

export function DashboardContentSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {/* แถวหัวข้อ "ตัวชี้วัดหลัก" + ปุ่มสลับรายสัปดาห์/รายเดือน */}
            <div className="flex items-center justify-between">
                <div className="text-md font-bold px-1">
                    <Bar w="w-24" />
                </div>
                <div className="h-9 w-40 rounded-xl bg-card-general border border-border" />
            </div>

            {/* KPI cards — โครง + typography เดียวกับการ์ดจริง (สูงตามเนื้อหา ไม่ fix) */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card-summary rounded-xl border border-border p-3 flex flex-col border-l-10 border-l-border col-span-1 md:col-span-3">
                        <div className="text-xs font-semibold">
                            <Bar w="w-3/4" tone="bg-white/25" />
                        </div>
                        <div className="mt-1 text-3xl font-bold leading-tight">
                            <Bar w="w-1/2" tone="bg-white/25" />
                        </div>
                        <div className="mt-1 text-xs">
                            <Bar w="w-2/5" tone="bg-white/25" />
                        </div>
                    </div>
                ))}
            </div>

            {/* ตาราง hotspot (ซ้าย) + กราฟความผันผวน (ขวา) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="col-span-1 md:col-span-5 bg-surface rounded-xl border border-border p-4 flex flex-col gap-2.5">
                    <div className="text-sm font-semibold">
                        <Bar w="w-1/2" />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="text-xs">
                                <Bar w="w-3/5" tone="bg-surface-subtle/70" />
                            </div>
                            <div className="text-xs">
                                <Bar w="w-2/5" tone="bg-surface-subtle/50" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="col-span-1 md:col-span-7 bg-card-general rounded-xl border border-border p-3 flex flex-col gap-3">
                    <div className="text-sm font-semibold">
                        <Bar w="w-2/3" />
                    </div>
                    {/* 2 กราฟย่อยใช้ h-64 เท่ากับการ์ดจริง */}
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="bg-bg rounded-lg p-2 border border-border h-64" />
                        ))}
                    </div>
                </div>
            </div>

            {/* กราฟ trend — body สูง h-64 เท่าการ์ดจริง */}
            <div className="bg-surface rounded-xl border border-border p-4 shadow-xs">
                <div className="text-sm font-semibold">
                    <Bar w="w-1/3" />
                </div>
                <div className="h-64 w-full mt-1 rounded bg-surface-subtle/40" />
            </div>
        </div>
    );
}

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl md:max-w-7xl mx-auto px-4 space-y-3 pt-6">
                {/* Header / Filter / Date mocks (แยก animate-pulse ต่างหาก กันซ้อนกับ pulse ของ DashboardContentSkeleton) */}
                <div className="space-y-3 animate-pulse">
                    <div className="bg-card-general rounded-2xl p-5 border border-border flex flex-col items-start gap-3 h-32">
                        <div className="h-6 bg-surface-subtle rounded w-1/3" />
                        <div className="h-4 bg-surface-subtle rounded w-2/3" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 h-10 bg-card-general border border-border rounded-xl px-3 flex items-center gap-1.5">
                            <LucideSearch size={13} className="text-text-muted opacity-40" />
                        </div>
                    </div>
                    <div className="h-10 bg-card-general border border-border rounded-xl" />
                </div>

                {/* ส่วนข้อมูล (ใช้ component เดียวกับตอน dashboard โหลดข้อมูล) */}
                <DashboardContentSkeleton />
            </div>
        </div>
    );
}
