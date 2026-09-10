"use client";

import PageHeader from "@/components/PageHeader";
import type { PrivacyPolicyProps } from "./privacyPolicyMobile";

export default function PrivacyPolicyDesktop({ currentUser, router }: PrivacyPolicyProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <PageHeader title="นโยบายความเป็นส่วนตัว" onBack={() => router.back()} />

            <div className="w-full mx-auto p-4 space-y-4">
                <div className="bg-card-general rounded-2xl border border-border p-6 min-h-[500px]">
                     <p className="text-sm text-text-secondary leading-relaxed">เนื้อหานโยบายความเป็นส่วนตัว...</p>
                </div>
            </div>
        </div>
    );
}
