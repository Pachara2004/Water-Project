"use client";

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
 * ข้อมูลจังหวัด/อำเภอ/ตำบล ของไทย ใช้เป็นแหล่งความจริงเดียวทั้งการเลือกในฟอร์ม
 * และการตรวจสอบค่าที่ได้จาก reverse geocode
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
