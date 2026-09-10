"use client";

import PageHeader from "@/components/PageHeader";
import type { CurrentUser } from "@/lib/store";
import type { useRouter } from "next/navigation";

export interface PrivacyPolicyProps {
    currentUser: CurrentUser | null | undefined;
    router: ReturnType<typeof useRouter>;
}

export default function PrivacyPolicyMobile({ currentUser, router }: PrivacyPolicyProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <PageHeader title="นโยบายความเป็นส่วนตัว" onBack={() => router.back()} />

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                <div className="relative w-full rounded-2xl bg-card-general p-5 border border-border flex flex-col gap-2 min-h-[500px]">
                    <p className="text-sm text-text-secondary leading-relaxed">เนื้อหานโยบายความเป็นส่วนตัว...</p>
                </div>
            </div>
        </div>
    );
}
