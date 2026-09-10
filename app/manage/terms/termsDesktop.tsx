"use client";

import PageHeader from "@/components/PageHeader";
import type { TermsProps } from "./termsMobile";

export default function TermsDesktop({ currentUser, router }: TermsProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงการใช้งาน" onBack={() => router.back()} />

            <div className="w-full mx-auto p-4 space-y-4">
                <div className="bg-card-general rounded-2xl border border-border p-6 min-h-[500px]">
                     <p className="text-sm text-text-secondary leading-relaxed">เนื้อหาข้อตกลงการใช้งาน...</p>
                </div>
            </div>
        </div>
    );
}
