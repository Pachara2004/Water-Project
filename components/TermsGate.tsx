"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollText, ChevronDown } from "lucide-react";
import LiffBackground from "@/components/LiffBackground";
import TermsContent from "@/components/TermsContent";

interface TermsGateProps {
    onAccept: () => void;
    onDecline: () => void;
    /** ปุ่มยอมรับกำลังทำงาน (เช่น รอ /api/auth) */
    busy?: boolean;
}

// หน้าข้อตกลงเต็มจอสำหรับผู้ใช้ที่ยังไม่มีบัญชีในระบบ (ดู lib/lineAuth.ts)
// ปุ่มยอมรับเปิดเมื่อผู้ใช้เลื่อนถึงท้ายเอกสารแล้วเท่านั้น และเปิดแล้วไม่ปิดอีกแม้เลื่อนกลับขึ้น
export default function TermsGate({ onAccept, onDecline, busy = false }: TermsGateProps) {
    const [termsRead, setTermsRead] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    // ใช้ IntersectionObserver บน sentinel ท้ายเนื้อหาแทนการคำนวณ scrollTop เพราะรองรับทั้งกรณีเนื้อหาสั้นกว่ากล่อง
    // (ไม่มี scroll event เกิดเลย) และค่า scrollHeight ที่เพี้ยนใน LINE webview บน iOS
    useEffect(() => {
        if (termsRead) return;
        const el = endRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) setTermsRead(true);
            },
            { threshold: 0.5 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [termsRead]);

    return (
        <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 sm:p-6">
            <LiffBackground />

            <div className="bg-card-general w-full max-w-md rounded-2xl border border-border p-6 sm:p-8 shadow-lg flex flex-col justify-between animate-fade-in z-10">
                <div className="text-center space-y-2.5">
                    <div className="w-14 h-14 text-primary flex items-center justify-center mx-auto">
                        <ScrollText size={56} strokeWidth={2} />
                    </div>
                    <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">ข้อตกลงและนโยบายความเป็นส่วนตัว</h1>
                    <p className="text-xs text-text leading-relaxed mx-auto">กรุณาอ่านให้ครบถ้วนก่อนลงทะเบียน ระบบจะเปิดปุ่มยอมรับเมื่อท่านเลื่อนถึงท้ายเอกสาร</p>
                </div>

                <div className="relative mt-5">
                    <div className="max-h-[45dvh] overflow-y-auto rounded-xl border border-border bg-surface-subtle p-4 overscroll-contain">
                        <TermsContent />
                        <div ref={endRef} className="h-px" />
                    </div>
                    {/* fade ขอบล่างบอกว่ายังมีเนื้อหาต่อ หายไปเมื่ออ่านจบ */}
                    {!termsRead && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-linear-to-t from-surface-subtle to-transparent" />}
                </div>

                <div className="h-5 mt-2 flex items-center justify-center">
                    {!termsRead && (
                        <span className="text-xs text-text-muted flex items-center gap-1 animate-pulse">
                            <ChevronDown size={14} /> เลื่อนอ่านให้ครบเพื่อดำเนินการต่อ
                        </span>
                    )}
                </div>

                <div className="pt-2 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onDecline}
                        disabled={busy}
                        className="w-full h-11 bg-surface-subtle hover:bg-surface border border-border text-text font-semibold rounded-xl text-xs tracking-widest transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                        ไม่ยอมรับ
                    </button>
                    <button
                        type="button"
                        disabled={!termsRead || busy}
                        onClick={onAccept}
                        className="w-full h-11 bg-secondary hover:bg-primary text-white font-semibold rounded-xl text-xs tracking-widest transition-all disabled:bg-surface-subtle disabled:text-text-muted disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                        {busy ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>กำลังเข้าสู่ระบบ...</span>
                            </>
                        ) : (
                            "ยอมรับ"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
