"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AnchoredMenuPos {
    left: number;
    width: number;
    top?: number;
    bottom?: number;
}

/**
 * จัดตำแหน่งเมนูดรอปดาวน์ที่ถูกส่งไป render ที่ document.body ผ่าน portal
 *
 * ที่ต้อง portal เพราะดรอปดาวน์เหล่านี้ถูกใช้ในฟอร์มที่อยู่ใน Popup ซึ่งกล่องเนื้อหา
 * เป็น overflow-y-auto ถ้าวางเมนูแบบ absolute ตามปกติจะโดนขอบกล่องตัด
 * และใช้ position: fixed เฉย ๆ ก็ไม่พอ เพราะ Popup มีแอนิเมชันที่ใช้ transform
 * ซึ่งสร้าง containing block ใหม่ ทำให้ fixed ยังถูกตัดอยู่ดี
 *
 * ครอบคลุม: กางขึ้นเมื่อที่ว่างด้านล่างไม่พอ, คำนวณใหม่เมื่อเลื่อน/ย่อขยายจอ,
 * และปิดเมื่อคลิกนอกทั้งตัว anchor และตัวเมนู (สองกล่องนี้อยู่คนละที่ใน DOM แล้ว)
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
