/**
 * @file termsDesktop.tsx
 * @project Water Monitoring Project
 * @module App / Terms
 * @description
 * view desktop ของหน้าข้อตกลง: PageHeader + การ์ดครอบ TermsContent กว้างสุด max-w-3xl
 *
 * Desktop view of the terms page.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @version 1.0.0
 *
 * @lastModified 2026-09-15 14:15
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-09-15 14:15 by Nopparut U. - สร้าง view desktop
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import PageHeader from "@/components/PageHeader";
import TermsContent from "@/components/TermsContent";
import type { TermsProps } from "./termsMobile";

/**
 * หน้าข้อตกลงบน desktop
 *
 * @param onBack - เรียกเมื่อกดย้อนกลับ
 */
export default function TermsDesktop({ onBack }: TermsProps) {
    return (
        <div className="w-full flex-1 bg-bg antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงและนโยบายความเป็นส่วนตัว" onBack={onBack} />

            <div className="w-full max-w-3xl mx-auto p-4">
                <div className="bg-card-general rounded-2xl border border-border p-6">
                    <TermsContent />
                </div>
            </div>
        </div>
    );
}
