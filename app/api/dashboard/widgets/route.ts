import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { getPendingSessionGroups } from "@/lib/review";
import { STATUS_COLOR, parameterColor } from "@/lib/chartColors";
import { buildSampleWhere, parseLocalDayStart, parseLocalDayEnd, readSampleFilters, toThaiWallClock, fromThaiWallClock, getThaiHour } from "@/lib/sampleFilters";

export async function GET(request: NextRequest) {
    try {
        // SECURITY GUARD: บังคับต้องมี Token ที่ตรวจสอบผ่าน LINE จริง ก่อนอ่านสถิติใด ๆ
        const auth = await verifyAuth(request, ["admin", "officer", "collector"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        // filter ทั้งชุดอ่านผ่านตัวกลางเดียวกับที่ /api/samples/export ใช้ (บังคับขอบเขตสิทธิ์ที่ server ให้แล้ว)
        const filters = readSampleFilters(request, auth.user!);
        const { startDate: startDateParam, endDate: endDateParam, locationId } = filters;

        // 1. ดึงรายชื่อหน่วยงาน + สถานีทั้งหมดที่มีอยู่จริงในตาราง Location ให้ frontend เอาไปใช้ค้นหา
        const allLocations = await prisma.location.findMany({
            select: { id: true, stationName: true, governingAgency: true },
            orderBy: { stationName: "asc" },
        });

        const activeAgencies = Array.from(new Set(allLocations.map((l) => l.governingAgency).filter((agency) => agency !== null && agency !== undefined)));

        // สถิติ/dashboard ต้องคิดจากข้อมูลที่ยืนยันแล้วเท่านั้น ซ่อน session ที่ยังรออนุมัติ (ไม่ว่า viewMode ไหน)
        const pendingGroups = await getPendingSessionGroups();

        // คุมสิทธิ์การดึงข้อมูลหลัก (Base Filter Context) — ประกอบจากตัวกลางเดียวกับการส่งออก
        // ส่ง pendingGroups ที่ query มาแล้วเข้าไปใช้ซ้ำ ไม่ต้องยิงถามซ้ำในแต่ละ where
        const baseWhere = await buildSampleWhere(filters, { pendingGroups });

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
            // status = null คือ "ประเมินไม่ได้" ไม่เข้าช่อง safe/warning/danger ช่องไหนเลย
            // แต่ยังถูกนับใน totalSamples อยู่ อัตราความปลอดภัยจึงไม่พองขึ้นจากตัวอย่างที่ไม่เคยถูกประเมิน
            if (!g.status) return;
            statusCountMap[g.status] = g._count._all;
        });

        // ค่าอัตราความปลอดภัย (Safety Rate %) ของช่วงที่เลือกบน filter — ใช้แสดงตัวเลขหลักบนการ์ดเหมือนเดิม
        const safeRateValue = totalSamples > 0 ? Number((((statusCountMap["safe"] || 0) / totalSamples) * 100).toFixed(1)) : 0;

        // ---  WoW / MoM ตามปฏิทินจริง — ยึด "วันนี้" เสมอ ไม่อิงช่วงวันที่ที่เลือกบน filter ---
        // ขอบเขตสิทธิ์/หน่วยงานยังคงกรองตามเดิม แต่ตัดเงื่อนไขวันที่ของ filter ออก
        const scopeWhere = await buildSampleWhere(filters, { withDateRange: false, pendingGroups });

        const now = new Date();

        const countByStatus = async (where: any) => {
            const groups = await prisma.waterSample.groupBy({ by: ["status"], where, _count: { _all: true } });
            const map: Record<string, number> = { safe: 0, warning: 0, danger: 0 };
            let total = 0;
            groups.forEach((g) => {
                total += g._count._all;
                // ประเมินไม่ได้ → นับรวมใน total แต่ไม่เข้าช่องสถานะใด
                if (!g.status) return;
                map[g.status] = g._count._all;
            });
            return { total, safe: map.safe, warning: map.warning, danger: map.danger };
        };

        type StatusCounts = { total: number; safe: number; warning: number; danger: number };
        // cur = ค่าปัจจุบันดิบ (ไม่ใช่ % เปลี่ยนแปลง) ไว้ใช้โชว์ตอนฐานก่อนหน้า = 0 ซึ่งคำนวณ % ไม่ได้ (หารด้วยศูนย์)
        type TrendPair = { value: number | null; kind: "pct" | "pp"; cur: number };
        const buildTrendMetrics = (curr: StatusCounts, prev: StatusCounts): Record<"total" | "safe" | "danger" | "warning", TrendPair> => {
            const relDelta = (cur: number, pv: number): number | null => (pv > 0 ? Number((((cur - pv) / pv) * 100).toFixed(1)) : null);
            const currSafeRate = curr.total > 0 ? (curr.safe / curr.total) * 100 : 0;
            const prevSafeRate = prev.total > 0 ? (prev.safe / prev.total) * 100 : 0;
            return {
                total: { value: relDelta(curr.total, prev.total), kind: "pct", cur: curr.total },
                safe: { value: prev.total > 0 ? Number((currSafeRate - prevSafeRate).toFixed(1)) : null, kind: "pp", cur: Number(currSafeRate.toFixed(1)) },
                danger: { value: relDelta(curr.danger, prev.danger), kind: "pct", cur: curr.danger },
                warning: { value: relDelta(curr.warning, prev.warning), kind: "pct", cur: curr.warning },
            };
        };

        // สัปดาห์ปฏิทินแบบ ISO (จันทร์–อาทิตย์) เทียบ "สัปดาห์นี้จนถึงตอนนี้" กับ "ช่วงเดียวกันของสัปดาห์ก่อน"
        // คำนวณขอบเขตบนเวลาไทย (wall-clock) เสมอ แล้วแปลงกลับเป็น instant จริงก่อนใช้เป็นขอบเขต query
        // ไม่งั้นขอบสัปดาห์/เดือนจะไปตกเช้ามืดเวลาไทยตาม TZ ของ server (ดูคอมเมนต์ที่ toThaiWallClock ใน sampleFilters.ts)
        const nowThai = toThaiWallClock(now);
        const wowCurrentStartThai = startOfISOWeek(nowThai);
        const wowPreviousStartThai = new Date(wowCurrentStartThai);
        wowPreviousStartThai.setUTCDate(wowPreviousStartThai.getUTCDate() - 7);
        const wowPreviousEndThai = new Date(nowThai);
        wowPreviousEndThai.setUTCDate(wowPreviousEndThai.getUTCDate() - 7);
        const wowCurrentStart = fromThaiWallClock(wowCurrentStartThai);
        const wowPreviousStart = fromThaiWallClock(wowPreviousStartThai);
        const wowPreviousEnd = fromThaiWallClock(wowPreviousEndThai);

        // เดือนปฏิทิน เทียบ "เดือนนี้จนถึงตอนนี้ (month-to-date)" กับ "ช่วงเดียวกันของเดือนก่อน"
        const momCurrentStartThai = startOfCalendarMonth(nowThai);
        const momPreviousStartThai = subtractMonthClamped(momCurrentStartThai, 1);
        const momPreviousEndThai = subtractMonthClamped(nowThai, 1);
        const momCurrentStart = fromThaiWallClock(momCurrentStartThai);
        const momPreviousStart = fromThaiWallClock(momPreviousStartThai);
        const momPreviousEnd = fromThaiWallClock(momPreviousEndThai);

        const [wowCurrent, wowPrevious, momCurrent, momPrevious] = await Promise.all([
            countByStatus({ ...scopeWhere, collectionTime: { gte: wowCurrentStart, lte: now } }),
            countByStatus({ ...scopeWhere, collectionTime: { gte: wowPreviousStart, lte: wowPreviousEnd } }),
            countByStatus({ ...scopeWhere, collectionTime: { gte: momCurrentStart, lte: now } }),
            countByStatus({ ...scopeWhere, collectionTime: { gte: momPreviousStart, lte: momPreviousEnd } }),
        ]);

        const wowMetrics = buildTrendMetrics(wowCurrent, wowPrevious);
        const momMetrics = buildTrendMetrics(momCurrent, momPrevious);

        const trendForStatus = (w: { filterValue: string | null; title: string }): { wow: TrendPair; mom: TrendPair } => {
            const isSafe = w.filterValue === "safe" || w.title.includes("ปลอดภัย");
            const isDanger = w.filterValue === "danger" || (w.title.includes("อันตราย") && !w.title.includes("เฝ้าระวัง")) || w.title.includes("วิกฤต");
            const isWarning = w.filterValue === "warning" || w.title.includes("เฝ้าระวัง");
            const key = isSafe ? "safe" : isDanger ? "danger" : isWarning ? "warning" : "total";
            return { wow: wowMetrics[key], mom: momMetrics[key] };
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

        // เส้นเกณฑ์ควบคุม PCD บน WaterTrendChart — อิงจากตาราง standards จริง ไม่ hardcode
        // สารหนึ่งตัวมีเกณฑ์ได้หลายค่า (ต่อประเภทการใช้ประโยชน์) เอาค่าน้อยสุด (เข้มงวดสุด) มาเป็นเส้นอ้างอิง
        // เพราะกราฟนี้ไม่ได้ผูกกับประเภทการใช้ประโยชน์ใดประเภทเดียว
        const ammoniaParam = allParameters.find((p) => p.name.toLowerCase() === "ammonia");
        const phosphateParam = allParameters.find((p) => p.name.toLowerCase() === "phosphate");
        const trendParamIds = [ammoniaParam?.id, phosphateParam?.id].filter((id): id is number => id !== undefined);
        const trendStandards = trendParamIds.length > 0 ? await prisma.standard.findMany({ where: { parameterId: { in: trendParamIds } }, select: { parameterId: true, maxValue: true } }) : [];
        const minStandardFor = (parameterId: number | undefined): number | null =>
            parameterId === undefined
                ? null
                : trendStandards.filter((s) => s.parameterId === parameterId).reduce<number | null>((min, s) => (min === null || s.maxValue < min ? s.maxValue : min), null);
        const ammoniaMax = minStandardFor(ammoniaParam?.id);
        const phosphateMax = minStandardFor(phosphateParam?.id);
        const measurementGroups = await prisma.waterSampleMeasurement.groupBy({
            by: ["parameterId"],
            where: { sample: baseWhere },
            _avg: { value: true },
            _count: { value: true },
        });
        const measurementByParamId = new Map(measurementGroups.map((g) => [g.parameterId, g]));

        // ไฮไลต์: ดึงโครงสร้างพิมพ์เขียวทั้งหมดตรงจากตาราง `dashboard_widgets` ของบอส ไม่ Hardcode
        const dbWidgets = await prisma.dashboardWidget.findMany({
            where: { isActive: true },
            orderBy: { id: "asc" },
        });

        // กรองเอาเฉพาะข้อมูลที่เป็นประเภท 'CARD' มาคำนวณหาค่าแบบ Dynamic ยิงตรงเข้าสู่หน้าบ้าน
        const kpisBlueprint = dbWidgets
            .filter((w) => w.widgetType === "CARD")
            .map((w) => {
                let finalValue: number = 0;
                let unit = "mg/L";
                let color = "#6366f1";
                let trend: { wow: TrendPair; mom: TrendPair } | null = null;

                // จัดการจับคู่ประเภทข้อมูลตามที่ออกแบบไว้ในโครงสร้างตาราง
                if (w.targetType === "SAMPLE_STATUS") {
                    unit = "รายการ";
                    color = "#3b82f6";
                    trend = trendForStatus(w);
                    if (w.filterValue === "safe" || w.targetColumn === "safe" || w.title.includes("ปลอดภัย")) {
                        // การ์ดความปลอดภัยแสดงเป็น "อัตราส่วน %" ของตัวอย่างที่ผ่านเกณฑ์ SAFE แทนการนับจำนวนดิบ
                        finalValue = safeRateValue;
                        unit = "%";
                        color = STATUS_COLOR.safe;
                    } else if (w.filterValue === "danger" || w.targetColumn === "danger" || w.title.includes("วิกฤต") || (w.title.includes("อันตราย") && !w.title.includes("เฝ้าระวัง"))) {
                        finalValue = statusCountMap["danger"] || 0;
                        color = STATUS_COLOR.danger;
                    } else if (w.filterValue === "warning" || w.targetColumn === "warning" || w.title.includes("เฝ้าระวัง")) {
                        finalValue = statusCountMap["warning"] || 0;
                        color = STATUS_COLOR.warning;
                    } else {
                        finalValue = totalSamples;
                    }
                } else if (w.targetType === "ENVIRONMENT") {
                    // ดึงค่าเฉลี่ยสถิติสิ่งแวดล้อมจากตารางหลัก water_samples ที่ DB คำนวณไว้แล้ว
                    // หมายเหตุ: pH/TSS ไม่ใช่คอลัมน์บน water_samples (เป็น Parameter แยกในตาราง parameters)
                    // จึงต้องตั้ง targetType="PARAMETER" ให้การ์ดพวกนั้น ไม่ใช่ ENVIRONMENT — ที่นี่จึงรองรับเฉพาะคอลัมน์จริงที่มีอยู่ใน envAvgByField
                    const col = w.targetColumn || "";
                    const avg = envAvgByField[toCamelCase(col)];
                    finalValue = avg !== null && avg !== undefined ? Number(avg.toFixed(2)) : 0;
                    if (col === "dissolved_oxygen" || w.title.includes("DO")) {
                        unit = "mg/L";
                        color = "#10b981";
                    }
                    if (col === "air_temperature" || w.title.includes("อุณหภูมิ")) {
                        unit = "°C";
                        color = "#f97316";
                    }
                    if (col === "rain_accumulation" || w.title.includes("ฝน")) {
                        unit = "mm";
                        color = "#0ea5e9";
                    }
                } else if (w.targetType === "PARAMETER") {
                    // จับคู่ชื่อสารแบบยืดหยุ่นเหมือนเดิม แล้วรวมค่าเฉลี่ยถ่วงน้ำหนักตามจำนวน (pooled average)
                    const paramName = (w.targetColumn || "").toLowerCase();
                    let sum = 0,
                        count = 0;

                    let matchedParamName: string | null = null;

                    allParameters.forEach((p) => {
                        const pName = p.name.toLowerCase();
                        if (pName.includes(paramName) || paramName.includes(pName)) {
                            matchedParamName = p.name;
                            const g = measurementByParamId.get(p.id);
                            if (g && g._count.value > 0 && g._avg.value !== null) {
                                sum += g._avg.value * g._count.value;
                                count += g._count.value;
                            }
                        }
                    });

                    // ปัด 4 ตำแหน่งเหมือนกราฟ temporal/trend ด้านล่าง — phosphate ค่าปกติ ~0.001-0.02 มก./ล.
                    // ปัดแค่ 2 ตำแหน่งจะกลายเป็น 0.00 เกือบทุกครั้ง (ดูคอมเมนต์ที่ temporalData/trendsData)
                    finalValue = count > 0 ? Number((sum / count).toFixed(4)) : 0;
                    // สีประจำสารมาจาก lib/chartColors.ts ที่เดียว กันสีไม่ตรงกันข้ามกราฟ
                    // เลือกจาก parameterId ของ widget ก่อน แล้วตกไปใช้สารที่จับคู่ได้จาก targetColumn
                    // เดิมอ่านจากชื่อการ์ด (w.title.includes("NH3")) ซึ่งพังทันทีที่แอดมินเปลี่ยนชื่อการ์ด
                    const colorParamName = (w.parameterId ? allParameters.find((p) => p.id === w.parameterId)?.name : null) ?? matchedParamName;
                    if (colorParamName) color = parameterColor(colorParamName);
                }

                return {
                    title: w.title,
                    value: finalValue,
                    unit: unit,
                    color: color,
                    trend: trend, // การเปลี่ยนแปลงเทียบช่วงก่อนหน้า (null = ไม่มีข้อมูลช่วงก่อน/ไม่ใช่การ์ดสถานะ)
                    w: w.width, // ความกว้างกริด (1-12 ช่อง) ตามที่ตั้งค่าไว้ใน dashboard_widgets
                };
            });

        // ---  2. โครงสร้าง Danger Hotspots ---
        const topDangerLocations = await prisma.waterSample.groupBy({
            by: ["locationId"],
            where: { ...baseWhere, status: "danger" },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
        });

        // แก้ N+1: เดิมวน findUnique + count ทีละสถานี (~2 query × 5 = 10 query) รวมเป็น batch query 2 ครั้งแทน
        const hotspotLocationIds = topDangerLocations.map((loc) => loc.locationId);
        const [hotspotStations, hotspotTotalGroups] = await Promise.all([
            prisma.location.findMany({ where: { id: { in: hotspotLocationIds } }, select: { id: true, stationName: true, governingAgency: true } }),
            prisma.waterSample.groupBy({ by: ["locationId"], where: { ...baseWhere, locationId: { in: hotspotLocationIds } }, _count: { id: true } }),
        ]);
        const stationById = new Map(hotspotStations.map((s) => [s.id, s]));
        const totalByLocationId = new Map(hotspotTotalGroups.map((g) => [g.locationId, g._count.id]));

        const hotspotsData = topDangerLocations.map((loc) => {
            const station = stationById.get(loc.locationId);
            const totalLocSamples = totalByLocationId.get(loc.locationId) || 0;
            const failureRate = totalLocSamples > 0 ? Math.round((loc._count.id / totalLocSamples) * 100) : 0;

            return {
                stationName: station?.stationName || `สถานีรหัส ${loc.locationId}`,
                agency: station?.governingAgency || "ไม่ระบุหน่วยงาน",
                failureRate,
                dangerCount: loc._count.id,
                totalCount: totalLocSamples,
                statusText: failureRate >= 80 ? "วิกฤต" : failureRate >= 50 ? "เสี่ยงสูง" : "เฝ้าระวัง",
            };
        });

        // ---  เมื่อกรองเจาะจงสถานีเดียว (จาก search) แทนที่จะโชว์ "5 อันดับ" (ไม่มีความหมายกับตัวเลือกเดียว)
        // ส่งรายละเอียดความเสี่ยงของสถานีนั้นแทน โดยใช้ totalSamples/statusCountMap ที่คำนวณจาก baseWhere ซึ่งกรอง locationId ไว้แล้ว
        let stationDetail: {
            stationName: string;
            agency: string;
            totalCount: number;
            safeCount: number;
            warningCount: number;
            dangerCount: number;
            failureRate: number;
            statusText: string;
        } | null = null;
        if (locationId) {
            const stationInfo = await prisma.location.findUnique({ where: { id: locationId }, select: { stationName: true, governingAgency: true } });
            if (stationInfo) {
                const dangerCount = statusCountMap["danger"] || 0;
                const warningCount = statusCountMap["warning"] || 0;
                const safeCount = statusCountMap["safe"] || 0;
                const failureRate = totalSamples > 0 ? Math.round((dangerCount / totalSamples) * 100) : 0;
                stationDetail = {
                    stationName: stationInfo.stationName,
                    agency: stationInfo.governingAgency || "ไม่ระบุหน่วยงาน",
                    totalCount: totalSamples,
                    safeCount,
                    warningCount,
                    dangerCount,
                    failureRate,
                    statusText: failureRate >= 80 ? "วิกฤต" : failureRate >= 50 ? "เสี่ยงสูง" : failureRate > 0 ? "เฝ้าระวัง" : "ปลอดภัย",
                };
            }
        }

        // ---  3. โครงสร้างระบบประมวลผลช่วงเวลา ก่อนเที่ยง vs หลังเที่ยง (Temporal Data Engine) ---
        // ดึงเฉพาะฟิลด์ที่กราฟรายเดือนต้องใช้จริง (เวลาเก็บ + ค่าสารแอมโมเนีย/ฟอสเฟตเท่านั้น) แทนการโหลดทุกคอลัมน์
        const timeSeriesSamples = await prisma.waterSample.findMany({
            where: baseWhere,
            select: {
                collectionTime: true,
                rainAccumulation: true, // ใช้ต่อในส่วน Correlation (สภาพอากาศ × ความเข้มข้นสาร)
                airTemperature: true,
                measurements: {
                    where: { parameter: { name: { in: ["ammonia", "phosphate"] } } },
                    select: { value: true, parameter: { select: { name: true } } },
                },
            },
        });

        // เลือกความละเอียด (วัน/สัปดาห์/เดือน/ไตรมาส/ปี) อัตโนมัติให้จำนวนแท่ง ≤ MAX_BUCKETS เสมอ
        // แก้บั๊กเดิมที่ hardcode ไว้แค่ 6 เดือน (ม.ค.-มิ.ย.) ทำให้ข้อมูลเดือน ก.ค.-ธ.ค. หายไปเงียบๆ เมื่อ filter ครอบคลุมทั้งปี
        const MAX_BUCKETS = 12;
        const bucketRangeStart: Date = startDateParam
            ? parseLocalDayStart(startDateParam)
            : timeSeriesSamples.length > 0
              ? new Date(Math.min(...timeSeriesSamples.map((s) => new Date(s.collectionTime).getTime())))
              : (() => {
                    const d = new Date(now);
                    d.setMonth(d.getMonth() - 6);
                    return d;
                })();
        // -1ms ให้เป็นจุดสุดท้ายของวันสิ้นสุดแบบ inclusive (ตรงกับ baseWhere.collectionTime.lt)
        const bucketRangeEnd: Date = endDateParam ? new Date(parseLocalDayEnd(endDateParam).getTime() - 1) : now;

        // เวอร์ชันเวลาไทย (wall-clock) ของขอบเขต — floor/advance/bucketKey/label ทั้งชุดด้านล่างอ่านด้วย getUTC*
        // จึงต้องป้อนด้วยค่าที่แปลงแล้วเท่านั้น ไม่งั้นจะจัด bucket ผิดวันสำหรับตัวอย่างที่เก็บช่วงเช้ามืดเวลาไทย (00:00–06:59)
        const bucketRangeStartThai = toThaiWallClock(bucketRangeStart);
        const bucketRangeEndThai = toThaiWallClock(bucketRangeEnd);

        const thaiMonthAbbr = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        type Granularity = "day" | "week" | "month" | "quarter" | "year";

        // ฟังก์ชันจัด bucket ทั้งชุดนี้อ่าน/เขียนด้วย getUTC*/setUTC* เสมอ — ตัว d ที่รับเข้ามาต้องเป็นเวลาไทย (wall-clock
        // จาก toThaiWallClock) แล้วเท่านั้น ไม่ใช่ instant จริง มิฉะนั้นจะจัดกลุ่มผิดวันตาม TZ ของ server
        const floorToGranularity = (d: Date, gran: Granularity): Date => {
            const date = new Date(d);
            if (gran === "day") {
                date.setUTCHours(0, 0, 0, 0);
                return date;
            }
            if (gran === "week") return startOfISOWeek(date);
            if (gran === "month") return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            if (gran === "quarter") return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
            return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        };
        const advanceGranularity = (d: Date, gran: Granularity): Date => {
            const date = new Date(d);
            if (gran === "day") date.setUTCDate(date.getUTCDate() + 1);
            else if (gran === "week") date.setUTCDate(date.getUTCDate() + 7);
            else if (gran === "month") date.setUTCMonth(date.getUTCMonth() + 1);
            else if (gran === "quarter") date.setUTCMonth(date.getUTCMonth() + 3);
            else date.setUTCFullYear(date.getUTCFullYear() + 1);
            return date;
        };
        const bucketKeyOf = (d: Date, gran: Granularity): string => {
            const y = d.getUTCFullYear();
            if (gran === "day" || gran === "week") return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            if (gran === "month") return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            if (gran === "quarter") return `${y}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
            return `${y}`;
        };
        const bucketLabelOf = (d: Date, gran: Granularity, crossesYear: boolean): string => {
            if (gran === "day" || gran === "week") {
                const base = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
                return crossesYear ? `${base}/${d.getUTCFullYear()}` : base;
            }
            if (gran === "month") {
                const base = thaiMonthAbbr[d.getUTCMonth()];
                return crossesYear ? `${base} ${d.getUTCFullYear()}` : base;
            }
            if (gran === "quarter") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
            return `${d.getUTCFullYear()}`;
        };
        // นับจำนวน bucket จริงด้วย floor/advance ชุดเดียวกับที่ใช้สร้างจริง (แม่นยำกว่าประมาณจากจำนวนวัน เพราะเดือน/ปีมีความยาวไม่เท่ากัน)
        const countBuckets = (start: Date, end: Date, gran: Granularity): number => {
            const stopAt = advanceGranularity(floorToGranularity(end, gran), gran);
            let cursor = floorToGranularity(start, gran);
            let count = 0;
            while (cursor.getTime() < stopAt.getTime() && count < 100000) {
                cursor = advanceGranularity(cursor, gran);
                count++;
            }
            return count;
        };
        const pickGranularity = (start: Date, end: Date): Granularity => {
            const order: Granularity[] = ["day", "week", "month", "quarter", "year"];
            for (const gran of order) {
                if (countBuckets(start, end, gran) <= MAX_BUCKETS) return gran;
            }
            return "year";
        };

        // แต่ละ sample ในระบบถือ "พารามิเตอร์เดียว" (ammonia หรือ phosphate ไม่ใช่ทั้งคู่ในแถวเดียว)
        // จึงต้องนับตัวหารของ ammonia กับ phosphate แยกกัน — ถ้าใช้ countAll ตัวเดียวหารทั้งคู่ (บั๊กเดิม)
        // แถวที่เป็น phosphate จะถูกนับเป็น "ammonia = 0" เข้าไปเจือจางค่าเฉลี่ย ammonia ลงเกือบครึ่ง (และกลับกัน)
        // M/E เดิมมาจาก "Morning/Evening" — ตอนนี้หมายถึงก่อนเที่ยง/หลังเที่ยงแล้ว (คงชื่อ field ไว้กันกระทบ temporalData/temporalConfig ที่ frontend ผูกอยู่)
        type BucketAcc = { ammM: number; ammE: number; phosM: number; phosE: number; countAmmM: number; countAmmE: number; countPhosM: number; countPhosE: number; ammAll: number; phosAll: number; countAmmAll: number; countPhosAll: number };
        const buckets: { key: string; label: string }[] = [];
        const bucketAcc = new Map<string, BucketAcc>();
        let granularity: Granularity = "month";

        if (bucketRangeEnd.getTime() >= bucketRangeStart.getTime()) {
            granularity = pickGranularity(bucketRangeStartThai, bucketRangeEndThai);
            const crossesYear = bucketRangeStartThai.getUTCFullYear() !== bucketRangeEndThai.getUTCFullYear();
            const stopAt = advanceGranularity(floorToGranularity(bucketRangeEndThai, granularity), granularity);
            let cursor = floorToGranularity(bucketRangeStartThai, granularity);
            let guard = 0;
            while (cursor.getTime() < stopAt.getTime() && guard < MAX_BUCKETS + 2) {
                const key = bucketKeyOf(cursor, granularity);
                buckets.push({ key, label: bucketLabelOf(cursor, granularity, crossesYear) });
                bucketAcc.set(key, { ammM: 0, ammE: 0, phosM: 0, phosE: 0, countAmmM: 0, countAmmE: 0, countPhosM: 0, countPhosE: 0, ammAll: 0, phosAll: 0, countAmmAll: 0, countPhosAll: 0 });
                cursor = advanceGranularity(cursor, granularity);
                guard++;
            }
        }

        // วนข้อมูลรอบเดียว จัดเข้า bucket ทั้ง temporal (ก่อนเที่ยง/หลังเที่ยง) และ trend (ทุกช่วงเวลารวมกัน) พร้อมกัน
        timeSeriesSamples.forEach((s) => {
            const rawDate = new Date(s.collectionTime);
            // bucketing ต้องป้อนด้วยเวลาไทย (wall-clock) เพราะ floorToGranularity อ่านด้วย getUTC* (ดูคอมเมนต์เหนือฟังก์ชันนั้น)
            const dateObjThai = toThaiWallClock(rawDate);
            const key = bucketKeyOf(floorToGranularity(dateObjThai, granularity), granularity);
            const bucket = bucketAcc.get(key);
            if (!bucket) return; // ตัวอย่างนอกช่วง bucket (ไม่ควรเกิดเพราะ baseWhere กรองไว้แล้ว) — ข้ามอย่างปลอดภัย

            const amm = s.measurements.find((m) => m.parameter.name.toLowerCase() === "ammonia")?.value ?? null;
            const phos = s.measurements.find((m) => m.parameter.name.toLowerCase() === "phosphate")?.value ?? null;
            // ใช้ชั่วโมงตามเวลาไทยเสมอ — Date.getHours() อ่านตาม TZ ของ process ที่รัน (container prod เป็น UTC) ไม่ใช่เวลาที่เก็บจริง
            const hour = getThaiHour(rawDate);
            // แบ่งครึ่งวันที่เที่ยงตรง ครอบคลุม 24 ชม. เต็ม — ทุกตัวอย่างตกอยู่ฝั่งใดฝั่งหนึ่งเสมอ ไม่มีช่วงตกหล่นแบบเดิม (06-12 / 15-21)
            const isBeforeNoon = hour < 12;

            if (amm !== null) {
                bucket.ammAll += amm;
                bucket.countAmmAll++;
                if (isBeforeNoon) {
                    bucket.ammM += amm;
                    bucket.countAmmM++;
                } else {
                    bucket.ammE += amm;
                    bucket.countAmmE++;
                }
            }
            if (phos !== null) {
                bucket.phosAll += phos;
                bucket.countPhosAll++;
                if (isBeforeNoon) {
                    bucket.phosM += phos;
                    bucket.countPhosM++;
                } else {
                    bucket.phosE += phos;
                    bucket.countPhosE++;
                }
            }
        });

        const temporalData = buckets.map((b) => {
            const a = bucketAcc.get(b.key)!;
            // ปัดทศนิยม 2 ตำแหน่งพอสำหรับ ammonia (ค่าปกติ ~0.01-0.09) แต่ทำให้ phosphate (ค่าปกติ ~0.001-0.02
            // ตามเกณฑ์จริงในระบบที่ max อยู่แค่ 0.015-0.045) ปัดลงเป็น 0.00 เกือบทุกครั้ง กราฟจึงว่างเปล่าทั้งที่มีข้อมูลจริง
            // ปัด 4 ตำแหน่งให้ทั้งคู่แทน กันปัญหานี้เกิดซ้ำถ้าสารตัวอื่นในอนาคตมีสเกลค่าเล็กแบบ phosphate
            return {
                name: b.label,
                ammoniaMorning: Number((a.ammM / (a.countAmmM || 1)).toFixed(4)),
                ammoniaEvening: Number((a.ammE / (a.countAmmE || 1)).toFixed(4)),
                phosphateMorning: Number((a.phosM / (a.countPhosM || 1)).toFixed(4)),
                phosphateEvening: Number((a.phosE / (a.countPhosE || 1)).toFixed(4)),
            };
        });

        // --- [มิติที่ 4: WaterTrendChart] ---
        const trendsData = buckets.map((b) => {
            const a = bucketAcc.get(b.key)!;
            // ปัด 4 ตำแหน่งเหมือน temporalData ด้านบน — เหตุผลเดียวกัน: ปัดแค่ 2 ตำแหน่งทำให้ phosphate กลายเป็น 0.00 เกือบทุกช่วง
            return {
                date: b.label,
                ammonia: Number((a.ammAll / (a.countAmmAll || 1)).toFixed(4)),
                phosphate: Number((a.phosAll / (a.countPhosAll || 1)).toFixed(4)),
            };
        });

        // ป้ายบอกความละเอียด + ช่วงเวลาที่กราฟ temporal/trend กำลังแสดงจริง (ให้ UI ไม่ hardcode คำว่า "รายเดือน" ทั้งที่ granularity เปลี่ยนได้)
        const granularityThaiLabel: Record<Granularity, string> = {
            day: "รายวัน",
            week: "รายสัปดาห์",
            month: "รายเดือน",
            quarter: "รายไตรมาส",
            year: "รายปี",
        };
        // ใช้ getUTC* เพราะรับ bucketRangeStartThai/EndThai ที่เป็น wall-clock เวลาไทยแล้ว (ไม่ใช่ instant จริง)
        const formatThaiDate = (d: Date) => `${d.getUTCDate()} ${thaiMonthAbbr[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        const granularityInfo = {
            granularity,
            label: granularityThaiLabel[granularity],
            rangeStart: bucketRangeStart.toISOString(),
            rangeEnd: bucketRangeEnd.toISOString(),
            rangeLabel: bucketRangeEnd.getTime() >= bucketRangeStart.getTime() ? `${formatThaiDate(bucketRangeStartThai)} – ${formatThaiDate(bucketRangeEndThai)}` : "",
        };

        // ---  [มิติที่ 5: Correlation] สหสัมพันธ์สภาพอากาศ (ฝน/อุณหภูมิอากาศ) กับความเข้มข้นสารเคมี ---
        // เก็บคู่จุดของแต่ละชุด (แกน × สาร) เพื่อคำนวณ Pearson r และแบ่ง density bin ฝั่ง server
        const rainNH3: { x: number; y: number }[] = [];
        const rainPO4: { x: number; y: number }[] = [];
        const tempNH3: { x: number; y: number }[] = [];
        const tempPO4: { x: number; y: number }[] = [];

        timeSeriesSamples.forEach((s) => {
            const amm = s.measurements.find((m) => m.parameter.name.toLowerCase() === "ammonia")?.value ?? null;
            const phos = s.measurements.find((m) => m.parameter.name.toLowerCase() === "phosphate")?.value ?? null;
            const rain = s.rainAccumulation;
            const temp = s.airTemperature;

            if (rain !== null && rain !== undefined && amm !== null) rainNH3.push({ x: rain, y: amm });
            if (rain !== null && rain !== undefined && phos !== null) rainPO4.push({ x: rain, y: phos });
            if (temp !== null && temp !== undefined && amm !== null) tempNH3.push({ x: temp, y: amm });
            if (temp !== null && temp !== undefined && phos !== null) tempPO4.push({ x: temp, y: phos });
        });

        const pearsonPairs = (pts: { x: number; y: number }[]): [number, number][] => pts.map((p) => [p.x, p.y]);
        // เส้น trend คำนวณจากคู่ข้อมูลชุดเดียวกับ Pearson r เสมอ (ความชัน/จุดตัดแกน y)
        const correlationMetrics = [
            { key: "rain_nh3", label: "ฝน × Ammonia", r: pearson(pearsonPairs(rainNH3)), n: rainNH3.length, trend: linearFit(pearsonPairs(rainNH3)) },
            { key: "rain_po4", label: "ฝน × Phosphate", r: pearson(pearsonPairs(rainPO4)), n: rainPO4.length, trend: linearFit(pearsonPairs(rainPO4)) },
            { key: "temp_nh3", label: "อุณหภูมิ × Ammonia", r: pearson(pearsonPairs(tempNH3)), n: tempNH3.length, trend: linearFit(pearsonPairs(tempNH3)) },
            { key: "temp_po4", label: "อุณหภูมิ × Phosphate", r: pearson(pearsonPairs(tempPO4)), n: tempPO4.length, trend: linearFit(pearsonPairs(tempPO4)) },
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
            locations: allLocations, // { id, stationName, governingAgency } ทั้งหมด — ให้ frontend ใช้ค้นหาสถานี/หน่วยงานแบบพิมพ์หา
            kpis: kpisBlueprint, // การ์ดสรุปส่งไปตามแถวจริงในตารางฐานข้อมูลของบอสแบบ 100%
            // หัวข้อปรับตามจำนวนสถานีที่หาเจอจริง (take: 5 เป็นแค่เพดานสูงสุด) กันคำว่า "5 อันดับ" ค้างตอนกรองแล้วเจอน้อยกว่า
            // หมายเหตุ: ไม่แสดงตอน stationDetail มีค่า เพราะกล่อง Hotspots ถูกซ่อนทั้งกล่องแล้วในกรณีนั้น (ไม่ต้องคำนวณ title พิเศษแยก)
            hotspotConfig: {
                title: hotspotsData.length > 0 ? `Danger Hotspots — ${hotspotsData.length} จุดเสี่ยงอันตรายสะสมสูงสุด` : "Danger Hotspots — ไม่พบสถานีที่มีความเสี่ยงในช่วงที่เลือก",
            },
            stationDetail, // ไม่ null เฉพาะตอนกรองสถานีเดียว — frontend ใช้เป็น flag ซ่อนตาราง Hotspots + ขยายกราฟก่อนเที่ยง-หลังเที่ยงเต็มแถว
            hotspots: hotspotsData,
            temporalConfig: {
                // ค่า key คงเดิม (ammoniaMorning ฯลฯ) — เปลี่ยนแค่ name ที่แสดงผล ไม่แตะ key เพราะ frontend (getGroupedBars) ผูกกับชื่อ key นี้อยู่
                title: "Before/After Noon Fluctuations (เปรียบเทียบระดับสารเคมีคู่ขนาน)",
                bars: [
                    { key: "ammoniaMorning", name: "Ammonia ก่อนเที่ยง", color: "#60a5fa" },
                    { key: "ammoniaEvening", name: "Ammonia หลังเที่ยง", color: "#fbbf24" },
                    { key: "phosphateMorning", name: "Phosphate ก่อนเที่ยง", color: "#60a5fa" },
                    { key: "phosphateEvening", name: "Phosphate หลังเที่ยง", color: "#fbbf24" },
                ],
            },
            temporalData: temporalData,
            granularityInfo: granularityInfo, // ความละเอียด (วัน/สัปดาห์/เดือน/ไตรมาส/ปี) + ช่วงวันที่ที่ temporalData/trends กำลังแสดงจริง
            trendConfig: {
                title: "กราฟวิเคราะห์แนวโน้มสะสมตามเกณฑ์มาตรฐานของ PCD",
                references: [
                    ...(ammoniaMax !== null ? [{ value: ammoniaMax, color: "#ef4444", label: `Max Ammonia (${ammoniaMax})` }] : []),
                    ...(phosphateMax !== null ? [{ value: phosphateMax, color: "#a855f7", label: `Max Phosphate (${phosphateMax})` }] : []),
                ],
                lines: [
                    { key: "ammonia", name: "Ammonia", color: parameterColor("ammonia") },
                    { key: "phosphate", name: "Phosphate", color: parameterColor("phosphate") },
                ],
            },
            trends: trendsData,
            correlation: {
                title: "กราฟความสัมพันธ์เชิงสถิติระหว่างสภาพภูมิอากาศ",
                note: "อุณหภูมิ = อุณหภูมิอากาศ (ไม่มีอุณหภูมิน้ำใน schema)",
                metrics: correlationMetrics,
                heatmaps: correlationHeatmaps,
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

// จุดเริ่มต้นสัปดาห์แบบ ISO (จันทร์ 00:00) ของวันที่ที่กำหนด — ใช้คำนวณ WoW ตามปฏิทินสากล
// รับ/คืนค่าเป็นเวลาไทย (wall-clock จาก toThaiWallClock) เสมอ — อ่าน/เขียนด้วย getUTC*/setUTC* จึงตรงกับปฏิทินไทยตรง ๆ
// (ผู้เรียกทั้งสองที่ในไฟล์นี้ป้อนด้วยค่าที่แปลงแล้ว — ห้ามป้อน instant จริงตรง ๆ)
function startOfISOWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getUTCDay(); // 0=อาทิตย์ ... 6=เสาร์
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diffToMonday);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

// วันที่ 1 ของเดือนปฏิทิน เวลา 00:00 — ใช้เป็นจุดเริ่มต้นของ MoM (รับ/คืนค่าเป็นเวลาไทย wall-clock เช่นกัน)
function startOfCalendarMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

// ถอยหลัง N เดือนแบบปฏิทิน พร้อม clamp วันที่ที่เกินจำนวนวันของเดือนเป้าหมาย (เช่น 31 มี.ค. ถอย 1 เดือน -> 28/29 ก.พ.)
function subtractMonthClamped(d: Date, months: number): Date {
    const targetMonthDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, 1));
    const lastDayOfTargetMonth = new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
    const clampedDay = Math.min(d.getUTCDate(), lastDayOfTargetMonth);
    return new Date(Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth(), clampedDay, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
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
