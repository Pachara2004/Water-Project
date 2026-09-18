/**
 * @file lib/sampleRecord.ts
 * @project Water Monitoring Project
 * @module Core / Immutable Sample Snapshot & Audit Logger
 * @description
 * [TH] โมดูลสร้าง Snapshot บันทึกประวัติคุณภาพน้ำแบบไม่เปลี่ยนแปลง (Immutable Snapshot Record)
 * เมื่อคำร้องเก็บตัวอย่างน้ำได้รับการอนุมัติ โดยทำการรวบรวมค่าตรวจวัดสารเคมีทั้งหมดใน Session Group
 * พร้อมภาพถ่ายหลอดทดลอง กราฟวิเคราะห์ และข้อมูลสภาพแวดล้อม ณ จุดตรวจวัด
 * พร้อมฟังก์ชันบันทึก Audit Log (`SampleRawLog`) สำหรับกรณีแก้ไข/ปฏิเสธ และสร้างรายการแจ้งเตือน (`Notification`)
 *
 * [EN] Manages immutable water quality snapshot record generation upon sample review approval (`SampleRecord`).
 * Aggregates all chemical measurements, strip photos, analyzed calibration plots, and environmental context under a session group.
 * Supplies transaction-safe audit logging for rejections/edits (`SampleRawLog`) and collector notification creation.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-08-21
 * @modified 2026-09-11
 * @version 2.0.0
 * @license Proprietary
 *
 * @see {@link /lib/prisma.ts} TxClient transactional client type
 * @see {@link /app/api/review-requests/[id]/route.ts} Review decision endpoint triggering snapshot creation
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ออกแบบสถาปัตยกรรม Snapshot และ Audit Log เบื้องต้น
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - ปรับปรุงการรวมภาพถ่ายแยกสาร, เวลาไทย และแก้บั๊ก Snapshot
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ล้าง snapshot/log/แคชตอน seed และ copy เวลาส่งจริงลง snapshot
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ยึดเวลาไทยเป็นนิยามเดียวของทุกคอลัมน์ DateTime ใน DB
 * - 2026-09-08 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ทำให้ระบบลบรูปหมดอายุใช้งานได้ และแก้บั๊กฝั่ง API อีกสี่จุด
 * - 2026-09-02 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: ให้ส่งภาพที่ AI ไม่พบหลอดทดลองเข้าคิวตรวจสอบได้ แทนการบล็อกทิ้ง
 * - 2026-08-26 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แสดงชื่อหน่วยงานในหน้าประวัติแทนขีด
 */

import { ReviewStatus, WaterStatus } from '@prisma/client';
import type { TxClient } from "@/lib/prisma";
import { nowThai } from "@/lib/thaiTime";

/**
 * [TH] สร้าง Snapshot บันทึกข้อมูลตัวอย่างน้ำชุดสมบูรณ์ (`SampleRecord`) จากกลุ่มตัวอย่างที่ได้รับการอนุมัติ
 * รวมผลการตรวจวัดสารเคมีทุกตัวในกลุ่ม รวบรวมรูปภาพหลอดทดลองแยกตามสารเคมี และคำนวณสถานะคุณภาพน้ำภาพรวม (เกณฑ์ที่แย่ที่สุด)
 *
 * [EN] Creates an immutable `SampleRecord` snapshot from an array of approved `WaterSample` records within the same session group.
 * Aggregates all parameter measurements with associated strip images and calculates overall water status (worst status rule).
 *
 * @async
 * @function createSampleRecordSnapshot
 * @param {TxClient} tx - Prisma Transaction Client
 * @param {any[]} samples - อาร์เรย์ของ WaterSample ที่รวมความสัมพันธ์ collector, location, measurements (with parameter)
 * @param {number | null} [reviewedById] - รหัสประจำตัวของผู้ตรวจทาน/อนุมัติ (Officer ID)
 * @returns {Promise<any>} เอนทิตี SampleRecord ที่ถูกสร้างขึ้น หรือ null หากไม่มีข้อมูลตัวอย่าง
 */
