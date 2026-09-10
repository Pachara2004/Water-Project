"use client";

import PageHeader from "@/components/PageHeader";
import type { CurrentUser } from "@/lib/store";
import type { useRouter } from "next/navigation";

export interface TermsProps {
    currentUser: CurrentUser | null | undefined;
    router: ReturnType<typeof useRouter>;
}

export default function TermsMobile({ currentUser, router }: TermsProps) {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <PageHeader title="ข้อตกลงการใช้งาน" onBack={() => router.back()} />

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                <div className="relative w-full rounded-2xl bg-card-general p-5 border border-border flex flex-col gap-2 min-h-[500px]">
                    <p className="text-sm text-text-secondary leading-relaxed">เนื้อหาข้อตกลงการใช้งาน...</p>
                </div>
            </div>
        </div>
    );
}
