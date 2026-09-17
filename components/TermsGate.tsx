/**
 * @file TermsGate.tsx
 * @project Water Monitoring Project
 * @module UI / Auth / Terms
 * @description
 * หน้าข้อตกลงและนโยบายความเป็นส่วนตัวเต็มจอ แสดงให้ผู้ใช้ที่ยังไม่มีบัญชีในระบบก่อนเก็บ LINE uid
 * (ดู lib/lineAuth.ts) ปุ่มยอมรับเปิดเมื่อเลื่อนถึงท้ายเอกสารแล้วเท่านั้น และเปิดแล้วไม่ปิดอีก
 * ตรวจการอ่านจบด้วย IntersectionObserver บน sentinel ท้ายเนื้อหา
 *
 * Full-screen terms & privacy gate shown before a new user's LINE uid is stored.
 * The accept button unlocks only after the user scrolls to the end of the document.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @version 1.0.0
 *
 * @lastModified 2026-09-15 14:15
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-09-15 14:15 by Nopparut U. - สร้างหน้าข้อตกลง บังคับยอมรับก่อนระบบเก็บ LINE uid
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @notes ใช้ IntersectionObserver แทน scrollTop เพราะรองรับเนื้อหาสั้นกว่ากล่อง และ scrollHeight ที่เพี้ยนใน LINE webview บน iOS
 * @see docs/skills/SKILL_line_liff_ux.md
 * @license Private / Proprietary
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollText, ChevronDown } from "lucide-react";
import LiffBackground from "@/components/LiffBackground";
import TermsContent from "@/components/TermsContent";

/** Props ของ TermsGate */
interface TermsGateProps {
    /** เรียกเมื่อผู้ใช้กดยอมรับ (หลังอ่านจบ) */
    onAccept: () => void;
    /** เรียกเมื่อผู้ใช้กดไม่ยอมรับ */
    onDecline: () => void;
    /** ปุ่มยอมรับกำลังทำงาน (เช่น รอ /api/auth) */
    busy?: boolean;
}

/**
 * หน้าข้อตกลงเต็มจอ วางทับทุกอย่างด้วย z-index 2000
 *
 * @param props - ดู {@link TermsGateProps}
 */
export default function TermsGate({ onAccept, onDecline, busy = false }: TermsGateProps) {
    const [termsRead, setTermsRead] = useState(false);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    // ใช้ IntersectionObserver บน sentinel ท้ายเนื้อหาแทนการคำนวณ scrollTop เพราะรองรับทั้งกรณีเนื้อหาสั้นกว่ากล่อง
    // (ไม่มี scroll event เกิดเลย) และค่า scrollHeight ที่เพี้ยนใน LINE webview บน iOS
    useEffect(() => {
        if (termsRead) return;
        const el = endRef.current;
        if (!el) return;
        // root เป็นกล่องเลื่อนเอง ไม่ใช่ viewport และ threshold 0 เพราะ sentinel สูง 1px
        // ratio จาก sub-pixel rounding บนจอ DPR ไม่เต็มอาจไม่ถึง 0.5 ทั้งที่มองเห็นแล้ว
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) setTermsRead(true);
            },
            { root: scrollerRef.current, threshold: 0 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [termsRead]);

    return (
        <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 sm:p-6">
            <LiffBackground />

            <div className="bg-card-general w-full max-w-md rounded-2xl border border-border p-6 sm:p-8 shadow-lg flex flex-col justify-between animate-fade-in z-10">
                <div className="text-center">
                    <div className="w-10 h-10 text-primary flex items-center justify-center mx-auto">
                        <ScrollText size={48} strokeWidth={2} />
                    </div>
                    <h1 className="text-md sm:text-lg font-semibold text-primary tracking-tight">ข้อตกลงและนโยบายความเป็นส่วนตัว</h1>
                    <p className="text-xs text-text leading-relaxed mx-auto">กรุณาอ่านให้ครบถ้วนก่อนลงทะเบียน ระบบจะเปิดปุ่มยอมรับเมื่อท่านเลื่อนถึงท้ายเอกสาร</p>
                </div>

                <div className="relative mt-5">
                    {/* ชั้นนอกถือขอบมนและ clip scrollbar ชั้นในเป็นตัวเลื่อน ถ้ารวมกันขอบโค้งจะไม่ clip scrollbar */}
                    <div className="rounded-xl border border-border bg-surface-subtle overflow-hidden">
                        <div ref={scrollerRef} className="max-h-[50dvh] overflow-y-auto p-4 overscroll-contain">
                            <TermsContent />
                            <div ref={endRef} className="h-px" />
                        </div>
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
