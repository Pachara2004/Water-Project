/**
 * @fileoverview Shared Thai address hierarchy validation and zipcode lookup
 *
 * [TH] โมดูลตรวจสอบโครงสร้างที่อยู่ไทยและค้นหารหัสไปรษณีย์ (ใช้งานร่วมกันระหว่าง Client และ Server)
 * [EN] Shared Thai administrative address tree validation and postal code lookup utilities
 *
 * @description
 * [TH] โครงสร้างข้อมูลแบบต้นไม้ (Province -> District -> Subdistrict -> Zipcode)
 * สำหรับตรวจสอบความถูกต้องของที่อยู่ตามลำดับชั้น (Cascade validation) และค้นหารหัสไปรษณีย์
 * [EN] Hierarchical tree structure representing Thai administrative divisions
 * providing cascading validation and zipcode resolution across client and server.
 *
 * @module lib/thaiAddress
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มระบบตรวจสอบโครงสร้างที่อยู่ไทย (AddressTree)
 */

/**
 * ตรรกะที่อยู่ไทยที่ใช้ร่วมกันทั้ง client และ server
 *
 * ห้าม import อะไรที่เป็น server-only (fs, prisma) ในไฟล์นี้ เพราะฝั่ง client import ด้วย
 * ตัวโหลดไฟล์ฝั่ง server อยู่ที่ lib/thaiAddress.server.ts ส่วนฝั่ง client อยู่ที่ lib/hooks/useThaiAddressTree.ts
 */

/**
 * [TH] โครงสร้างต้นไม้ข้อมูลที่อยู่ไทย: { [จังหวัด]: { [อำเภอ]: { [ตำบล]: "รหัสไปรษณีย์" } } }
 * [EN] Thai address hierarchical tree type: Province -> District -> Subdistrict -> Zipcode
 */
export type AddressTree = Record<string, Record<string, Record<string, string>>>;

/**
 * [TH] โครงสร้างข้อมูลองค์ประกอบที่อยู่ 3 ระดับ (จังหวัด, อำเภอ, ตำบล)
 * [EN] Represents tripartite Thai address components: province, district, subdistrict
 */
export interface AddressParts {
    province: string;
    district: string;
    subdistrict: string;
}

/**
 * [TH] ตรวจสอบความถูกต้องของที่อยู่ไทยทีละระดับแบบ Cascade แล้วคืนเฉพาะระดับที่มีอยู่จริงในฐานข้อมูล
 * [EN] Validates address parts hierarchically against the tree, pruning invalid cascading children
 *
 * @function validateAddressParts
 * @param {AddressTree | null} tree - โครงสร้างต้นไม้ข้อมูลที่อยู่ไทย
 * @param {string} province - ชื่อจังหวัด
 * @param {string} district - ชื่ออำเภอ/เขต
 * @param {string} subdistrict - ชื่อตำบล/แขวง
 * @returns {AddressParts} วัตถุองค์ประกอบที่อยู่ที่ผ่านการตรวจสอบแล้ว
 */
export function validateAddressParts(tree: AddressTree | null, province: string, district: string, subdistrict: string): AddressParts {
    if (!tree || !province || !tree[province]) {
        return { province: "", district: "", subdistrict: "" };
    }
    if (!district || !tree[province][district]) {
        return { province, district: "", subdistrict: "" };
    }
    if (!subdistrict || !tree[province][district][subdistrict]) {
        return { province, district, subdistrict: "" };
    }
    return { province, district, subdistrict };
}

/**
 * [TH] ค้นหารหัสไปรษณีย์ตามชื่อจังหวัด อำเภอ และตำบลที่ระบุ
 * [EN] Looks up postal code from the address tree for a given province, district, and subdistrict
 *
 * @function lookupZipcode
 * @param {AddressTree | null} tree - โครงสร้างต้นไม้ข้อมูลที่อยู่ไทย
 * @param {string} province - ชื่อจังหวัด
 * @param {string} district - ชื่ออำเภอ/เขต
 * @param {string} subdistrict - ชื่อตำบล/แขวง
 * @returns {string | null} รหัสไปรษณีย์ 5 หลัก หรือ null หากข้อมูลไม่ครบหรือไม่พบ
 */
export function lookupZipcode(tree: AddressTree | null, province: string, district: string, subdistrict: string): string | null {
    return tree?.[province]?.[district]?.[subdistrict] ?? null;
}
