"use client";

/**
 * @fileoverview Custom React hook for anchored portal dropdown menus
 *
 * [TH] React Hook สำหรับคำนวณตำแหน่งและควบคุมการปิดเมนูดรอปดาวน์ที่เรนเดอร์ผ่าน React Portal
 * [EN] React hook for computing anchored positions and outside-click dismissal for portal dropdown menus
 *
 * @description
 * [TH] คำนวณพิกัด (top, bottom, left, width) ของเมนูดรอปดาวน์เทียบกับจุดยึด (Anchor Element)
 * กางขึ้นด้านบนอัตโนมัติหากพื้นที่ด้านล่างไม่พอ และดักจับการคลิกนอกขอบเขตทั้ง anchor และ portal menu
 * [EN] Manages viewport positioning (upward/downward flip), resize/scroll recalculations,
 * and dual-container outside-click handling for menus rendered at document.body via Portal.
 *
 * @module lib/hooks/useAnchoredMenu
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม hook useAnchoredMenu สำหรับ dropdown ใน modal portal
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * [TH] โครงสร้างข้อมูลตำแหน่งพิกัดและขนาดของเมนูดรอปดาวน์
 * [EN] Positioning coordinates and dimensions for an anchored dropdown menu
 */
export interface AnchoredMenuPos {
    /** [TH] ระยะห่างจากขอบซ้ายของหน้าจอ (px) [EN] Left coordinate in pixels */
    left: number;
    /** [TH] ความกว้างของเมนู (px) [EN] Width in pixels */
    width: number;
    /** [TH] ระยะห่างจากขอบบนของหน้าจอ (px) [EN] Optional top coordinate in pixels */
    top?: number;
    /** [TH] ระยะห่างจากขอบล่างของหน้าจอ (px) [EN] Optional bottom coordinate in pixels */
    bottom?: number;
}

/**
 * [TH] Hook จัดการตำแหน่งของเมนูดรอปดาวน์ที่ถูกส่งไปเรนเดอร์ที่ document.body ผ่าน Portal
 * [EN] Hook managing fixed positioning and dismissal for portal-based dropdown menus
 *
 * @function useAnchoredMenu
 * @param {boolean} isOpen - สถานะการเปิด/ปิดเมนู
 * @param {() => void} onClose - ฟังก์ชันเรียกกลับเมื่อต้องการปิดเมนู (เมื่อคลิกนอก)
 * @param {number} [maxHeight=260] - ความสูงสูงสุดของเมนูเพื่อใช้ประเมินทิศทางการกาง (px)
 * @returns {{ anchorRef: React.RefObject<HTMLDivElement | null>; menuRef: React.RefObject<HTMLDivElement | null>; pos: AnchoredMenuPos | null }} การอ้างอิง DOM และพิกัดตำแหน่ง
 */
export function useAnchoredMenu(isOpen: boolean, onClose: () => void, maxHeight = 260) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<AnchoredMenuPos | null>(null);

    const updatePos = useCallback(() => {
        const el = anchorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const openUp = spaceBelow < maxHeight && r.top > spaceBelow;
        setPos({
            left: r.left,
            width: r.width,
            ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
        });
    }, [maxHeight]);

    // เมนูวางแบบ fixed จึงไม่ขยับตามเนื้อหาที่เลื่อน ต้องคำนวณใหม่เอง
    // ใช้ capture เพื่อให้ได้ยิน scroll ของกล่องเนื้อหาใน Popup ด้วย ไม่ใช่แค่ของหน้าต่าง
    useEffect(() => {
        if (!isOpen) return;
        updatePos();
        window.addEventListener("scroll", updatePos, true);
        window.addEventListener("resize", updatePos);
        return () => {
            window.removeEventListener("scroll", updatePos, true);
            window.removeEventListener("resize", updatePos);
        };
    }, [isOpen, updatePos]);

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            onClose();
        }
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [onClose]);

    return { anchorRef, menuRef, pos };
}
