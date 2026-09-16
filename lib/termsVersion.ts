/**
 * @file lib/termsVersion.ts
 * @project Water Monitoring Project
 * @module Terms & Policies / Version Management
 * @description
 * [TH] กำหนดเวอร์ชันข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว (Terms of Service & PDPA) ฉบับล่าสุดของระบบ
 * ใช้เป็นจุดอ้างอิงร่วมกันทั้งฝั่งไคลเอนต์และเซิร์ฟเวอร์ในการตรวจสอบการยินยอมของผู้ใช้งาน
 * หากมีการปรับปรุงเนื้อหาข้อตกลงอย่างมีสาระสำคัญ ให้เปลี่ยนค่าวันที่ของเวอร์ชันนี้
 *
 * [EN] Declares the active version identifier for system Terms of Service and Privacy Policy (PDPA).
 * Shared across client and server environments to enforce re-consent whenever terms are bumped.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @modified 2026-09-15
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /components/TermsContent.tsx} คอมโพเนนต์แสดงเนื้อหาข้อตกลงและนโยบายความเป็นส่วนตัว
 * @see {@link /lib/lineAuth.ts} ระบบตรวจสอบและบังคับใช้การยอมรับข้อตกลง
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-15)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: ต้องยอมรับข้อตกลงก่อนระบบจะเก็บ LINE uid
 */

// เวอร์ชันของข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว (components/TermsContent.tsx)
// ใช้ทั้งฝั่ง client (ส่งไปกับการลงทะเบียน) และ server (ตรวจว่าผู้ใช้ยอมรับฉบับปัจจุบัน)
// แก้ค่านี้ทุกครั้งที่เนื้อหาข้อตกลงเปลี่ยนในสาระสำคัญ

/**
 * [TH] รหัสเวอร์ชันปัจจุบันของข้อตกลงการใช้งานและนโยบายคุ้มครองข้อมูลส่วนบุคคล (รูปแบบ YYYY-MM-DD)
 * [EN] Current active version string of Terms of Service & Privacy Policy (YYYY-MM-DD format)
 * @constant {string}
 */
export const TERMS_VERSION = "2026-09-15";
