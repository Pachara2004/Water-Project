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

                // จัดการจับคู่ประเภทข้อมูลตามที่บอสออกแบบไว้ในโครงสร้างตาราง
                if (w.targetType === "SAMPLE_STATUS") {
                    unit = "รายการ";
                    color = "#3b82f6";
                    if (w.targetColumn === "safe" || w.title.includes("ปลอดภัย")) {
                        finalValue = statusCountMap["safe"] || 0;
                        color = "#10b981";
                    } else if (w.targetColumn === "danger" || w.title.includes("อันตราย") || w.title.includes("วิกฤต")) {
                        finalValue = statusCountMap["danger"] || 0;
                        color = "#ef4444";
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
