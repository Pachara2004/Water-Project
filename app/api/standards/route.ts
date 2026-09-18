/**
 * @file app/api/standards/route.ts
 * @project Water Monitoring Project
 * @module API / Standards Management
 * @description
 * [TH] Route Handler จัดการเกณฑ์มาตรฐานคุณภาพน้ำสำหรับ Admin:
 * - GET: ตารางเกณฑ์ปัจจุบัน (ประเภท × สาร) พร้อมเวอร์ชันล่าสุดและจำนวนคำร้องที่ค้างตรวจ
 * - PUT: แก้ค่า maxValue ของคู่ที่มีอยู่ แล้วบันทึกเป็นเวอร์ชันใหม่ใน standard_versions
 * [EN] Route Handler for water quality standards administration (admin only):
 * - GET: current standards matrix with latest version and pending review count
 * - PUT: update maxValue of existing pairs and record a new StandardVersion snapshot
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 * @see prisma/schema.prisma (Standard, StandardVersion)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildStandardSnapshot, getCurrentStandardVersion } from "@/lib/standards-db";
import { nowThai, toApiString } from "@/lib/thaiTime";

/** ความยาวสูงสุดของเหตุผลการแก้ */
const NOTE_MAX_LENGTH = 500;

/** 1 ช่องที่แอดมินแก้ */
interface StandardChange {
    locationTypeId: number;
    parameterId: number;
    maxValue: number;
}

/**
 * ตารางเกณฑ์ปัจจุบันพร้อมเวอร์ชันล่าสุด (เฉพาะ Admin)
 *
 * @returns {Promise<NextResponse>} { locationTypes, parameters, standards, currentVersion, pendingReviewCount }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const [locationTypes, parameters, standards, currentVersion, pendingReviewCount] = await Promise.all([
            prisma.locationType.findMany({ select: { id: true, code: true, labelTh: true }, orderBy: { id: "asc" } }),
            prisma.parameter.findMany({ select: { id: true, name: true, unit: true, formula: true }, orderBy: { id: "asc" } }),
            prisma.standard.findMany({ select: { locationTypeId: true, parameterId: true, maxValue: true } }),
            getCurrentStandardVersion(),
            prisma.reviewRequest.count({ where: { statusRequest: "pending" } }),
        ]);

        return NextResponse.json({
            locationTypes,
            parameters,
            standards,
            currentVersion: currentVersion ? { id: currentVersion.id, version: currentVersion.version, createdAt: toApiString(currentVersion.createdAt) } : null,
            // คำร้องที่ค้างอยู่จะยังถูกตัดสินด้วยเกณฑ์เวอร์ชันตอนส่ง ไว้บอกแอดมินก่อนบันทึก
            pendingReviewCount,
        });
    } catch (error) {
        console.error("[API_STANDARDS_GET]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเกณฑ์มาตรฐาน" }, { status: 500 });
    }
}

/**
 * แก้ค่าเกณฑ์แล้วบันทึกเวอร์ชันใหม่ (เฉพาะ Admin)
 * ถ้าไม่มีค่าไหนเปลี่ยนจริง ตอบ 200 โดยไม่สร้างเวอร์ชัน
 *
 * @param request body { changes: StandardChange[], note: string }
 * @returns {Promise<NextResponse>} { changed, version } — version เป็น null เมื่อไม่มีอะไรเปลี่ยน
 */
export async function PUT(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const body = await request.json().catch(() => null);
        const rawChanges = body?.changes;
        const note = typeof body?.note === "string" ? body.note.trim() : "";

        if (!Array.isArray(rawChanges) || rawChanges.length === 0) {
            return NextResponse.json({ error: "ไม่มีรายการเกณฑ์ที่ต้องการแก้ไข" }, { status: 400 });
        }
        if (!note) {
            return NextResponse.json({ error: "กรุณาระบุเหตุผลในการแก้ไขเกณฑ์" }, { status: 400 });
        }
        if (note.length > NOTE_MAX_LENGTH) {
            return NextResponse.json({ error: `เหตุผลต้องยาวไม่เกิน ${NOTE_MAX_LENGTH} ตัวอักษร` }, { status: 400 });
        }

        const changes: StandardChange[] = [];
        for (const c of rawChanges) {
            const locationTypeId = Number(c?.locationTypeId);
            const parameterId = Number(c?.parameterId);
            const maxValue = Number(c?.maxValue);
            if (!Number.isInteger(locationTypeId) || !Number.isInteger(parameterId)) {
                return NextResponse.json({ error: "รหัสประเภทหรือสารไม่ถูกต้อง" }, { status: 400 });
            }
            if (!Number.isFinite(maxValue) || maxValue <= 0) {
                return NextResponse.json({ error: "ค่าเกณฑ์ต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
            }
            changes.push({ locationTypeId, parameterId, maxValue });
        }

        // ซ้ำคู่เดียวกันใน request เดียว = client ส่งมาผิด
        const pairKeys = new Set(changes.map((c) => `${c.locationTypeId}:${c.parameterId}`));
        if (pairKeys.size !== changes.length) {
            return NextResponse.json({ error: "มีรายการเกณฑ์ซ้ำกันในคำขอ" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.standard.findMany({
                where: { OR: changes.map((c) => ({ locationTypeId: c.locationTypeId, parameterId: c.parameterId })) },
                select: { locationTypeId: true, parameterId: true, maxValue: true },
            });
            const existingByKey = new Map(existing.map((s) => [`${s.locationTypeId}:${s.parameterId}`, s.maxValue]));

            // แก้ได้เฉพาะคู่ที่มีอยู่แล้ว การเพิ่มประเภท/สารใหม่ไม่อยู่ในขอบเขตของหน้านี้
            const missing = changes.find((c) => !existingByKey.has(`${c.locationTypeId}:${c.parameterId}`));
            if (missing) {
                return { error: `ไม่พบเกณฑ์ของประเภท ${missing.locationTypeId} สาร ${missing.parameterId}` } as const;
            }

            const actualChanges = changes.filter((c) => existingByKey.get(`${c.locationTypeId}:${c.parameterId}`) !== c.maxValue);
            if (actualChanges.length === 0) {
                return { changed: 0, version: null } as const;
            }

            for (const c of actualChanges) {
                await tx.standard.update({
                    where: { locationTypeId_parameterId: { locationTypeId: c.locationTypeId, parameterId: c.parameterId } },
                    data: { maxValue: c.maxValue },
                });
            }

            const latest = await tx.standardVersion.findFirst({ select: { version: true }, orderBy: { version: "desc" } });
            const version = await tx.standardVersion.create({
                data: {
                    version: (latest?.version ?? 0) + 1,
                    snapshot: await buildStandardSnapshot(tx),
                    note,
                    createdById: auth.user!.id,
                    createdAt: nowThai(),
                },
                select: { id: true, version: true, createdAt: true },
            });

            return { changed: actualChanges.length, version } as const;
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 404 });
        }

        return NextResponse.json({
            changed: result.changed,
            version: result.version ? { id: result.version.id, version: result.version.version, createdAt: toApiString(result.version.createdAt) } : null,
        });
    } catch (error) {
        console.error("[API_STANDARDS_PUT]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกเกณฑ์มาตรฐาน" }, { status: 500 });
    }
}
