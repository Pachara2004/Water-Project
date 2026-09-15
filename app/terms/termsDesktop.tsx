"use client";

import PageHeader from "@/components/PageHeader";
import TermsContent from "@/components/TermsContent";
import type { TermsProps } from "./termsMobile";

export default function TermsDesktop({ onBack }: TermsProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงและนโยบายความเป็นส่วนตัว" onBack={onBack} />

            <div className="w-full max-w-3xl mx-auto p-4">
                <div className="bg-card-general rounded-2xl border border-border p-6">
                    <TermsContent />
                </div>
            </div>
        </div>
    );
}
