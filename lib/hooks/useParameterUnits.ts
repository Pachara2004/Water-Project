"use client";

import { useEffect, useState } from "react";

/**
 * หน่วยของสารแต่ละตัว โดยคีย์เป็นชื่อสารตัวพิมพ์เล็ก (เช่น "phosphate" -> "mg/L")
 *
 * ค่าที่แบนมากับ payload ของสถานี (`${ชื่อสาร}Val`) ไม่มีหน่วยติดมาด้วย
 * ป้ายกำกับที่ต้องบอกหน่วยจึงต้องมาเทียบกับตาราง `parameters` เอง
 *
 * ถือเป็นข้อมูลเสริม — โหลดไม่สำเร็จก็คืน Map ว่าง ผู้เรียกต้องแสดงผลต่อได้โดยไม่มีหน่วย
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
