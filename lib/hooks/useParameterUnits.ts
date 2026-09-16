"use client";

/**
 * @fileoverview Custom React hook for fetching chemical parameter measurement units
 *
 * [TH] React Hook สำหรับดึงข้อมูลหน่วยตรวจวัดของสารเคมีจาก API (/api/parameters)
 * [EN] React hook for fetching and mapping chemical parameter measurement units from API
 *
 * @description
 * [TH] คืนค่า Map ที่จับคู่ชื่อสารเคมี (ตัวพิมพ์เล็ก) เข้ากับหน่วยการวัด (เช่น phosphate -> mg/L)
 * สำหรับใช้แสดงผลต่อท้ายตัวเลขค่าตรวจวัดบน UI
 * [EN] Retrieves parameter specifications and builds a lowercase name-to-unit lookup Map for UI labels.
 *
 * @module lib/hooks/useParameterUnits
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม hook useParameterUnits สำหรับดึงหน่วยของสารเคมี
 */

import { useEffect, useState } from "react";

/**
 * หน่วยของสารแต่ละตัว โดยคีย์เป็นชื่อสารตัวพิมพ์เล็ก (เช่น "phosphate" -> "mg/L")
 *
 * ค่าที่แบนมากับ payload ของสถานี (`${ชื่อสาร}Val`) ไม่มีหน่วยติดมาด้วย
 * ป้ายกำกับที่ต้องบอกหน่วยจึงต้องมาเทียบกับตาราง `parameters` เอง
 *
 * ถือเป็นข้อมูลเสริม — โหลดไม่สำเร็จก็คืน Map ว่าง ผู้เรียกต้องแสดงผลต่อได้โดยไม่มีหน่วย
 */

/**
 * [TH] Hook ดึงข้อมูลหน่วยวัดสารเคมีทั้งหมดจาก API และจัดเก็บในรูป Map
 * [EN] Hook fetching parameter measurement units keyed by lowercase parameter names
 *
 * @function useParameterUnits
 * @returns {{ unitByName: Map<string, string> }} Map จับคู่ชื่อสารตัวพิมพ์เล็กกับหน่วยการวัด
 */
export function useParameterUnits() {
    const [unitByName, setUnitByName] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        let cancelled = false;

        fetch("/api/parameters")
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                const rows: Array<{ name?: string; unit?: string | null }> = Array.isArray(data) ? data : [];
                const map = new Map<string, string>();
                for (const row of rows) {
                    if (row.name && row.unit) map.set(row.name.toLowerCase(), row.unit);
                }
                setUnitByName(map);
            })
            .catch((err) => {
                console.error("Failed to fetch parameter units:", err);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { unitByName };
}
