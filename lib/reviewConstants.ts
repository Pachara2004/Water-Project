/**
 * @file lib/reviewConstants.ts
 * @project Water Monitoring Project
 * @module Review / Review Constants
 * @description
 * [TH] ค่าคงที่สำหรับกระบวนการตรวจสอบและอนุมัติผลตัวอย่างน้ำ (Client-safe constants)
 * แยกออกจาก `lib/review.ts` เพื่อให้สามารถนำไป import ใช้งานบน React Client Components ได้โดยไม่ดึง Prisma เข้ามา
 * ประกอบด้วยความยาวสูงสุดของข้อความเหตุผล และข้อความเริ่มต้นกรณีปฏิเสธบางส่วน (Partial Rejection)
 *
 * [EN] Client-safe review workflow constants decoupled from server-only Prisma dependencies.
 * Shared across client forms, modal counters, and API request validation schemas.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-24
 * @modified 2026-07-24
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /lib/review.ts} Server-side review helper functions
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-24)
 *
 * @lastModified 2026-07-24
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-24 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ฟังก์ชันคำร้อง หากมี 2 สาร
 * - 2026-07-24 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ปรับบางส่วนของฟังก์ชันตรวจสอบน้ำ
 */

// ค่าคงที่ที่ใช้ร่วมกันทั้งฝั่ง client (ฟอร์ม + counter) และ server (validate)
// แยกจาก lib/review.ts เพราะไฟล์นั้น import prisma (server-only) — ไฟล์นี้ต้อง client-safe

/**
 * [TH] ความยาวสูงสุดของข้อความระบุเหตุผลในการปฏิเสธคำร้อง (อักขระ)
 * [EN] Maximum character length permitted for review rejection remarks
 * @constant {number}
 */
export const REVIEW_NOTE_MAX_LENGTH = 200;

/**
 * [TH] ข้อความเหตุผลเริ่มต้นสำหรับพารามิเตอร์สารเคมีที่ถูกปฏิเสธโดยอัตโนมัติจากการอนุมัติบางส่วนโดยผู้ดูแลระบบ
 * [EN] Default remark attached to parameters auto-rejected during partial approval workflows
 * @constant {string}
 */
export const PARTIAL_REJECT_NOTE = "ปฏิเสธจากการอนุมัติบางส่วนโดยผู้ดูแลระบบ";
