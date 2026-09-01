// server-only: ไฟล์นี้ใช้ fs จึง import จาก client component ไม่ได้
// ตรรกะที่ใช้ร่วมกันทั้งสองฝั่งอยู่ที่ lib/thaiAddress.ts
import { readFile } from "fs/promises";
import path from "path";
import type { AddressTree } from "@/lib/thaiAddress";

// อ่านจาก public/ ครั้งเดียวแล้วถือไว้ในหน่วยความจำ (~268KB) เพราะข้อมูลนิ่ง ไม่เปลี่ยนระหว่างรัน
// ใช้ path นี้ได้ทั้ง dev และ production image เพราะ Dockerfile คัดลอก public/ ไปไว้ที่ cwd เดียวกัน
let treePromise: Promise<AddressTree> | null = null;

export function getThaiAddressTree(): Promise<AddressTree> {
    if (!treePromise) {
        treePromise = readFile(path.join(process.cwd(), "public", "data", "thai_address.json"), "utf-8")
            .then((raw) => JSON.parse(raw) as AddressTree)
            .catch((err) => {
                // ล้าง cache เมื่ออ่านพลาด เพื่อให้ request ถัดไปลองใหม่ได้ ไม่ค้างเป็น promise ที่ reject ตลอด
                treePromise = null;
                throw err;
            });
    }
    return treePromise;
}
