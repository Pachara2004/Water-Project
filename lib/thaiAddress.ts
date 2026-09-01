/**
 * ตรรกะที่อยู่ไทยที่ใช้ร่วมกันทั้ง client และ server
 *
 * ห้าม import อะไรที่เป็น server-only (fs, prisma) ในไฟล์นี้ เพราะฝั่ง client import ด้วย
 * ตัวโหลดไฟล์ฝั่ง server อยู่ที่ lib/thaiAddress.server.ts ส่วนฝั่ง client อยู่ที่ lib/hooks/useThaiAddressTree.ts
 */

/** Structure: { [province]: { [district]: { [subdistrict]: "zipcode" } } } */
export type AddressTree = Record<string, Record<string, Record<string, string>>>;

export interface AddressParts {
    province: string;
    district: string;
    subdistrict: string;
}

/**
 * ตรวจค่าที่อยู่ทีละระดับ แล้วคืนเฉพาะส่วนที่มีอยู่จริงในฐานข้อมูล
 *
 * ตัดแบบ cascade: ถ้าจังหวัดไม่ผ่าน อำเภอกับตำบลก็ใช้ไม่ได้ตามไปด้วย
 * เพราะชื่ออำเภอ/ตำบลมีความหมายเฉพาะภายใต้จังหวัดนั้น จึงจับได้ทั้งชื่อที่ไม่มีอยู่จริง
 * และชื่อที่มีอยู่จริงแต่ผูกผิดระดับ (เช่น อำเภอกะทู้ ใต้จังหวัดชลบุรี)
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

/** รหัสไปรษณีย์ตามฐานข้อมูลของที่อยู่ชุดนี้ — null เมื่อที่อยู่ไม่ครบสามระดับหรือไม่มีอยู่จริง */
export function lookupZipcode(tree: AddressTree | null, province: string, district: string, subdistrict: string): string | null {
    return tree?.[province]?.[district]?.[subdistrict] ?? null;
}
