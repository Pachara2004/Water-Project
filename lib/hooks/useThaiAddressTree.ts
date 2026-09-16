"use client";

/**
 * @fileoverview Custom React hook for loading and caching the Thai address hierarchy tree
 *
 * [TH] React Hook สำหรับโหลดและจัดเก็บข้อมูลต้นไม้ที่อยู่ไทย (AddressTree) ผ่าน Module-level Promise Cache
 * [EN] React hook for fetching and caching the Thai administrative address hierarchy tree
 *
 * @description
 * [TH] โหลดไฟล์ thai_address.json จาก static asset (/data/thai_address.json ขนาด ~268KB)
 * โดยใช้ Promise cache ระดับโมดูลเพื่อป้องกันการยิง fetch ซ้ำซ้อนจากหลาย Component บนหน้าเดียวกัน
 * [EN] Fetches thai_address.json with module-level promise memoization preventing duplicate network requests.
 *
 * @module lib/hooks/useThaiAddressTree
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม hook useThaiAddressTree สำหรับโหลดข้อมูลที่อยู่ไทยแบบโมดูลแคช
 */

import { useEffect, useState } from "react";
import type { AddressTree } from "@/lib/thaiAddress";

// re-export เพื่อให้ผู้เรียกฝั่ง client import ได้จากที่เดียว
export { validateAddressParts, type AddressTree } from "@/lib/thaiAddress";

// ไฟล์ที่อยู่มีขนาด ~268KB และถูกใช้หลายที่ในหน้าเดียวกัน (ฟอร์มเลือกที่อยู่ + ตัวตรวจผล geocode)
// จึง cache promise ไว้ระดับโมดูล ให้ทุกผู้เรียกใช้ผลจากการ fetch ครั้งเดียวกัน
let treePromise: Promise<AddressTree> | null = null;

function loadTree(): Promise<AddressTree> {
    if (!treePromise) {
        treePromise = fetch("/data/thai_address.json")
            .then((res) => res.json())
            .catch((err) => {
                // ล้าง cache เมื่อโหลดพลาด เพื่อให้ครั้งถัดไปลองใหม่ได้ ไม่ค้างเป็น promise ที่ reject ตลอด
                treePromise = null;
                throw err;
            });
    }
    return treePromise;
}

/**
 * [TH] Hook โหลดข้อมูลโครงสร้างต้นไม้จังหวัด/อำเภอ/ตำบลของไทยสำหรับฟอร์มและ Reverse Geocoding
 * [EN] Hook fetching the complete Thai address hierarchical tree for form selectors and geocoding validation
 *
 * @function useThaiAddressTree
 * @returns {AddressTree | null} โครงสร้างต้นไม้ข้อมูลที่อยู่ไทย หรือ null หากกำลังโหลด
 */
export function useThaiAddressTree() {
    const [tree, setTree] = useState<AddressTree | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadTree()
            .then((data) => {
                if (!cancelled) setTree(data);
            })
            .catch((err) => console.error("Failed to load thai address data", err));

        return () => {
            cancelled = true;
        };
    }, []);

    return tree;
}