export async function createSampleRecordSnapshot(
  tx: TxClient,
  samples: any[], // Type loosely, assuming it has relations included
  reviewedById?: number | null
) {
  if (!samples || samples.length === 0) return null;

  // Use the first sample as the base for the snapshot metadata
  const baseSample = samples[0];

  // Aggregate measurements into a JSON object mapping parameter names to values
  // e.g. { "pH": { value: 7.0, confidence: 0.95 }, "DO": ... }
  // We can also store an array if preferred, let's store an array of objects
  // แต่ละ entry เก็บรูปของ sample ที่มันมาจริง ๆ ไว้ในตัวเอง
  // รูปในระบบเป็นภาพหลอดทดลอง "หนึ่งใบต่อหนึ่งสาร" การผูกไว้ที่ระดับ snapshot รวม (imageUrl ด้านล่าง)
  // จึงบอกไม่ได้ว่ารูปไหนเป็นของสารไหน ฝั่งอ่านต้องหยิบจากตรงนี้ก่อนเสมอ
  const parameterData = samples.flatMap((s) =>
    s.measurements.map((m: any) => ({
      sampleCode: s.code,
      parameterName: m.parameter?.name,
      parameterId: m.parameterId,
      value: m.value,
      confidence: m.confidence,
      boundingBox: m.boundingBox,
      message: m.message,
      sampleId: m.sampleId,
      rawImageUrl: s.rawImageUrl ?? null,
      plotImageUrl: s.analyzedPlotUrl ?? null,
    }))
  );

  // Compile image URLs
  // Collect rawImageUrl and analyzedPlotUrl from the samples that have them
  const rawImageUrls = samples.map((s) => s.rawImageUrl).filter(Boolean);
  const plotImageUrls = samples.map((s) => s.analyzedPlotUrl).filter(Boolean);

  const imageUrlJson = {
    rawImageUrls: Array.from(new Set(rawImageUrls)),
    plotImageUrls: Array.from(new Set(plotImageUrls)),
  };

  // สถานะรวมของ snapshot = แย่สุดของทุก sample ในกลุ่ม
  // null = ไม่มี sample ไหนประเมินได้เลย (ทุกตัวไม่มีค่าที่วัดได้)
  // ห้าม default เป็น 'safe' เหมือนเดิม ไม่งั้นกลุ่มที่ไม่เคยถูกประเมินจะถูกบันทึกว่าปลอดภัยถาวร
  let overallStatus: WaterStatus | null = null;
  if (samples.some((s) => s.status === 'danger')) {
    overallStatus = 'danger';
  } else if (samples.some((s) => s.status === 'warning')) {
    overallStatus = 'warning';
  } else if (samples.some((s) => s.status === 'safe')) {
    overallStatus = 'safe';
  }

  // Create the record
  const record = await tx.sampleRecord.create({
    data: {
      code: baseSample.sessionGroup,
      collectorNameFrom: baseSample.collector?.lineProfileName || baseSample.collector?.firstName || 'Unknown',
      collectorNameCurrentId: baseSample.collectorId,
      locationNameFrom: baseSample.location?.stationName || 'Unknown',
      // null ได้เมื่อสถานีนั้นยังไม่ได้ระบุหน่วยงาน — ฝั่งแสดงผลเป็นคนตัดสินใจว่าจะโชว์อะไรแทน
      governingAgencyFrom: baseSample.location?.governingAgency ?? null,
      locationNameCurrentId: baseSample.locationId,
      collectionTime: baseSample.collectionTime,
      // ต้อง copy มาจากตัวอย่างต้นทาง ไม่งั้น default now() จะกลายเป็น "เวลาอนุมัติ" แทนเวลาที่ส่งจริง
      uploadedActiveAt: baseSample.uploadedActiveAt,
      dissolvedOxygen: baseSample.dissolvedOxygen,
      airTemperature: baseSample.airTemperature,
      rainAccumulation: baseSample.rainAccumulation,
      weatherCondCode: baseSample.weatherCondCode,
      status: overallStatus,
      // เวอร์ชันเกณฑ์ที่ใช้ตัดสินกลุ่มนี้ ทุก sample ในกลุ่มส่งพร้อมกันจึงเป็นเวอร์ชันเดียวกัน
      standardVersionId: baseSample.standardVersionId ?? null,
      imageUrl: imageUrlJson,
      imageExpiresAt: baseSample.imageExpiresAt,
      isDeleted: false,
      lastModifiedBy: reviewedById || baseSample.lastModifiedBy || null,
      parameterData: parameterData,
      reviewedById: reviewedById || null,
    },
  });

  return record;
}

