"use client";

import PageHeader from "@/components/PageHeader";
import TermsContent from "@/components/TermsContent";

export interface TermsProps {
    onBack: () => void;
}

export default function TermsMobile({ onBack }: TermsProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงและนโยบายความเป็นส่วนตัว" onBack={onBack} />

            <div className="w-full max-w-xl mx-auto px-4 pt-6">
                <div className="w-full rounded-2xl bg-card-general p-5 border border-border">
                    <TermsContent />
                </div>
            </div>
        </div>
    );
}
