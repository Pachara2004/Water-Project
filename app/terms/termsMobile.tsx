/**
 * @file termsMobile.tsx
 * @project Water Monitoring Project
 * @module App / Terms
 * @description
 * view มือถือของหน้าข้อตกลง: PageHeader + การ์ดครอบ TermsContent กว้างสุด max-w-xl
 * ประกาศ TermsProps ที่ termsDesktop ใช้ร่วมด้วย
 *
 * Mobile view of the terms page; also declares the shared TermsProps.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @version 1.0.0
 *
 * @lastModified 2026-09-15 14:15
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-09-15 14:15 by Nopparut U. - สร้าง view มือถือ
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import PageHeader from "@/components/PageHeader";
import TermsContent from "@/components/TermsContent";

/** Props ร่วมของ TermsMobile / TermsDesktop */
export interface TermsProps {
    onBack: () => void;
}

/**
 * หน้าข้อตกลงบนมือถือ
 *
 * @param onBack - เรียกเมื่อกดย้อนกลับ
 */
export default function TermsMobile({ onBack }: TermsProps) {
    return (
        <div className="w-full flex-1 bg-bg pb-5 antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงและนโยบาย" onBack={onBack} />

            <div className="w-full max-w-xl mx-auto px-4 pt-6">
                <div className="w-full rounded-2xl bg-card-general p-5 border border-border">
                    <TermsContent />
                </div>
            </div>
        </div>
    );
}
