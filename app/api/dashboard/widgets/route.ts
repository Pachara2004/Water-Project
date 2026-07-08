import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const viewMode = searchParams.get("viewMode") || "ALL";
        const collectorIdStr = searchParams.get("collectorId");
        const collectorId = collectorIdStr ? Number(collectorIdStr) : null;

        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const agencyParam = searchParams.get("agency");

        // 1. ดึงรายชื่อหน่วยงานทั้งหมดที่มีอยู่จริงในตาราง Location อิงจาก Database จริง
        const locationsForAgencies = await prisma.location.findMany({
            select: { governingAgency: true },
            distinct: ["governingAgency"],
        });

        const activeAgencies = locationsForAgencies.map((l) => l.governingAgency).filter((agency) => agency !== null && agency !== undefined);

        // 🔒 คุมสิทธิ์การดึงข้อมูลหลัก (Base Filter Context)
        const baseWhere: any = { isDeleted: false };
        if (viewMode === "MINE" && collectorId) {
            baseWhere.collectorId = collectorId;
        }
        if (startDateParam || endDateParam) {
            baseWhere.collectionTime = {};
            if (startDateParam) baseWhere.collectionTime.gte = new Date(startDateParam);
            if (endDateParam) baseWhere.collectionTime.lte = new Date(endDateParam);
        }
        if (agencyParam && agencyParam !== "all") {
            baseWhere.location = { governingAgency: agencyParam };
        }

        // --- ดึงข้อมูลพื้นฐานจาก DB (ให้ฐานข้อมูลคำนวณสรุปให้ ไม่โหลดทุกแถวเข้าหน่วยความจำ) ---
        const totalSamples = await prisma.waterSample.count({ where: baseWhere });

        // นับจำนวนตามสถานะแบบ aggregate ที่ DB แทนการ .filter() ทีละแถวในหน่วยความจำ
        const statusGroups = await prisma.waterSample.groupBy({
            by: ["status"],
            where: baseWhere,
            _count: { _all: true },
        });
        const statusCountMap: Record<string, number> = {};
        statusGroups.forEach((g) => {
            statusCountMap[g.status] = g._count._all;
        });

        // --- 📈 ช่วงก่อนหน้าขนาดเท่ากัน สำหรับคำนวณ Trend delta (ยืดหยุ่นตามความยาวของ filter ที่เลือก) ---
        let prevTotal = 0;
        let prevSafe = 0;
        let prevDanger = 0;
        let prevWarning = 0;
        let hasPrevPeriod = false;
        if (startDateParam && endDateParam) {
            const start = new Date(startDateParam);
            const end = new Date(endDateParam);
            const span = end.getTime() - start.getTime();
            if (span > 0) {
                hasPrevPeriod = true;
                const prevWhere: any = { ...baseWhere, collectionTime: { gte: new Date(start.getTime() - span), lt: start } };
                const prevStatusGroups = await prisma.waterSample.groupBy({
                    by: ["status"],
                    where: prevWhere,
                    _count: { _all: true },
                });
                prevStatusGroups.forEach((g) => {
                    prevTotal += g._count._all;
                    if (g.status === "safe") prevSafe = g._count._all;
                    if (g.status === "danger") prevDanger = g._count._all;
                    if (g.status === "warning") prevWarning = g._count._all;
                });
            }
        }

        // ค่าอัตราความปลอดภัย (Safety Rate %) + ตัวช่วยคำนวณ delta เทียบช่วงก่อนหน้า
        const safeRateValue = totalSamples > 0 ? Number((((statusCountMap["safe"] || 0) / totalSamples) * 100).toFixed(1)) : 0;
        const prevSafeRate = prevTotal > 0 ? (prevSafe / prevTotal) * 100 : 0;
        const relDelta = (cur: number, prev: number) => (prev > 0 ? Number((((cur - prev) / prev) * 100).toFixed(1)) : null);
        const trendForStatus = (w: { filterValue: string | null; title: string }): { value: number | null; kind: "pct" | "pp" } | null => {
            if (!hasPrevPeriod) return null;
            const isSafe = w.filterValue === "safe" || w.title.includes("ปลอดภัย");
            const isDanger = w.filterValue === "danger" || (w.title.includes("อันตราย") && !w.title.includes("เฝ้าระวัง")) || w.title.includes("วิกฤต");
            const isWarning = w.filterValue === "warning" || w.title.includes("เฝ้าระวัง");
            if (isSafe) return { value: prevTotal > 0 ? Number((safeRateValue - prevSafeRate).toFixed(1)) : null, kind: "pp" };
            if (isDanger) return { value: relDelta(statusCountMap["danger"] || 0, prevDanger), kind: "pct" };
            if (isWarning) return { value: relDelta(statusCountMap["warning"] || 0, prevWarning), kind: "pct" };
            return { value: relDelta(totalSamples, prevTotal), kind: "pct" };
        };

        // ค่าเฉลี่ยสิ่งแวดล้อมส่วนกลาง คำนวณครั้งเดียวที่ DB (คอลัมน์จริงบนตาราง samples เท่านั้น)
        const envAggregate = await prisma.waterSample.aggregate({
            where: baseWhere,
            _avg: { dissolvedOxygen: true, airTemperature: true, rainAccumulation: true },
        });
        const envAvgByField: Record<string, number | null> = {
            dissolvedOxygen: envAggregate._avg.dissolvedOxygen,
            airTemperature: envAggregate._avg.airTemperature,
            rainAccumulation: envAggregate._avg.rainAccumulation,
        };

        // ค่าเฉลี่ยสารเคมี: ให้ DB รวม avg/count ต่อ parameter ครั้งเดียว แล้วค่อยจับคู่ชื่อสารในหน่วยความจำ
        const allParameters = await prisma.parameter.findMany({ select: { id: true, name: true } });
        const measurementGroups = await prisma.waterSampleMeasurement.groupBy({
            by: ["parameterId"],
            where: { sample: baseWhere },
            _avg: { value: true },
            _count: { value: true },
        });
        const measurementByParamId = new Map(measurementGroups.map((g) => [g.parameterId, g]));

        // 🚀 ไฮไลต์: ดึงโครงสร้างพิมพ์เขียวทั้งหมดตรงจากตาราง `dashboard_widgets` ของบอส ไม่ Hardcode
        const dbWidgets = await prisma.dashboardWidget.findMany({
            orderBy: { id: "asc" },
        });

        // กรองเอาเฉพาะข้อมูลที่เป็นประเภท 'CARD' มาคำนวณหาค่าแบบ Dynamic ยิงตรงเข้าสู่หน้าบ้าน
        const kpisBlueprint = dbWidgets
            .filter((w) => w.widgetType === "CARD")
            .map((w) => {
                let finalValue: number = 0;
                let unit = "mg/L";
                let color = "#6366f1";
                let trend: { value: number | null; kind: "pct" | "pp" } | null = null;

                // จัดการจับคู่ประเภทข้อมูลตามที่บอสออกแบบไว้ในโครงสร้างตาราง
                if (w.targetType === "SAMPLE_STATUS") {
                    unit = "รายการ";
                    color = "#3b82f6";
                    trend = trendForStatus(w);
                    if (w.filterValue === "safe" || w.targetColumn === "safe" || w.title.includes("ปลอดภัย")) {
                        // การ์ดความปลอดภัยแสดงเป็น "อัตราส่วน %" ของตัวอย่างที่ผ่านเกณฑ์ SAFE แทนการนับจำนวนดิบ
                        finalValue = safeRateValue;
                        unit = "%";
                        color = "#10b981";
                    } else if (w.filterValue === "danger" || w.targetColumn === "danger" || w.title.includes("วิกฤต") || (w.title.includes("อันตราย") && !w.title.includes("เฝ้าระวัง"))) {
                        finalValue = statusCountMap["danger"] || 0;
                        color = "#ef4444";
                    } else if (w.filterValue === "warning" || w.targetColumn === "warning" || w.title.includes("เฝ้าระวัง")) {
                        finalValue = statusCountMap["warning"] || 0;
                        color = "#f59e0b"; // amber ตาม semantics SAFE/WARNING/DANGER
                    } else {
                        finalValue = totalSamples;
                    }
                } else if (w.targetType === "ENVIRONMENT") {
                    // ดึงค่าเฉลี่ยสถิติสิ่งแวดล้อมจากตารางหลัก water_samples ที่ DB คำนวณไว้แล้ว
                    const col = w.targetColumn || "";
                    const avg = envAvgByField[toCamelCase(col)];
                    finalValue = avg !== null && avg !== undefined ? Number(avg.toFixed(2)) : 0;
                    if (col === "ph_value" || w.title.includes("pH")) {
                        unit = "pH";
                        color = "#ec4899";
                    }
                    if (col === "suspended_solids" || w.title.includes("TSS")) {
                        unit = "mg/L";
                        color = "#14b8a6";
                    }
                    if (col === "dissolved_oxygen" || w.title.includes("DO")) {
                        unit = "mg/L";
                        color = "#10b981";
                    }
                } else if (w.targetType === "PARAMETER") {
                    // จับคู่ชื่อสารแบบยืดหยุ่นเหมือนเดิม แล้วรวมค่าเฉลี่ยถ่วงน้ำหนักตามจำนวน (pooled average)
                    const paramName = (w.targetColumn || "").toLowerCase();
                    let sum = 0,
                        count = 0;

                    allParameters.forEach((p) => {
                        const pName = p.name.toLowerCase();
                        if (pName.includes(paramName) || paramName.includes(pName)) {
                            const g = measurementByParamId.get(p.id);
                            if (g && g._count.value > 0 && g._avg.value !== null) {
                                sum += g._avg.value * g._count.value;
                                count += g._count.value;
                            }
                        }
                    });

                    finalValue = count > 0 ? Number((sum / count).toFixed(2)) : 0;
                    if (w.title.includes("NH3") || w.title.includes("แอมโมเนีย")) color = "#f59e0b";
                    if (w.title.includes("PO4") || w.title.includes("ฟอสเฟต")) color = "#818cf8";
                }

                return {
                    title: w.title,
                    value: finalValue,
                    unit: unit,
                    color: color,
                    trend: trend, // การเปลี่ยนแปลงเทียบช่วงก่อนหน้า (null = ไม่มีข้อมูลช่วงก่อน/ไม่ใช่การ์ดสถานะ)
                };
            });

        // --- 🏅 2. โครงสร้าง Danger Hotspots ---
        const topDangerLocations = await prisma.waterSample.groupBy({
            by: ["locationId"],
            where: { ...baseWhere, status: "danger" },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 4,
        });

        const hotspotsData = [];
        for (const loc of topDangerLocations) {
            const station = await prisma.location.findUnique({ where: { id: loc.locationId } });
            const totalLocSamples = await prisma.waterSample.count({ where: { ...baseWhere, locationId: loc.locationId } });
            const failureRate = totalLocSamples > 0 ? Math.round((loc._count.id / totalLocSamples) * 100) : 0;

            hotspotsData.push({
                stationName: station?.stationName || `สถานีรหัส ${loc.locationId}`,
                agency: station?.governingAgency || "ไม่ระบุหน่วยงาน",
                failureRate,
                dangerCount: loc._count.id,
                totalCount: totalLocSamples,
                statusText: failureRate >= 80 ? "วิกฤต" : failureRate >= 50 ? "เสี่ยงสูง" : "เฝ้าระวัง",
            });
        }

        // --- 🌅 3. โครงสร้างระบบประมวลผลช่วงเวลา เช้า vs เย็น (Temporal Data Engine) ---
        // ดึงเฉพาะฟิลด์ที่กราฟรายเดือนต้องใช้จริง (เวลาเก็บ + ค่าสารแอมโมเนีย/ฟอสเฟตเท่านั้น) แทนการโหลดทุกคอลัมน์
        const timeSeriesSamples = await prisma.waterSample.findMany({
            where: baseWhere,
            select: {
                collectionTime: true,
                rainAccumulation: true, // ใช้ต่อในส่วน Correlation (สภาพอากาศ × ความเข้มข้นสาร)
                airTemperature: true,
                status: true, // ใช้คัดจุดผิดปกติ (DANGER) มาวางทับ heatmap
                measurements: {
                    where: { parameter: { name: { in: ["ammonia", "phosphate"] } } },
                    select: { value: true, parameter: { select: { name: true } } },
                },
            },
        });

        const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."];
        const temporalMonthlyMap: { [key: string]: { ammM: number; ammE: number; phosM: number; phosE: number; countM: number; countE: number } } = {};
        monthNames.forEach((m) => {
            temporalMonthlyMap[m] = { ammM: 0, ammE: 0, phosM: 0, phosE: 0, countM: 0, countE: 0 };
        });

        timeSeriesSamples.forEach((s) => {
            const dateObj = new Date(s.collectionTime);
            const mName = monthNames[dateObj.getMonth()];
            const hour = dateObj.getHours();
            if (!temporalMonthlyMap[mName]) return;

            const amm = s.measurements.find((m) => m.parameter.name.toLowerCase() === "ammonia")?.value || 0;
            const phos = s.measurements.find((m) => m.parameter.name.toLowerCase() === "phosphate")?.value || 0;

            if (hour >= 6 && hour < 12) {
                temporalMonthlyMap[mName].ammM += amm;
                temporalMonthlyMap[mName].phosM += phos;
                temporalMonthlyMap[mName].countM++;
            } else if (hour >= 15 && hour < 21) {
                temporalMonthlyMap[mName].ammE += amm;
                temporalMonthlyMap[mName].phosE += phos;
                temporalMonthlyMap[mName].countE++;
            }
        });

        const temporalData = Object.keys(temporalMonthlyMap).map((month) => {
            const item = temporalMonthlyMap[month];
            const divM = item.countM > 0 ? item.countM : 1;
            const divE = item.countE > 0 ? item.countE : 1;
            return {
                name: month,
                ammoniaMorning: Number((item.ammM / divM).toFixed(2)),
                ammoniaEvening: Number((item.ammE / divE).toFixed(2)),
                phosphateMorning: Number((item.phosM / divM).toFixed(2)),
                phosphateEvening: Number((item.phosE / divE).toFixed(2)),
            };
        });

        // --- [มิติที่ 4: WaterTrendChart] ---
        const monthlyTrendsMap: { [key: string]: { ammonia: number; phosphate: number; count: number } } = {};
        monthNames.forEach((m) => {
            monthlyTrendsMap[m] = { ammonia: 0, phosphate: 0, count: 0 };
        });

        timeSeriesSamples.forEach((s) => {
            const mName = monthNames[new Date(s.collectionTime).getMonth()];
            const amm = s.measurements.find((m) => m.parameter.name.toLowerCase() === "ammonia")?.value || 0;
            const phos = s.measurements.find((m) => m.parameter.name.toLowerCase() === "phosphate")?.value || 0;

            if (monthlyTrendsMap[mName]) {
                monthlyTrendsMap[mName].ammonia += amm;
                monthlyTrendsMap[mName].phosphate += phos;
                monthlyTrendsMap[mName].count++;
            }
        });

        const trendsData = Object.keys(monthlyTrendsMap).map((m) => {
            const dataItem = monthlyTrendsMap[m];
            const div = dataItem.count > 0 ? dataItem.count : 1;
            return {
                date: m,
                ammonia: Number((dataItem.ammonia / div).toFixed(2)),
                phosphate: Number((dataItem.phosphate / div).toFixed(2)),
            };
        });

        // --- 🌦️ [มิติที่ 5: Correlation] สหสัมพันธ์สภาพอากาศ (ฝน/อุณหภูมิอากาศ) กับความเข้มข้นสารเคมี ---
        // เก็บคู่จุดของแต่ละชุด (แกน × สาร) เพื่อคำนวณ Pearson r และแบ่ง density bin ฝั่ง server
        const rainNH3: { x: number; y: number }[] = [];
        const rainPO4: { x: number; y: number }[] = [];
        const tempNH3: { x: number; y: number }[] = [];
        const tempPO4: { x: number; y: number }[] = [];
        // จุดผิดปกติ (DANGER) สำหรับวางทับ heatmap
        const outliers: { rain: number | null; temp: number | null; ammonia: number | null; phosphate: number | null }[] = [];

        timeSeriesSamples.forEach((s) => {
            const amm = s.measurements.find((m) => m.parameter.name.toLowerCase() === "ammonia")?.value ?? null;
            const phos = s.measurements.find((m) => m.parameter.name.toLowerCase() === "phosphate")?.value ?? null;
            const rain = s.rainAccumulation;
            const temp = s.airTemperature;

            if (rain !== null && rain !== undefined && amm !== null) rainNH3.push({ x: rain, y: amm });
            if (rain !== null && rain !== undefined && phos !== null) rainPO4.push({ x: rain, y: phos });
            if (temp !== null && temp !== undefined && amm !== null) tempNH3.push({ x: temp, y: amm });
            if (temp !== null && temp !== undefined && phos !== null) tempPO4.push({ x: temp, y: phos });

            if (s.status === "danger" && (amm !== null || phos !== null)) {
                outliers.push({ rain: rain ?? null, temp: temp ?? null, ammonia: amm, phosphate: phos });
            }
        });

        // จำกัดจำนวน outlier ที่ส่งไปวาด (สุ่มเป็นระบบ) กัน overlay รกและ payload บวม
        let outliersSampled = outliers;
        if (outliers.length > 120) {
            const step = Math.ceil(outliers.length / 120);
            outliersSampled = outliers.filter((_, i) => i % step === 0);
        }

        const pearsonPairs = (pts: { x: number; y: number }[]): [number, number][] => pts.map((p) => [p.x, p.y]);
        // เส้น trend คำนวณจากคู่ข้อมูลชุดเดียวกับ Pearson r เสมอ (ความชัน/จุดตัดแกน y)
        const correlationMetrics = [
            { key: "rain_nh3", label: "ฝน × NH₃", r: pearson(pearsonPairs(rainNH3)), n: rainNH3.length, trend: linearFit(pearsonPairs(rainNH3)) },
            { key: "rain_po4", label: "ฝน × PO₄", r: pearson(pearsonPairs(rainPO4)), n: rainPO4.length, trend: linearFit(pearsonPairs(rainPO4)) },
            { key: "temp_nh3", label: "อุณหภูมิ × NH₃", r: pearson(pearsonPairs(tempNH3)), n: tempNH3.length, trend: linearFit(pearsonPairs(tempNH3)) },
            { key: "temp_po4", label: "อุณหภูมิ × PO₄", r: pearson(pearsonPairs(tempPO4)), n: tempPO4.length, trend: linearFit(pearsonPairs(tempPO4)) },
        ];

        // แบ่ง density bin ทั้ง 4 ชุด (แกน × สาร) — ส่งเฉพาะช่องที่มีค่า payload เล็กแม้ข้อมูลหลักพัน
        const correlationHeatmaps = {
            rain_nh3: densityBins(rainNH3),
            rain_po4: densityBins(rainPO4),
            temp_nh3: densityBins(tempNH3),
            temp_po4: densityBins(tempPO4),
        };

        return NextResponse.json({
            agencies: activeAgencies,
            kpis: kpisBlueprint, // การ์ดสรุปส่งไปตามแถวจริงในตารางฐานข้อมูลของบอสแบบ 100%
            hotspotConfig: { title: "Danger Hotspots — 4 อันดับสถานีจุดเสี่ยงอันตรายสะสมสูงสุด" },
            hotspots: hotspotsData,
            temporalConfig: {
                title: "Morning vs Evening Fluctuations (เปรียบเทียบระดับสารเคมีคู่ขนาน)",
                bars: [
                    { key: "ammoniaMorning", name: "NH3 เช้า", color: "#60a5fa" },
                    { key: "ammoniaEvening", name: "NH3 เย็น", color: "#fbbf24" },
                    { key: "phosphateMorning", name: "PO4 เช้า", color: "#818cf8" },
                    { key: "phosphateEvening", name: "PO4 เย็น", color: "#c084fc" },
                ],
            },
            temporalData: temporalData,
            trendConfig: {
                title: "WaterTrendChart: สหสัมพันธ์แนวโน้มความเข้มข้นสารเคมีสะสมพร้อมเกณฑ์ควบคุม PCD",
                references: [
                    { value: 0.5, color: "#ef4444", label: "Max NH3 (0.5)" },
                    { value: 0.3, color: "#a855f7", label: "Max PO4 (0.3)" },
                ],
                lines: [
                    { key: "ammonia", name: "Ammonia", color: "#f59e0b" },
                    { key: "phosphate", name: "Phosphate", color: "#6366f1" },
                ],
            },
            trends: trendsData,
            correlation: {
                title: "Correlation: สหสัมพันธ์สภาพอากาศกับความเข้มข้นสารเคมี (Pearson r)",
                note: "อุณหภูมิ = อุณหภูมิอากาศ (ไม่มีอุณหภูมิน้ำใน schema) · จุดแดง = ตัวอย่างสถานะ DANGER",
                metrics: correlationMetrics,
                heatmaps: correlationHeatmaps,
                outliers: outliersSampled,
            },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

// ฟังก์ชันช่วยแปลงงูเลื้อย (snake_case) เป็นอูฐ (camelCase) ป้องกันบั๊กฟิลด์โมเดล Prisma
function toCamelCase(str: string) {
    return str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace("-", "").replace("_", ""));
}

// ค่าสหสัมพันธ์ Pearson (r) จากคู่ข้อมูล [x, y] — คืน null หากจุดน้อยกว่า 2 หรือไม่มีความแปรปรวน
function pearson(pairs: [number, number][]): number | null {
    const n = pairs.length;
    if (n < 2) return null;
    let sx = 0,
        sy = 0,
        sxx = 0,
        syy = 0,
        sxy = 0;
    for (const [x, y] of pairs) {
        sx += x;
        sy += y;
        sxx += x * x;
        syy += y * y;
        sxy += x * y;
    }
    const cov = n * sxy - sx * sy;
    const varX = n * sxx - sx * sx;
    const varY = n * syy - sy * sy;
    if (varX <= 0 || varY <= 0) return null;
    return Number((cov / Math.sqrt(varX * varY)).toFixed(2));
}

// เส้น trend (least-squares) จากคู่ข้อมูลเดียวกับ Pearson — คืน slope/intercept หรือ null หากคำนวณไม่ได้
function linearFit(pairs: [number, number][]): { slope: number; intercept: number } | null {
    const n = pairs.length;
    if (n < 2) return null;
    let sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
    for (const [x, y] of pairs) {
        sx += x;
        sy += y;
        sxx += x * x;
        sxy += x * y;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    return { slope: Number(slope.toFixed(4)), intercept: Number(intercept.toFixed(4)) };
}

// แบ่งจุดเป็นตารางความหนาแน่น (density bin) — คืนเฉพาะช่องที่มีจุด พร้อมขอบเขตและขนาดช่อง
// ต้นทุน O(N) รอบเดียว และเอาต์พุตคงที่ (≤ cols×rows ช่อง) ไม่ว่าจะมีจุดกี่พัน
function densityBins(pts: { x: number; y: number }[], cols = 18, rows = 12) {
    if (pts.length === 0) return { bins: [] as any[], domain: null, binW: 0, binH: 0, cols, rows };
    let xMin = Infinity,
        xMax = -Infinity,
        yMin = Infinity,
        yMax = -Infinity;
    for (const p of pts) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
    }
    const binW = (xMax - xMin) / cols || 1;
    const binH = (yMax - yMin) / rows || 1;
    const grid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (const p of pts) {
        const c = Math.min(cols - 1, Math.max(0, Math.floor((p.x - xMin) / binW)));
        const r = Math.min(rows - 1, Math.max(0, Math.floor((p.y - yMin) / binH)));
        grid[r][c]++;
    }
    let maxCount = 0;
    for (const row of grid) for (const v of row) if (v > maxCount) maxCount = v;
    const bins: { x: number; y: number; count: number; intensity: number }[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!grid[r][c]) continue;
            bins.push({
                x: Number((xMin + (c + 0.5) * binW).toFixed(3)),
                y: Number((yMin + (r + 0.5) * binH).toFixed(4)),
                count: grid[r][c],
                intensity: Number((grid[r][c] / maxCount).toFixed(3)),
            });
        }
    }
    return { bins, domain: { xMin, xMax, yMin, yMax }, binW, binH, cols, rows };
}
