/**
 * @fileoverview Server-only loader and memory cache for Thai address tree data
 *
 * [TH] โมดูลโหลดข้อมูลต้นไม้ที่อยู่ไทยจากไฟล์ JSON บน Server พร้อม In-memory Cache
 * [EN] Server-only loader and in-memory cache for Thai administrative address JSON data
 *
 * @description
 * [TH] โหลดไฟล์ thai_address.json จากโฟลเดอร์ public/data บนฝั่ง Server ด้วย Node.js fs/promises
 * และทำ caching ไว้ใน memory สำหรับการเรียกใช้ใน API routes (ห้าม import จาก client)
 * [EN] Reads and caches thai_address.json from public/data via Node fs/promises for server-side APIs.
 *
 * @module lib/thaiAddress.server
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: แยกตัวโหลดไฟล์ที่อยู่ไทยบน server ใน lib/thaiAddress.server.ts
 */

// server-only: ไฟล์นี้ใช้ fs จึง import จาก client component ไม่ได้
// ตรรกะที่ใช้ร่วมกันทั้งสองฝั่งอยู่ที่ lib/thaiAddress.ts
import { readFile } from "fs/promises";
import path from "path";
import type { AddressTree } from "@/lib/thaiAddress";

// อ่านจาก public/ ครั้งเดียวแล้วถือไว้ในหน่วยความจำ (~268KB) เพราะข้อมูลนิ่ง ไม่เปลี่ยนระหว่างรัน
// ใช้ path นี้ได้ทั้ง dev และ production image เพราะ Dockerfile คัดลอก public/ ไปไว้ที่ cwd เดียวกัน
let treePromise: Promise<AddressTree> | null = null;

/**
 * [TH] โหลดข้อมูลโครงสร้างต้นไม้ที่อยู่ไทย (AddressTree) โดยเก็บ cache ไว้ในหน่วยความจำระดับ process
 * [EN] Loads and memoizes the Thai address tree data structure from disk
 *
 * @function getThaiAddressTree
 * @returns {Promise<AddressTree>} Promise ของโครงสร้างต้นไม้ข้อมูลที่อยู่ไทย
 */
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
