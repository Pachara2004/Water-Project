import { ReviewStatus, WaterStatus } from '@prisma/client';
import type { TxClient } from "@/lib/prisma";
import { nowThai } from "@/lib/thaiTime";


/**
 * Creates a SampleRecord snapshot from an array of WaterSample records (which should belong to the same sessionGroup).
 * The samples array must include relations: collector, location, and measurements (with parameter).
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
 * Logs rejected or edited-approved changes to SampleRawLog
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
 * Creates a Notification entry
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
