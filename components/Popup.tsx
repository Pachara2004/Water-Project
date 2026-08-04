"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// เปลือก modal กลางใช้ซ้ำได้ทุกหน้า (แก้ไขโปรไฟล์, แก้ไขสถานี ฯลฯ)
// desktop = การ์ดลอยกลางจอ (popup) | mobile = bottom-sheet เลื่อนขึ้นจากขอบล่าง
// เลือกให้อัตโนมัติตามขนาดจอ หรือบังคับผ่าน prop variant ก็ได้
// backdrop / หัวข้อ / ปุ่มปิด / Esc / แอนิเมชัน จัดการให้ครบ เนื้อหาส่งผ่าน children
export default function Popup({
    onClose,
    title,
    children,
    maxWidth = "max-w-lg",
    variant,
}: {
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    // ปรับความกว้างสูงสุดของการ์ด (มีผลเฉพาะโหมด popup)
    maxWidth?: string;
    // บังคับรูปแบบเอง; ไม่ส่ง = เลือกตามจอ (mobile = sheet, desktop = popup)
    variant?: "popup" | "sheet";
}) {
    const isMobile = useMediaQuery("(max-width: 767px)");
    const isSheet = (variant ?? (isMobile ? "sheet" : "popup")) === "sheet";

    // ปลายทางของ portal — เป็น null ตอน SSR เพราะไม่มี document
    // (ทุกจุดที่เรียก Popup เปิดจาก state หลังผู้ใช้กด จึงไม่มีทางถูก render ตั้งแต่ HTML ชุดแรก)
    const portalTarget = typeof document === "undefined" ? null : document.body;

    // กด Esc เพื่อปิด
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    // ล็อก scroll พื้นหลังตอนเปิด + จอง gutter ไว้กัน layout กระตุก
    // scrollbar บน desktop เป็นของ <html> (เพราะ body ตั้ง overflow-x:hidden) จึงล็อกที่ documentElement
    // ถ้าหน้านั้นจอง gutter ไว้แล้ว (reserve-scrollbar-gutter) จะไม่แตะ class เดิม ปล่อยให้เจ้าของหน้าคุมเอง
    useEffect(() => {
        const docEl = document.documentElement;
        // จอง gutter เฉพาะเมื่อหน้ามี scrollbar อยู่จริง (ถ้าไม่มี การจองจะทำให้ layout ขยับเสียเอง)
        // และเฉพาะเมื่อหน้านั้นยังไม่ได้จองไว้เอง (persistent) จึงจะแตะ class
        const hasScrollbar = window.innerWidth - docEl.clientWidth > 0;
        const ownsGutter = hasScrollbar && !docEl.classList.contains("reserve-scrollbar-gutter");
        if (ownsGutter) docEl.classList.add("reserve-scrollbar-gutter");
        const prevOverflow = docEl.style.overflow;
        docEl.style.overflow = "hidden";
        // ย้อม body ให้กลืน backdrop กันแถบ scrollbar gutter สว่างโผล่ (ดู body.popup-shown ใน globals.css)
        document.body.classList.add("popup-shown");
        return () => {
            docEl.style.overflow = prevOverflow;
            if (ownsGutter) docEl.classList.remove("reserve-scrollbar-gutter");
            document.body.classList.remove("popup-shown");
        };
    }, []);

    // ส่วนหัว (หัวข้อ + ปุ่มปิด) ใช้ร่วมกันทั้งสองโหมด
    const header = (
        <div className="flex items-center justify-between mb-7">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">{title}</h3>
            <button
                title="ปิด"
                onClick={onClose}
                className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
            >
                <X size={14} className="text-text-secondary" />
            </button>
        </div>
    );

    if (!portalTarget) return null;

    // Portal ไป body เสมอ — ไม่งั้นถ้าผู้เรียกอยู่ในกล่องที่มี transform (เช่นการ์ดที่ใส่ active:scale)
    // ตัว fixed จะยึดกล่องนั้นเป็นกรอบอ้างอิงแทน viewport ทำให้ modal ไปโผล่ผิดที่/ถูกย่อตามการ์ด
    return createPortal(
        <>
            {/* Backdrop — blur-md (แทน blur-xs เดิม) กันรายละเอียดพื้นหลัง (เช่นเงาหมุดแผนที่) ลอดผ่านมาเห็นจางๆ */}
            <div className="fixed inset-0 bg-black/40 z-800 backdrop-blur-md transition-opacity" onClick={onClose} />

            {/* ทั้งสองโหมดจัดเป็น flex column: แถบจับ/หัวข้อ/ปุ่มปิด ตรึงอยู่กับที่ ให้เลื่อนเฉพาะ children
                (ตัวเลื่อนต้องมี min-h-0 ด้วย ไม่งั้น flex item จะไม่ยอมหดต่ำกว่าความสูงเนื้อหา แล้วล้นออกนอกกล่อง) */}
            {isSheet ? (
                // Mobile: bottom-sheet ยึดขอบล่างเต็มความกว้าง พร้อมแถบจับและเว้น safe-area
                // จำกัดความสูงไว้ที่ 85dvh ไม่งั้นเนื้อหายาวจะทะลุขอบบนจอจนกดไม่ถึง
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed bottom-0 left-0 right-0 z-801 bg-surface rounded-t-4xl border-t border-border max-w-lg mx-auto px-6 pt-6 max-h-[85dvh] flex flex-col animate-slide-up transition-colors duration-300"
                    style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}
                >
                    <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 shrink-0" />
                    <div className="shrink-0">{header}</div>
                    <div className="min-h-0 overflow-y-auto no-scrollbar">{children}</div>
                </div>
            ) : (
                // Desktop: การ์ดลอยกลางจอ; pointer-events-none ที่ตัวครอบเพื่อให้คลิกนอกการ์ดทะลุไปโดน backdrop ได้
                <div className="fixed inset-0 z-801 flex items-center justify-center p-4 pointer-events-none">
                    <div
                        role="dialog"
                        aria-modal="true"
                        className={`pointer-events-auto w-full ${maxWidth} max-h-[90dvh] flex flex-col bg-surface rounded-3xl border border-border px-6 py-6 shadow-2xl animate-scale-in transition-colors duration-300`}
                    >
                        <div className="shrink-0">{header}</div>
                        <div className="min-h-0 overflow-y-auto no-scrollbar">{children}</div>
                    </div>
                </div>
            )}
        </>,
        portalTarget,
    );
}