/**
 * [TH] บันทึกประวัติการตรวจสอบและการเปลี่ยนแปลงค่า (Audit Log) ลงในโมเดล `SampleRawLog`
 * ใช้บันทึกสาเหตุการปฏิเสธ (Reject) หรือประวัติค่าเดิมก่อนถูกแก้ไข (Edited Approved)
 *
 * [EN] Records review and audit trail history into `SampleRawLog`.
 * Preserves original parameter values and rejection/modification remarks for transparency.
 *
 * @async
 * @function createSampleRawAuditLog
 * @param {TxClient} tx - Prisma Transaction Client
 * @param {object} params - ข้อมูลการบันทึก Audit Log
 * @param {string} params.sessionGroup - รหัสกลุ่ม Session
 * @param {any} params.sampleParameterName - อาร์เรย์ของข้อมูลพารามิเตอร์และค่าเดิม (เช่น `[{ param: 'pH', oldValue: 6.0 }]`)
 * @param {any} [params.message] - เหตุผลประกอบการปฏิเสธหรือการแก้ไขค่า
 * @param {any} [params.imageRawUrl] - URL รูปภาพดิบที่เกี่ยวข้อง
 * @param {number} params.reviewedById - รหัสผู้ตรวจทาน
 * @returns {Promise<any>} เอนทิตี SampleRawLog ที่สร้างขึ้น
 */
export async function createSampleRawAuditLog(
  tx: TxClient,
  params: {
    sessionGroup: string;
    sampleParameterName: any; // e.g. [{ param: 'pH', oldValue: 6.0 }, ...]
    message?: any; // The reason for rejection/editing
    imageRawUrl?: any;
    reviewedById: number;
  }
) {
  return tx.sampleRawLog.create({
    data: {
      sessionGroup: params.sessionGroup,
      sampleParameterName: params.sampleParameterName,
      message: params.message || null,
      imageRawUrl: params.imageRawUrl || null,
      reviewedById: params.reviewedById,
    },
  });
}

/**
 * [TH] สร้างหรืออัปเดตรายการแจ้งเตือน (`Notification`) ให้แก่ผู้ใช้งาน
 * หากมีแจ้งเตือนเดิมที่มีรหัสโค้ดเดียวกันอยู่แล้ว จะอัปเดตสถานะและดันเวลาขึ้นด้านบนสุด
 *
 * [EN] Creates or updates a user `Notification` record within an interactive transaction.
 * Upserts existing notifications sharing the same sample code and refreshes timestamp to top priority.
 *
 * @async
 * @function createNotificationEntry
 * @param {TxClient} tx - Prisma Transaction Client
 * @param {object} params - ข้อมูลการแจ้งเตือน
 * @param {number} params.userId - รหัสผู้ใช้งานปลายทางที่จะได้รับการแจ้งเตือน
 * @param {string | null} [params.code] - รหัสตัวอย่างน้ำ หรือรหัส Session Group
 * @param {ReviewStatus} params.status - สถานะการตรวจทาน (APPROVED, EDITED_APPROVED, REJECTED, ฯลฯ)
 * @param {string} [params.message] - ข้อความแจ้งเตือนหรือเหตุผลประกอบ
 * @param {number} [params.reviewBy] - รหัสผู้ตรวจทานที่ส่งการแจ้งเตือน
 * @returns {Promise<any>} เอนทิตี Notification ที่ถูกสร้างหรืออัปเดต
 */
export async function createNotificationEntry(
  tx: TxClient,
  params: {
    userId: number;
    code?: string | null;
    status: ReviewStatus;
    message?: string;
    reviewBy?: number;
  }
) {
  if (params.code) {
    const existing = await tx.notification.findFirst({
      where: { userId: params.userId, code: params.code }
    });
    
    if (existing) {
      return tx.notification.update({
        where: { id: existing.id },
        data: {
          status: params.status,
          message: params.message || null,
          reviewBy: params.reviewBy || null,
          isReading: false,
          createdAt: nowThai(), // Update timestamp to bump it to the top
        }
      });
    }
  }

  return tx.notification.create({
    data: {
      userId: params.userId,
      code: params.code || null,
      status: params.status,
      message: params.message || null,
      reviewBy: params.reviewBy || null,
      isReading: false,
    },
  });
}
